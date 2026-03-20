import { useState } from "react";
import "./App.css";

function App() {
  const apiBaseUrl = import.meta.env.VITE_API_URL || "";
  const [text, setText] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!text.trim()) {
      setError("Please enter some text.");
      return;
    }

    setError("");
    setResult(null);
    setLoading(true);

    try {
      const response = await fetch(`${apiBaseUrl}/api/summarize`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(getReadableError(data.error || "Request failed"));
      }
      if (!data.summary || !Array.isArray(data.keyPoints) || !data.sentiment) {
        throw new Error("Invalid response from server. Please try again.");
      }
      setResult(data);
    } catch (error) {
      console.error(error);
      setError(error.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <main className="shell">
        <header className="hero">
          <p className="eyebrow">Assignment Assistant</p>
          <h1>AI Assignment Summarizer</h1>
          <p className="hero-text">
            Paste your notes and get a one-sentence summary, key points, and sentiment in one click.
          </p>
        </header>

        <form className="composer-card" onSubmit={handleSubmit}>
          <label htmlFor="sourceText" className="field-label">
            Source Text
          </label>
          <textarea
            id="sourceText"
            rows="8"
            className="text-input"
            placeholder="Paste your assignment text here..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="actions">
            <button type="submit" className="primary-button" disabled={loading}>
              {loading ? "Analyzing..." : "Analyze Text"}
            </button>
          </div>
        </form>

        {error && <p className="error-text">{error}</p>}

        {result && (
          <section className="result-grid">
            <article className="result-card">
              <h2>Summary</h2>
              <p>{result.summary}</p>
            </article>

            <article className="result-card">
              <h2>Key Points</h2>
              <ul>
                {result.keyPoints.map((point, index) => (
                  <li key={index}>{point}</li>
                ))}
              </ul>
            </article>

            <article className="result-card sentiment-card">
              <h2>Sentiment</h2>
              <p>{result.sentiment}</p>
            </article>
          </section>
        )}
      </main>
    </div>
  );
}

function getReadableError(message) {
  const normalized = String(message || "").toLowerCase();

  if (normalized.includes("invalid json")) {
    return "The AI returned an invalid format. Please retry once with shorter input.";
  }

  if (normalized.includes("authentication failed")) {
    return "AI provider authentication failed. Please check your server .env API key settings.";
  }

  if (normalized.includes("connection error")) {
    return "Could not reach the AI provider from backend. Please try again in a moment.";
  }

  return message;
}

export default App;
