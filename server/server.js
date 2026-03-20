import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import OpenAI from "openai";

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 3000;

const openRouterKey = process.env.OPENROUTER_API_KEY?.trim();
const openAIKey = process.env.OPENAI_API_KEY?.trim();
const openAIKeyLooksLikeOpenRouter = Boolean(openAIKey?.startsWith("sk-or-v1-"));

const hasOpenRouterKey = Boolean(openRouterKey);
const hasOpenAIKey = Boolean(openAIKey);
const requestedProvider = (process.env.LLM_PROVIDER || "").toLowerCase();
const provider =
  requestedProvider === "openrouter" && (hasOpenRouterKey || openAIKeyLooksLikeOpenRouter)
    ? "openrouter"
    : requestedProvider === "openai" && hasOpenAIKey && !openAIKeyLooksLikeOpenRouter
      ? "openai"
      : hasOpenRouterKey || openAIKeyLooksLikeOpenRouter
        ? "openrouter"
        : hasOpenAIKey
          ? "openai"
          : "none";

const effectiveOpenRouterKey = openRouterKey || (openAIKeyLooksLikeOpenRouter ? openAIKey : "");
const effectiveOpenAIKey = openAIKeyLooksLikeOpenRouter ? "" : openAIKey;
const model =
  process.env.LLM_MODEL ||
  (provider === "openrouter" ? "meta-llama/llama-3-8b-instruct" : "gpt-4o-mini");

const client = new OpenAI({
  apiKey: provider === "openrouter" ? effectiveOpenRouterKey : effectiveOpenAIKey,
  ...(provider === "openrouter" ? { baseURL: "https://openrouter.ai/api/v1" } : {}),
});
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/", (_req, res) => {
  res.status(200).send("API is running");
});

app.post("/api/summarize", async (req, res) => {
  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";

  if (provider === "none") {
    return res
      .status(500)
      .json({ error: "Missing API key. Set OPENROUTER_API_KEY or OPENAI_API_KEY in server/.env" });
  }

  if (!text) {
    return res.status(400).json({ error: "Text is required" });
  }

  try {
    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: "Return valid JSON only. No markdown." },
        {
          role: "user",
          content: `You are an assistant that converts unstructured text into a strict JSON summary.
Return only valid JSON with this shape:

{
  "summary": "one sentence",
  "keyPoints": ["point 1", "point 2", "point 3"],
  "sentiment": "positive | neutral | negative"
}

Rules:
- summary must be exactly one sentence
- keyPoints MUST contain EXACTLY 3 items (no more, no less)
- If less information is available, still generate 3 meaningful points
- Do not return fewer than 3 points
- sentiment must be one of positive, neutral, negative
- return only JSON

Text:
${text}`
        },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content ?? "";
    const parsed = parseModelJson(raw);

    if (!parsed.summary || !Array.isArray(parsed.keyPoints) || !parsed.sentiment) {
      return res.status(500).json({ error: "AI response JSON is missing required fields" });
    }

    return res.status(200).json({
      summary: String(parsed.summary),
      keyPoints: parsed.keyPoints.slice(0, 3).map((point) => String(point)),
      sentiment: String(parsed.sentiment).toLowerCase(),
    });
  } catch (error) {
    const status = error?.status || 500;
    const message = error?.error?.message || error?.message || "Failed to summarize";
    if (status === 401) {
      return res.status(401).json({
        error: `LLM authentication failed for provider "${provider}". Check API key and LLM_PROVIDER in server/.env.`,
      });
    }
    return res.status(status).json({ error: message });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

function parseModelJson(content) {
  if (!content) {
    throw new Error("Empty response from AI");
  }

  const cleaned = content.replace(/```json|```/gi, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error("Invalid JSON from AI");
  }
}
