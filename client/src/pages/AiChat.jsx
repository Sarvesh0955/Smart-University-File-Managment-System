import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import api from "../utils/api";
import Header from "../components/Layout/Header";
import FilePreview from "../components/FilePreview";

const SUGGESTIONS = [
  { icon: "school", text: "Summarize my notes on Data Structures" },
  { icon: "quiz", text: "What topics are covered in the PYQs?" },
  { icon: "code", text: "Explain the code from the lab manual" },
  { icon: "lightbulb", text: "Key concepts in Operating Systems" },
];

export default function AiChat() {
  // Session state
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Chat state
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Load sessions on mount
  useEffect(() => {
    fetchSessions();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [activeSessionId]);

  const fetchSessions = async () => {
    try {
      setSessionsLoading(true);
      const res = await api.get("/chat/sessions");
      setSessions(res.data.sessions || []);
    } catch (err) {
      console.error("Failed to fetch sessions:", err);
    } finally {
      setSessionsLoading(false);
    }
  };

  const loadSession = async (sessionId) => {
    try {
      setActiveSessionId(sessionId);
      setLoading(true);
      const res = await api.get(`/chat/sessions/${sessionId}/messages`);
      setMessages(
        (res.data.messages || []).map((m) => ({
          role: m.role,
          content: m.content,
          sources: m.sources || [],
        }))
      );
    } catch (err) {
      console.error("Failed to load session:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleNewChat = () => {
    setActiveSessionId(null);
    setMessages([]);
    inputRef.current?.focus();
  };

  const handleDeleteSession = async (e, sessionId) => {
    e.stopPropagation();
    if (!confirm("Delete this conversation?")) return;
    try {
      await api.delete(`/chat/sessions/${sessionId}`);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (activeSessionId === sessionId) {
        handleNewChat();
      }
    } catch (err) {
      console.error("Failed to delete session:", err);
    }
  };

  const handleSend = async (overrideText) => {
    const trimmed = (overrideText || input).trim();
    if (!trimmed || loading) return;

    const userMessage = { role: "user", content: trimmed, sources: [] };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const res = await api.post("/chat", {
        message: trimmed,
        sessionId: activeSessionId || undefined,
      });

      // If this was a new chat, we now have a sessionId
      if (!activeSessionId && res.data.sessionId) {
        setActiveSessionId(res.data.sessionId);
        // Refresh session list to show the new session
        fetchSessions();
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: res.data.answer,
          sources: res.data.sources || [],
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again later.",
          sources: [],
        },
      ]);
      console.error("Chat error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isEmpty = messages.length === 0;

  const formatSessionDate = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <>
      <Header />

      <div className="aichat-layout">
        {/* Session Sidebar */}
        <div className={`aichat-sidebar ${sidebarOpen ? "open" : "closed"}`}>
          <div className="aichat-sidebar-header">
            <button className="aichat-new-chat-btn" onClick={handleNewChat}>
              <span className="material-symbols-outlined">add</span>
              New Chat
            </button>
            <button
              className="btn-icon aichat-sidebar-toggle"
              onClick={() => setSidebarOpen(false)}
              title="Close sidebar"
            >
              <span className="material-symbols-outlined">left_panel_close</span>
            </button>
          </div>

          <div className="aichat-session-list">
            {sessionsLoading && (
              <div className="aichat-session-loading">
                <div className="spinner" style={{ width: 20, height: 20 }} />
              </div>
            )}

            {!sessionsLoading && sessions.length === 0 && (
              <div className="aichat-session-empty">
                <span className="material-symbols-outlined" style={{ fontSize: 28, opacity: 0.4 }}>
                  forum
                </span>
                <p>No conversations yet</p>
              </div>
            )}

            {sessions.map((s) => (
              <button
                key={s.id}
                className={`aichat-session-item ${activeSessionId === s.id ? "active" : ""}`}
                onClick={() => loadSession(s.id)}
              >
                <div className="aichat-session-item-content">
                  <span className="aichat-session-title">{s.title}</span>
                  <span className="aichat-session-meta">
                    {formatSessionDate(s.updatedAt)} · {s._count?.messages || 0} msgs
                  </span>
                </div>
                <button
                  className="aichat-session-delete"
                  onClick={(e) => handleDeleteSession(e, s.id)}
                  title="Delete"
                >
                  <span className="material-symbols-outlined">delete</span>
                </button>
              </button>
            ))}
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="aichat-page">
          {/* Sidebar toggle when closed */}
          {!sidebarOpen && (
            <button
              className="aichat-sidebar-open-btn"
              onClick={() => setSidebarOpen(true)}
              title="Open sidebar"
            >
              <span className="material-symbols-outlined">right_panel_close</span>
            </button>
          )}

          <div className="aichat-container">
            {/* Empty state / Welcome */}
            {isEmpty && !loading && (
              <div className="aichat-welcome">
                <div className="aichat-welcome-icon">
                  <span className="material-symbols-outlined">smart_toy</span>
                </div>
                <h2 className="aichat-welcome-title">AI Study Assistant</h2>
                <p className="aichat-welcome-subtitle">
                  Ask me anything about your uploaded documents — notes, PYQs,
                  assignments, lab manuals, and more.
                </p>

                <div className="aichat-suggestions">
                  {SUGGESTIONS.map((s, i) => (
                    <button
                      key={i}
                      className="aichat-suggestion-chip"
                      onClick={() => handleSend(s.text)}
                    >
                      <span className="material-symbols-outlined">{s.icon}</span>
                      {s.text}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Messages */}
            {!isEmpty && (
              <div className="aichat-messages">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`aichat-msg ${msg.role === "user" ? "user" : "assistant"}`}
                  >
                    {msg.role === "assistant" && (
                      <div className="aichat-msg-avatar">
                        <span className="material-symbols-outlined">smart_toy</span>
                      </div>
                    )}
                    <div className="aichat-msg-bubble">
                      {msg.role === "assistant" ? (
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      ) : (
                        <p>{msg.content}</p>
                      )}

                      {/* Source citations */}
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="aichat-sources">
                          <span className="aichat-sources-label">
                            <span
                              className="material-symbols-outlined"
                              style={{ fontSize: 14 }}
                            >
                              description
                            </span>
                            Sources:
                          </span>
                          {msg.sources.map((src, j) => (
                            <button 
                              key={j} 
                              className="aichat-source-chip"
                              style={{ cursor: src.diskPath ? "pointer" : "default", border: "none", background: "rgba(255, 255, 255, 0.1)", borderRadius: "12px", padding: "4px 10px", fontSize: "12px", color: "var(--color-on-surface)" }}
                              onClick={() => {
                                if (src.diskPath) {
                                  setPreviewFile({
                                    id: src.resourceId,
                                    name: src.resourceName,
                                    mimeType: src.mimeType,
                                    diskPath: src.diskPath,
                                  });
                                }
                              }}
                            >
                              {src.resourceName}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Typing indicator */}
                {loading && messages.length > 0 && (
                  <div className="aichat-msg assistant">
                    <div className="aichat-msg-avatar">
                      <span className="material-symbols-outlined">smart_toy</span>
                    </div>
                    <div className="aichat-msg-bubble">
                      <div className="aichat-typing">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input Bar - pinned to bottom */}
          <div className="aichat-input-bar">
            <div className="aichat-input-wrapper">
              <textarea
                ref={inputRef}
                className="aichat-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your study materials..."
                rows={1}
                disabled={loading}
              />
              <button
                className={`aichat-send-btn ${input.trim() && !loading ? "active" : ""}`}
                onClick={() => handleSend()}
                disabled={!input.trim() || loading}
              >
                <span className="material-symbols-outlined">send</span>
              </button>
            </div>
            <p className="aichat-disclaimer">
              AI answers are based on your uploaded documents. Always verify important information.
            </p>
          </div>
        </div>
      </div>
      
      {/* File Preview Modal */}
      {previewFile && (
        <FilePreview
          resource={previewFile}
          onClose={() => setPreviewFile(null)}
        />
      )}
    </>
  );
}
