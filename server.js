import "dotenv/config";
import express from "express";
import cors from "cors";
import { GoogleGenAI } from "@google/genai";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(
  cors({
    origin: (origin, callback) => {
      if (
        !origin ||
        /^http:\/\/localhost:\d+$/.test(origin) ||
        (process.env.FRONTEND_URL &&
          origin === process.env.FRONTEND_URL)
      ) {
        return callback(null, true);
      }

      return callback(new Error("Origin not allowed by CORS"));
    },
  })
);

app.use(express.json({ limit: "8mb" }));

const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

const sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

function isTemporaryError(error) {
  const status = Number(error.status || error.code);

  return (
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504
  );
}

async function generateWithRetry(model, contents) {
  let lastError;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await ai.models.generateContent({
        model,
        contents,
        config: {
          thinkingConfig: {
            thinkingLevel: "low",
          },
        },
      });
    } catch (error) {
      lastError = error;

      if (!isTemporaryError(error) || attempt === 1) {
        throw error;
      }

      await sleep(1500 * (attempt + 1));
    }
  }

  throw lastError;
}

app.get("/", (_req, res) => {
  res.send("Inonix AI backend is running!");
});

app.post("/api/ask", async (req, res) => {
  const { question, subject, image } = req.body || {};

  const typedQuestion =
    typeof question === "string" ? question.trim() : "";

  if (typedQuestion.length > 5000) {
    return res.status(400).json({
      error: "Please keep your question under 5000 characters.",
    });
  }

  if (!typedQuestion && !image) {
    return res.status(400).json({
      error: "Please type a question or attach a photo.",
    });
  }

  if (!ai) {
    return res.status(500).json({
      error: "Gemini API key is missing from the server environment.",
    });
  }

  const allowedSubjects = ["Physics", "Chemistry", "Biology"];
  const selectedSubject = allowedSubjects.includes(subject)
    ? subject
    : "General Science";

  const prompt = `
You are Inonix AI, an educational tutor for Indian NEET-UG students.

Subject: ${selectedSubject}

Explain in simple, beginner-friendly English.
Use clear headings and step-by-step explanations.
For Physics numericals, show Given, Formula, Substitution,
Calculation and Final Answer with units.
For Chemistry, use correct equations and formulas.
For Biology, prefer accurate NCERT-aligned explanations.
For MCQs, identify the correct option and explain why.
If an image is attached, carefully read the question and diagram.
If any text is unclear, say so instead of guessing.
Write formulas in plain text, such as F = ma.
Do not use dollar signs to format mathematics.

Student question:
${typedQuestion || "Solve the question shown in the attached image."}
`;

  const parts = [{ text: prompt }];

  if (image) {
    if (typeof image !== "string") {
      return res.status(400).json({
        error: "Invalid image. Please select it again.",
      });
    }

    const match = image.match(
      /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/i
    );

    if (!match) {
      return res.status(400).json({
        error: "Unsupported image. Use JPG, PNG, WEBP or GIF.",
      });
    }

    const mimeType = match[1].toLowerCase();
    const base64Data = match[2];
    const bytes = Buffer.from(base64Data, "base64");

    if (bytes.length === 0 || bytes.length > 5 * 1024 * 1024) {
      return res.status(400).json({
        error: "Image must be smaller than 5 MB.",
      });
    }

    parts.push({
      inlineData: {
        mimeType,
        data: base64Data,
      },
    });
  }

  const models = ["gemini-3.8-flash", "gemini-3.6-flash"];
  let lastError;

  for (const model of models) {
    try {
      const response = await generateWithRetry(model, parts);
      const answer = response.text;

      if (!answer || !answer.trim()) {
        return res.status(502).json({
          error: "The AI returned an empty answer. Please try again.",
        });
      }

      return res.json({
        answer: answer.trim(),
      });
    } catch (error) {
      lastError = error;

      console.error(
        `Gemini model ${model} failed:`,
        error.message
      );

      if (!isTemporaryError(error)) {
        break;
      }
    }
  }

  const status = Number(lastError?.status || lastError?.code);

  if (status === 429) {
    return res.status(503).json({
      error: "AI service is busy. Please wait a little and try again.",
    });
  }

  if (isTemporaryError(lastError)) {
    return res.status(503).json({
      error:
        "AI service is temporarily busy. Please try again shortly.",
    });
  }

  return res.status(500).json({
    error:
      "AI could not answer this request. Check the backend terminal for details.",
  });
});

app.listen(PORT, () => {
  console.log(`Inonix AI backend running on port ${PORT}`);
});