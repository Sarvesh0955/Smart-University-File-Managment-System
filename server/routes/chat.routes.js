const express = require("express");
const { authenticate } = require("../middleware/auth");
const {
  chat,
  listSessions,
  createSession,
  getSessionMessages,
  deleteSession,
} = require("../controllers/chat.controller");

const router = express.Router();

// Chat sessions
router.get("/sessions", authenticate, listSessions);
router.post("/sessions", authenticate, createSession);
router.get("/sessions/:id/messages", authenticate, getSessionMessages);
router.delete("/sessions/:id", authenticate, deleteSession);

// Send message (creates session if needed)
router.post("/", authenticate, chat);

module.exports = router;
