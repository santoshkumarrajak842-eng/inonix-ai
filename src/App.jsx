import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import "./App.css";

const subjects = ["Physics", "Chemistry", "Biology"];

const suggestions = [
  "Explain Newton's laws of motion",
  "What is the Krebs cycle?",
  "Solve a mole concept question",
  "Give me 5 NEET Biology MCQs",
];

export default function App() {
  const [subject, setSubject] = useState("Physics");
  const [question, setQuestion] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const fileInputRef = useRef(null);

  const [answer, setAnswer] = useState("");
  const [user, setUser] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authError, setAuthError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isAsking, setIsAsking] = useState(false);
  const [aiError, setAiError] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error(error.message);
        return;
      }
      setUser(data.session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleAuth(e) {
    e.preventDefault();
    setAuthMessage("");
    setAuthError("");

    if (password.length < 6) {
      setAuthError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    try {
      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });

        if (error) throw error;

        if (data.session) {
          setAuthMessage("Account created successfully!");
          setAuthOpen(false);
          setPassword("");
        } else {
          setAuthMessage(
            "Account request received! Check your email for a verification link if email confirmation is enabled."
          );
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) throw error;

        setAuthMessage("Logged in successfully!");
        setAuthOpen(false);
        setPassword("");
      }
    } catch (error) {
      setAuthError(error.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      alert(error.message);
      return;
    }

    setAuthMessage("You have logged out.");
    setAnswer("");
    setAiError("");
  }

  function handleImageChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setAiError("Please select an image file.");
      e.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setAiError("Image must be smaller than 5 MB.");
      e.target.value = "";
      return;
    }

    setAiError("");

    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result !== "string") {
        setAiError("Could not read this image. Please try another.");
        return;
      }

      setSelectedImage(reader.result);
      setImagePreview(reader.result);
    };

    reader.onerror = () => {
      setAiError("Could not read this image. Please try another.");
    };

    reader.readAsDataURL(file);
  }

  function removeImage() {
    setSelectedImage(null);
    setImagePreview("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const trimmedQuestion = question.trim();

    if ((!trimmedQuestion && !selectedImage) || isAsking) return;

    setIsAsking(true);
    setAnswer("");
    setAiError("");

    try {
      const response = await fetch("http://localhost:3001/api/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: trimmedQuestion,
          subject,
          image: selectedImage,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Could not get an AI answer. Please try again."
        );
      }

      if (!data.answer) {
        throw new Error("No answer was returned. Please try again.");
      }

      setAnswer(data.answer);
    } catch (error) {
      console.error("Inonix AI error:", error);

      setAiError(
        error.message?.includes("Failed to fetch")
          ? "Cannot connect to Inonix AI's backend. Make sure both website and backend terminals are running."
          : error.message || "Something went wrong. Please try again."
      );
    } finally {
      setIsAsking(false);
    }
  }

  function startNewChat() {
    setQuestion("");
    setAnswer("");
    setAiError("");
    removeImage();
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">✦</div>
          <div>
            <h2>Inonix AI</h2>
            <p>NEET INTELLIGENCE</p>
          </div>
        </div>

        <button className="new-chat" onClick={startNewChat}>
          <span>＋</span> New doubt
        </button>

        <p className="side-label">YOUR LEARNING</p>
        <div className="side-item">◈ &nbsp; AI Doubt Solver</div>
        <div className="side-item">▤ &nbsp; Practice MCQs</div>
        <div className="side-item">◷ &nbsp; Study progress</div>
        <div className="side-item">☆ &nbsp; Saved questions</div>

        <div className="sidebar-bottom">
          <div className="avatar">
            {user?.email?.[0]?.toUpperCase() || "S"}
          </div>
          <div>
            <strong>{user?.email || "Student"}</strong>
            <p>{user ? "NEET Student" : "NEET Aspirant"}</p>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <span className="mobile-brand">✦ Inonix AI</span>
          <span className="status">
            <i /> AI STUDY SPACE
          </span>

          {user ? (
            <button className="login-btn" onClick={handleLogout}>
              Log out
            </button>
          ) : (
            <button
              className="login-btn"
              onClick={() => {
                setAuthError("");
                setAuthMessage("");
                setIsSignup(false);
                setAuthOpen(true);
              }}
            >
              Log in
            </button>
          )}
        </header>

        <section className="hero">
          <div className="eyebrow">
            <span>✧</span> YOUR PERSONAL NEET AI TUTOR
          </div>

          <h1>
            Understand more.
            <br />
            <span>Achieve your best.</span>
          </h1>

          <p className="hero-text">
            Your personal space to clear doubts, understand concepts
            and prepare smarter for NEET.
          </p>

          <div className="subject-selector">
            {subjects.map((item) => (
              <button
                key={item}
                className={`subject ${subject === item ? "active" : ""}`}
                onClick={() => setSubject(item)}
              >
                {item === "Physics"
                  ? "⚛"
                  : item === "Chemistry"
                    ? "⚗"
                    : "❋"}
                &nbsp; {item}
              </button>
            ))}
          </div>

          <form className="chat-box" onSubmit={handleSubmit}>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={`Ask your ${subject} doubt, or attach a question photo...`}
              rows={3}
              maxLength={5000}
              disabled={isAsking}
            />

            <div className="chat-actions">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                hidden
                onChange={handleImageChange}
                disabled={isAsking}
              />

              <button
                type="button"
                className="upload-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={isAsking}
              >
                ＋ Attach photo
              </button>

              <button
                className="send-btn"
                type="submit"
                disabled={
                  isAsking || (!question.trim() && !selectedImage)
                }
              >
                {isAsking ? "Thinking..." : "Ask AI"}
                <span>{isAsking ? "⏳" : "↗"}</span>
              </button>
            </div>

            {imagePreview && (
              <div
                className="image-preview"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                  marginTop: 14,
                  padding: 12,
                  borderRadius: 12,
                  background: "#141725",
                  border: "1px solid #30354b",
                }}
              >
                <img
                  src={imagePreview}
                  alt="Selected question"
                  style={{
                    width: 120,
                    height: 120,
                    objectFit: "contain",
                    borderRadius: 8,
                  }}
                />

                <span style={{ color: "#c5c8d8", fontSize: 13 }}>
                  Question photo attached
                </span>

                <button
                  type="button"
                  className="upload-btn"
                  onClick={removeImage}
                  disabled={isAsking}
                >
                  Remove photo ×
                </button>
              </div>
            )}
          </form>

          {isAsking && (
            <div
              role="status"
              style={{
                marginTop: 22,
                padding: 18,
                borderRadius: 14,
                background: "#141725",
                border: "1px solid #30354b",
                color: "#c5c8d8",
              }}
            >
              ✦ Inonix AI is reading your question and preparing an answer...
            </div>
          )}

          {aiError && (
            <div
              role="alert"
              style={{
                marginTop: 22,
                padding: 18,
                borderRadius: 14,
                background: "#301b25",
                border: "1px solid #743444",
                color: "#fecaca",
                lineHeight: 1.6,
              }}
            >
              <strong>Couldn't get an answer</strong>
              <p style={{ margin: "8px 0 0" }}>{aiError}</p>
            </div>
          )}

          {answer && (
            <section
              aria-live="polite"
              style={{
                marginTop: 24,
                padding: 22,
                borderRadius: 16,
                background: "#141725",
                border: "1px solid #393454",
                color: "#f4f5fb",
                textAlign: "left",
                lineHeight: 1.8,
                overflowWrap: "anywhere",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                  marginBottom: 14,
                }}
              >
                <strong style={{ color: "#b5aaff" }}>
                  ✦ Inonix AI Answer
                </strong>
                <span style={{ fontSize: 12, color: "#aeb4ca" }}>
                  {subject}
                </span>
              </div>

              <div style={{ whiteSpace: "pre-wrap" }}>{answer}</div>

              <p
                style={{
                  marginTop: 18,
                  paddingTop: 12,
                  borderTop: "1px solid #30354b",
                  color: "#aeb4ca",
                  fontSize: 12,
                }}
              >
                For learning purposes. Verify important facts with your NCERT
                textbook and teachers.
              </p>
            </section>
          )}

          <p className="privacy-note">
            ✧ &nbsp; Built for learning. Designed for NEET aspirants.
          </p>

          {authMessage && (
            <p role="status" style={{ marginTop: 16, color: "#86efac" }}>
              {authMessage}
            </p>
          )}

          <div className="suggestions">
            <p>NOT SURE WHERE TO START?</p>
            <div className="suggestion-grid">
              {suggestions.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    setQuestion(item);
                    setAnswer("");
                    setAiError("");
                  }}
                >
                  <span>↗</span> {item}
                </button>
              ))}
            </div>
          </div>
        </section>

        <footer
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 9,
            textAlign: "center",
            padding: "24px 16px",
          }}
        >
          <span>✦ INONIX AI</span>
          <span>Your journey. Your progress. Your future.</span>
          <span style={{ color: "#b5aaff", fontSize: 13 }}>
            Created by Santosh Kumar Rajak
          </span>
          <span style={{ color: "#aeb4ca", fontSize: 12 }}>
            PW Pathshala, Dibrugarh, Assam
          </span>
          <span style={{ color: "#858ba2", fontSize: 11 }}>
            Empowering NEET Aspirants with AI
          </span>
        </footer>
      </main>

      {authOpen && (
        <div
          onClick={() => setAuthOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(0,0,0,0.75)",
            display: "grid",
            placeItems: "center",
            padding: 20,
          }}
        >
          <section
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 420,
              padding: 28,
              borderRadius: 20,
              background: "#141725",
              border: "1px solid #30354b",
              color: "#f4f5fb",
              textAlign: "left",
            }}
          >
            <button
              type="button"
              onClick={() => setAuthOpen(false)}
              aria-label="Close login"
              style={{
                float: "right",
                background: "transparent",
                border: 0,
                color: "#c5c8d8",
                fontSize: 22,
              }}
            >
              ×
            </button>

            <h2 style={{ color: "#fff", marginBottom: 8 }}>
              {isSignup ? "Create your account" : "Welcome back"}
            </h2>

            <p style={{ color: "#aeb4ca", marginBottom: 22 }}>
              {isSignup
                ? "Join Inonix AI and start your NEET preparation."
                : "Log in to your Inonix AI student account."}
            </p>

            <form onSubmit={handleAuth}>
              <label htmlFor="student-email">Email address</label>
              <input
                id="student-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                style={{
                  display: "block",
                  width: "100%",
                  marginTop: 8,
                  marginBottom: 16,
                  padding: 12,
                  borderRadius: 9,
                  border: "1px solid #393f56",
                  background: "#0b0e19",
                  color: "#fff",
                }}
              />

              <label htmlFor="student-password">Password</label>
              <input
                id="student-password"
                type="password"
                autoComplete={isSignup ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                minLength={6}
                required
                style={{
                  display: "block",
                  width: "100%",
                  marginTop: 8,
                  marginBottom: 18,
                  padding: 12,
                  borderRadius: 9,
                  border: "1px solid #393f56",
                  background: "#0b0e19",
                  color: "#fff",
                }}
              />

              {authError && (
                <p role="alert" style={{ color: "#fca5a5", marginBottom: 14 }}>
                  {authError}
                </p>
              )}

              {authMessage && (
                <p role="status" style={{ color: "#86efac", marginBottom: 14 }}>
                  {authMessage}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: "100%",
                  padding: 13,
                  border: 0,
                  borderRadius: 10,
                  background: "#8b7cff",
                  color: "#fff",
                  fontWeight: 700,
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading
                  ? "Please wait..."
                  : isSignup
                    ? "Create account"
                    : "Log in"}
              </button>
            </form>

            <p
              style={{
                color: "#c5c8d8",
                marginTop: 20,
                textAlign: "center",
              }}
            >
              {isSignup ? "Already registered?" : "New to Inonix AI?"}{" "}
              <button
                type="button"
                onClick={() => {
                  setIsSignup(!isSignup);
                  setAuthError("");
                  setAuthMessage("");
                }}
                style={{
                  background: "transparent",
                  border: 0,
                  color: "#b5aaff",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {isSignup ? "Log in" : "Sign up"}
              </button>
            </p>
          </section>
        </div>
      )}
    </div>
  );
}