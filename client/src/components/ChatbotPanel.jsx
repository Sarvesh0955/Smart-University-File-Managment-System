import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import api from "../utils/api";

export default function ChatbotPanel({ onClose }) {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Hi! I'm your AI study assistant. Ask me anything about your uploaded documents — notes, PYQs, assignments, and more. 📚",
      sources: [],
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMessage = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      // Build chat history (exclude the initial greeting)
      const history = messages
        .filter((m, i) => i > 0)
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await api.post("/chat", {
        message: trimmed,
        history,
      });

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
          content:
            "Sorry, I encountered an error. Please try again later.",
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

  return (
    <div className="chatbot-panel">
      {/* Header */}
      <div className="chatbot-header">
        <div className="chatbot-header-info">
          <div className="chatbot-avatar">
            <span className="material-symbols-outlined">smart_toy</span>
          </div>
          <div>
            <h3 className="chatbot-title">AI Study Assistant</h3>
            <span className="chatbot-subtitle">Powered by RAG</span>
          </div>
        </div>
        <button className="btn-icon" onClick={onClose} title="Close panel">
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>

      {/* Messages */}
      <div className="chatbot-messages">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`chatbot-message ${msg.role === "user" ? "user" : "assistant"}`}
          >
            {msg.role === "assistant" && (
              <div className="chatbot-message-avatar">
                <span className="material-symbols-outlined">smart_toy</span>
              </div>
            )}
            <div className="chatbot-message-content">
              {msg.role === "assistant" ? (
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              ) : (
                <p>{msg.content}</p>
              )}

              {/* Source citations */}
              {msg.sources && msg.sources.length > 0 && (
                <div className="chatbot-sources">
                  <span className="chatbot-sources-label">
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                      description
                    </span>
                    Sources:
                  </span>
                  {msg.sources.map((src, j) => (
                    <span key={j} className="chatbot-source-chip">
                      {src.resourceName}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div className="chatbot-message assistant">
            <div className="chatbot-message-avatar">
              <span className="material-symbols-outlined">smart_toy</span>
            </div>
            <div className="chatbot-message-content">
              <div className="chatbot-typing">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="chatbot-input-area">
        <textarea
          ref={inputRef}
          className="chatbot-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your study materials..."
          rows={1}
          disabled={loading}
        />
        <button
          className={`chatbot-send-btn ${input.trim() && !loading ? "active" : ""}`}
          onClick={handleSend}
          disabled={!input.trim() || loading}
        >
          <span className="material-symbols-outlined">send</span>
        </button>
      </div>
    </div>
  );
}
