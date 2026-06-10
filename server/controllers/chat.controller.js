/**
 * Chat Controller
 *
 * Handles RAG chatbot requests with persistent chat sessions.
 * - CRUD for chat sessions
 * - Message sending with auto-save to DB
 */

const { PrismaClient } = require("@prisma/client");
const { semanticSearch, generateAnswer } = require("../services/rag/ragEngine");

const prisma = new PrismaClient();

/**
 * POST /api/chat
 * Body: { message: string, sessionId?: string }
 * Returns: { answer: string, sources: Array, sessionId: string }
 *
 * If sessionId is provided, appends to that session.
 * If not, creates a new session automatically.
 */
const chat = async (req, res, next) => {
  try {
    const { message, sessionId } = req.body;
    const userId = req.user.id;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: "Message is required" });
    }

    const trimmedMessage = message.trim();

    // 1. Resolve or create session
    let session;
    if (sessionId) {
      session = await prisma.chatSession.findFirst({
        where: { id: sessionId, userId },
      });
      if (!session) {
        return res.status(404).json({ error: "Chat session not found" });
      }
    } else {
      // Create a new session with a title derived from the first message
      const title = trimmedMessage.length > 50
        ? trimmedMessage.substring(0, 50) + "..."
        : trimmedMessage;
      session = await prisma.chatSession.create({
        data: { title, userId },
      });
    }

    // 2. Load chat history from DB for this session
    const dbMessages = await prisma.chatMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: "asc" },
      select: { role: true, content: true },
    });

    // 3. Save the user message to DB
    await prisma.chatMessage.create({
      data: {
        role: "user",
        content: trimmedMessage,
        sessionId: session.id,
      },
    });

    // 4. Scope search to the user's college/department/semester
    const scope = {
      collegeId: req.user.collegeId || undefined,
      departmentId: req.user.departmentId || undefined,
      semesterId: req.user.semesterId || undefined,
      limit: 8,
    };

    // 5. Retrieve relevant document chunks
    const searchResults = await semanticSearch(trimmedMessage, scope);

    // 6. Generate answer from context + history
    const { answer, sources } = await generateAnswer(
      trimmedMessage,
      searchResults,
      dbMessages // pass DB history instead of client-sent history
    );

    // 7. Save the assistant message to DB
    await prisma.chatMessage.create({
      data: {
        role: "assistant",
        content: answer,
        sources: sources.length > 0 ? sources : undefined,
        sessionId: session.id,
      },
    });

    // 8. Update session timestamp
    await prisma.chatSession.update({
      where: { id: session.id },
      data: { updatedAt: new Date() },
    });

    res.json({ answer, sources, sessionId: session.id });
  } catch (error) {
    console.error("[Chat Controller] Chat error:", error);
    next(error);
  }
};

/**
 * GET /api/chat/sessions
 * Returns the user's chat sessions (most recent first).
 */
const listSessions = async (req, res, next) => {
  try {
    const sessions = await prisma.chatSession.findMany({
      where: { userId: req.user.id },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { messages: true } },
      },
    });

    res.json({ sessions });
  } catch (error) {
    console.error("[Chat Controller] List sessions error:", error);
    next(error);
  }
};

/**
 * POST /api/chat/sessions
 * Body: { title?: string }
 * Creates a new empty chat session.
 */
const createSession = async (req, res, next) => {
  try {
    const { title } = req.body;
    const session = await prisma.chatSession.create({
      data: {
        title: title || "New Chat",
        userId: req.user.id,
      },
    });

    res.status(201).json({ session });
  } catch (error) {
    console.error("[Chat Controller] Create session error:", error);
    next(error);
  }
};

/**
 * GET /api/chat/sessions/:id/messages
 * Returns all messages for a given session.
 */
const getSessionMessages = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verify ownership
    const session = await prisma.chatSession.findFirst({
      where: { id, userId: req.user.id },
    });

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    const messages = await prisma.chatMessage.findMany({
      where: { sessionId: id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        role: true,
        content: true,
        sources: true,
        createdAt: true,
      },
    });

    res.json({ session, messages });
  } catch (error) {
    console.error("[Chat Controller] Get messages error:", error);
    next(error);
  }
};

/**
 * DELETE /api/chat/sessions/:id
 * Deletes a chat session and all its messages.
 */
const deleteSession = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verify ownership
    const session = await prisma.chatSession.findFirst({
      where: { id, userId: req.user.id },
    });

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    await prisma.chatSession.delete({ where: { id } });

    res.json({ message: "Session deleted" });
  } catch (error) {
    console.error("[Chat Controller] Delete session error:", error);
    next(error);
  }
};

module.exports = { chat, listSessions, createSession, getSessionMessages, deleteSession };
