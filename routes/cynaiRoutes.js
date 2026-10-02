import express from "express";
import multer from "multer";
import protect from "../middleware/authMiddleware.js";
import prisma from "../config/prisma.js";
import { streamText } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { getAllProviderModels, getProviderModels, resolveChatConfig } from "../utils/aiProviders.js";
import { CHAT_UPLOAD_LIMITS, extractDocumentText, formatBytes } from "../utils/docText.js";
const router = express.Router();

const baseSystemPrompt = `You are CynAI, the AI study companion for the Department of Computer Science and Engineering (CSE ICB) at AIET. Your role is to help students prepare for exams and answer questions based on VTU-approved textbooks and course materials for the following subjects: IoT, Cyber Security, Blockchain, Embedded Systems, Computer Networks, Operating Systems, Database Management Systems, Cryptography, Software Engineering, and Machine Learning.

You should:
- Answer questions accurately and concisely
- Focus on VTU CBCS syllabus topics
- Cite textbook references when possible
- Help with exam preparation, coding problems, and conceptual doubts
- Be encouraging and academic in tone
- If you don't know the answer, suggest the student consult their course instructor or textbook
- Keep responses focused on academic and educational content
- Do not provide answers that could be considered cheating on exams, but instead guide students toward understanding the concepts`;

function toClientMessage(row) {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    createdAt: row.createdAt,
  };
}

function toClientSession(session) {
  return {
    id: session.id,
    title: session.title,
    subject: session.subject,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    messages: (session.messages || []).map(toClientMessage),
  };
}

// List all AI providers with server-side model catalog.
// GET /api/cynai/models -> all providers (live when server key is set,
// curated fallback otherwise). GET /api/cynai/models/:providerId -> single.
router.get("/models", protect, async (req, res) => {
  try {
    const providers = await getAllProviderModels();
    res.json({ providers });
  } catch (error) {
    console.error("CynAI models list error:", error.message);
    res.status(500).json({ message: "Could not load AI models." });
  }
});

router.get("/models/:providerId", protect, async (req, res) => {
  try {
    const payload = await getProviderModels(req.params.providerId);
    res.json(payload);
  } catch (error) {
    const status = error.statusCode || 500;
    res.status(status).json({ message: error.message || "Could not load AI models." });
  }
});

// List sessions for the logged-in user — lightweight, no messages.
// Message bodies are loaded lazily per session to keep this fast.
router.get("/sessions", protect, async (req, res) => {
  try {
    const sessions = await prisma.studySession.findMany({
      where: { userId: req.user.id || req.user._id },
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { messages: true } } },
      take: 50,
    });
    res.json({
      sessions: sessions.map((session) => ({
        id: session.id,
        title: session.title,
        subject: session.subject,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        messageCount: session._count.messages,
      })),
    });
  } catch (error) {
    console.error("CynAI sessions list error:", error.message);
    res.status(500).json({ message: "Could not load study sessions." });
  }
});

// Get one session with its messages
router.get("/sessions/:id", protect, async (req, res) => {
  try {
    const session = await prisma.studySession.findFirst({
      where: { id: req.params.id, userId: req.user.id || req.user._id },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    if (!session) return res.status(404).json({ message: "Study session not found." });
    res.json({ session: toClientSession(session) });
  } catch (error) {
    console.error("CynAI session get error:", error.message);
    res.status(500).json({ message: "Could not load study session." });
  }
});

// Create a new session for the logged-in user
router.post("/sessions", protect, async (req, res) => {
  try {
    const { title, subject } = req.body || {};
    const session = await prisma.studySession.create({
      data: {
        userId: req.user.id || req.user._id,
        title: typeof title === "string" && title.trim() ? title.trim().slice(0, 120) : "New study session",
        subject: typeof subject === "string" ? subject.slice(0, 80) : "",
      },
      include: { messages: true },
    });
    res.status(201).json({ session: toClientSession(session) });
  } catch (error) {
    console.error("Study session create error:", error.message);
    res.status(500).json({ message: "Could not create study session." });
  }
});

// Rename / re-subject a session
router.patch("/sessions/:id", protect, async (req, res) => {
  try {
    const owned = await prisma.studySession.findFirst({
      where: { id: req.params.id, userId: req.user.id || req.user._id },
    });
    if (!owned) return res.status(404).json({ message: "Study session not found." });

    const data = {};
    if (typeof req.body.title === "string" && req.body.title.trim()) {
      data.title = req.body.title.trim().slice(0, 120);
    }
    if (typeof req.body.subject === "string") {
      data.subject = req.body.subject.slice(0, 80);
    }
    const session = await prisma.studySession.update({
      where: { id: owned.id },
      data,
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    res.json({ session: toClientSession(session) });
  } catch (error) {
    console.error("Study session update error:", error.message);
    res.status(500).json({ message: "Could not update study session." });
  }
});

// Delete a session (messages cascade)
router.delete("/sessions/:id", protect, async (req, res) => {
  try {
    const owned = await prisma.studySession.findFirst({
      where: { id: req.params.id, userId: req.user.id || req.user._id },
    });
    if (!owned) return res.status(404).json({ message: "Study session not found." });

    await prisma.studySession.delete({ where: { id: owned.id } });
    res.json({ message: "Study session deleted." });
  } catch (error) {
    console.error("Study session delete error:", error.message);
    res.status(500).json({ message: "Could not delete study session." });
  }
});

// Chat attachments: memory-only, never stored on disk.
// Supports text, PDF, DOCX, spreadsheets, and images (vision passthrough).
const chatUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: CHAT_UPLOAD_LIMITS.maxBytesPerFile,
    files: CHAT_UPLOAD_LIMITS.maxFiles,
  },
});

function parseChatUpload(req, res, next) {
  const contentType = req.headers["content-type"] || "";
  if (!contentType.includes("multipart/form-data")) return next();
  chatUpload.array("files", CHAT_UPLOAD_LIMITS.maxFiles)(req, res, (error) => {
    if (error) {
      return res.status(400).json({ message: error.message || "File upload failed." });
    }
    next();
  });
}

function parseHistoryField(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

// Chat within a session — streams the answer, then persists both messages.
// Proxied server-side so browsers never hit provider CORS (notably NVIDIA NIM).
// Accepts JSON or multipart/form-data (field "files", up to 5 documents/images).
// Body: { message, history?, subject?, sessionId?, title?, provider?, model? }
router.post("/chat", protect, parseChatUpload, async (req, res) => {
  try {
    const { message, history, subject, sessionId, title, provider: providerId, model: modelId } = req.body;

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return res.status(400).json({ message: "Question is required." });
    }

    let chatConfig;
    try {
      chatConfig = resolveChatConfig(providerId, modelId);
    } catch (configError) {
      return res.status(configError.statusCode || 503).json({ message: configError.message });
    }

    // Resolve or create the session under this user's id (metadata only —
    // messages are loaded below only when the client didn't send history)
    let session = null;
    if (sessionId) {
      session = await prisma.studySession.findFirst({
        where: { id: sessionId, userId: req.user.id },
      });
    }
    if (!session) {
      session = await prisma.studySession.create({
        data: {
          userId: req.user.id || req.user._id,
          title:
            typeof title === "string" && title.trim()
              ? title.trim().slice(0, 120)
              : message.trim().slice(0, 52) || "New study session",
          subject: typeof subject === "string" ? subject.slice(0, 80) : "",
        },
      });
    } else if (typeof subject === "string" && subject !== session.subject) {
      session = await prisma.studySession.update({
        where: { id: session.id },
        data: { subject: subject.slice(0, 80) },
      });
    }

    // Build context: prefer client history; fall back to stored messages only
    // when the client sent none (avoids loading the full thread on every send).
    const clientHistory = parseHistoryField(history).filter(
      (entry) =>
        (entry.role === "user" || entry.role === "assistant") && entry.content
    );
    let pastMessages = clientHistory;
    if (pastMessages.length === 0) {
      const stored = await prisma.studyMessage.findMany({
        where: { sessionId: session.id },
        orderBy: { createdAt: "asc" },
        select: { role: true, content: true },
      });
      pastMessages = stored;
    }

    // Auto-title untitled sessions from the first question
    const hasUserMessages = pastMessages.some((m) => m.role === "user");
    if (!hasUserMessages && session.title === "New study session") {
      session = await prisma.studySession.update({
        where: { id: session.id },
        data: { title: message.trim().slice(0, 52) || "New study session" },
      });
    }

    // Extract attached documents (text goes into the prompt, images go to
    // the model as vision parts). Original message is stored as-is; only
    // filenames are appended so reloaded threads stay readable.
    const attachedFiles = Array.isArray(req.files) ? req.files : [];
    const docSections = [];
    const imageParts = [];
    let charsUsed = 0;
    for (const file of attachedFiles) {
      try {
        const extracted = await extractDocumentText(file);
        if (extracted.kind === "image") {
          imageParts.push({
            type: "image",
            image: `data:${file.mimetype};base64,${file.buffer.toString("base64")}`,
          });
          docSections.push(`[Image attached: ${file.originalname} (${formatBytes(file.size)}) — analyze it visually.]`);
          continue;
        }
        const cleaned = String(extracted.text || "").replace(/\r/g, "").trim();
        if (!cleaned) {
          docSections.push(`[File attached: ${file.originalname} — no readable text found.]`);
          continue;
        }
        const remaining = CHAT_UPLOAD_LIMITS.maxCharsTotal - charsUsed;
        if (remaining <= 0) {
          docSections.push(`[File attached: ${file.originalname} — skipped, total limit reached.]`);
          continue;
        }
        const allowed = Math.min(CHAT_UPLOAD_LIMITS.maxCharsPerFile, remaining);
        const wasTruncated = cleaned.length > allowed;
        const slice = cleaned.slice(0, allowed);
        charsUsed += slice.length;
        docSections.push(
          `[Attached file: ${file.originalname} (${formatBytes(file.size)})${wasTruncated ? " — truncated" : ""}]\n${slice}`
        );
      } catch (fileError) {
        return res.status(400).json({ message: fileError.message });
      }
    }

    const storedUserContent =
      attachedFiles.length > 0
        ? `${message}\n[Attached: ${attachedFiles.map((f) => f.originalname).join(", ")}]`
        : message;

    // Persist the user message immediately
    await prisma.studyMessage.create({
      data: { sessionId: session.id, role: "user", content: storedUserContent },
    });

    const provider = createOpenAICompatible({
      apiKey: chatConfig.apiKey,
      baseURL: chatConfig.baseURL,
      ...(chatConfig.id === "openrouter"
        ? {
            headers: {
              "HTTP-Referer": process.env.CLIENT_URL?.split(",")[0]?.trim() || "https://app.cynexicb.com",
              "X-Title": "CynAI",
            },
          }
        : {}),
    });

    const model = provider(chatConfig.model);

    const messages = [];
    pastMessages.forEach((entry) => {
      if ((entry.role === "user" || entry.role === "assistant") && entry.content) {
        messages.push({ role: entry.role, content: entry.content });
      }
    });
    if (imageParts.length > 0) {
      messages.push({
        role: "user",
        content: [
          {
            type: "text",
            text:
              docSections.length > 0
                ? `${message}\n\n--- Attached documents ---\n${docSections.join("\n\n")}`
                : message,
          },
          ...imageParts,
        ],
      });
    } else if (docSections.length > 0) {
      messages.push({
        role: "user",
        content: `${message}\n\n--- Attached documents ---\n${docSections.join("\n\n")}`,
      });
    } else {
      messages.push({ role: "user", content: message });
    }

    const activeSubject = typeof subject === "string" && subject ? subject : session.subject;
    const system = activeSubject
      ? `${baseSystemPrompt}\n\nThe student is currently studying: ${activeSubject}. Prioritize this subject in your answers.`
      : baseSystemPrompt;

    const sessionIdForSave = session.id;
    const result = streamText({
      model,
      system,
      messages,
      maxOutputTokens: 1000,
      temperature: 0.7,
    });

    // Stream manually so a model failure before the first chunk still
    // returns a JSON error instead of a truncated stream.
    res.setHeader("X-Cynai-Session-Id", session.id);
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    let fullText = "";
    let wroteChunk = false;
    try {
      for await (const chunk of result.textStream) {
        wroteChunk = true;
        fullText += chunk;
        res.write(chunk);
      }
      res.end();
    } catch (streamError) {
      console.error("CynAI stream error:", streamError.message);
      if (!wroteChunk && !res.headersSent) {
        return res.status(502).json({
          message: "CynAI encountered an error. Please try again.",
        });
      }
      try {
        res.end();
      } catch {
        // client already gone
      }
      return;
    }

    try {
      if (fullText.trim()) {
        await prisma.studyMessage.create({
          data: { sessionId: sessionIdForSave, role: "assistant", content: fullText },
        });
        await prisma.studySession.update({
          where: { id: sessionIdForSave },
          data: { updatedAt: new Date() },
        });
      }
    } catch (saveError) {
      console.error("Study message save error:", saveError.message);
    }
  } catch (error) {
    console.error("CynAI error:", error.message);
    if (!res.headersSent) {
      res.status(500).json({ message: "CynAI encountered an error. Please try again." });
    }
  }
});

export default router;
