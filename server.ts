import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Groq from "groq-sdk";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

const PORT = Number(process.env.PORT) || 3001;

if (!process.env.GROQ_API_KEY) {
  throw new Error("Missing GROQ_API_KEY in .env");
}

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

const sessions = new Map<string, ChatMessage[]>();

const SYSTEM_PROMPT = `
You are CivicIQ AI Copilot.

CivicIQ is an AI Decision Intelligence Platform for Smart Governance.

You assist:
- Citizens
- Government Administrators
- Field Workers
- Public Officials

Your capabilities include:
- Explaining civic services
- Complaint guidance
- Governance assistance
- Smart city recommendations
- Resource allocation suggestions
- General civic information

Rules:
- Never invent complaint statistics.
- If complaint data is not provided, clearly state your answer is general guidance.
- Be concise and professional.
- Explain reasoning when giving recommendations.
`;

app.get("/api/copilot/status", (_, res) => {
  res.json({
    status: "ok",
    service: "CivicIQ AI Copilot",
    model: "llama-3.3-70b-versatile",
  });
});

app.post("/api/copilot/chat", async (req, res) => {
  try {
    const {
      message,
      sessionId = "default",
      context,
    } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({
        error: "message is required",
      });
    }

    const history = sessions.get(sessionId) || [];

    const messages: ChatMessage[] = [
      {
        role: "system",
        content: SYSTEM_PROMPT,
      },
    ];

    if (context) {
      messages.push({
        role: "system",
        content: `Current CivicIQ Context:

${JSON.stringify(context, null, 2)}
`,
      });
    }

    messages.push(...history);

    messages.push({
      role: "user",
      content: message,
    });

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages,
      temperature: 0.4,
      max_tokens: 1200,
    });

    const reply =
      completion.choices[0]?.message?.content ?? "No response.";

    history.push({
      role: "user",
      content: message,
    });

    history.push({
      role: "assistant",
      content: reply,
    });

    // Keep only last 12 messages
    if (history.length > 12) {
      history.splice(0, history.length - 12);
    }

    sessions.set(sessionId, history);

    res.json({
      success: true,
      reply,
    });

  } catch (error: any) {
    console.error("Groq Error:", error);

    res.status(500).json({
      success: false,
      error: error.message || "Internal Server Error",
    });
  }
});

app.delete("/api/copilot/session/:id", (req, res) => {
  sessions.delete(req.params.id);

  res.json({
    success: true,
    message: "Session cleared",
  });
});

app.listen(PORT, () => {
  console.log(`🚀 CivicIQ Copilot running on http://localhost:${PORT}`);
});