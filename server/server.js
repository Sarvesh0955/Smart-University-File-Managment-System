const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const authRoutes = require("./routes/auth.routes");
const collegeRoutes = require("./routes/college.routes");
const departmentRoutes = require("./routes/department.routes");
const semesterRoutes = require("./routes/semester.routes");
const subjectRoutes = require("./routes/subject.routes");
const resourceRoutes = require("./routes/resource.routes");
const searchRoutes = require("./routes/search.routes");
const chatRoutes = require("./routes/chat.routes");

const app = express();

// Middleware
app.use(cors({ origin: process.env.CLIENT_URL || '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static file serving for uploads
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/colleges", collegeRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/semesters", semesterRoutes);
app.use("/api/subjects", subjectRoutes);
app.use("/api/resources", resourceRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/chat", chatRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Server Error:", err);
  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);

  // Start the background classification worker
  try {
    const { startWorker } = require("./services/queue.service");
    startWorker();
    console.log("🤖 AI classification worker initialized");
  } catch (err) {
    console.warn("⚠️  Could not start classification worker (Redis may not be running):", err.message);
  }

  // Start the background embedding worker (RAG pipeline)
  try {
    const { startEmbeddingWorker } = require("./services/rag/embeddingQueue");
    startEmbeddingWorker();
    console.log("🧠 RAG embedding worker initialized");
  } catch (err) {
    console.warn("⚠️  Could not start embedding worker (Redis may not be running):", err.message);
  }
});

