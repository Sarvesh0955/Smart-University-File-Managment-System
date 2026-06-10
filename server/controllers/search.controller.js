/**
 * Search Controller
 *
 * Handles semantic (smart) search requests.
 */

const { semanticSearch } = require("../services/rag/ragEngine");

/**
 * GET /api/search/smart?q=...
 * Semantic search — finds resources by content meaning, not just filename.
 */
const smartSearch = async (req, res, next) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length === 0) {
      return res.status(400).json({ error: "Search query is required" });
    }

    // Scope search to the user's college/department/semester if set
    const scope = {
      collegeId: req.user.collegeId || undefined,
      departmentId: req.user.departmentId || undefined,
      semesterId: req.user.semesterId || undefined,
      limit: 15,
    };

    const results = await semanticSearch(q.trim(), scope);

    res.json({ results });
  } catch (error) {
    console.error("[Search Controller] Smart search error:", error);
    next(error);
  }
};

module.exports = { smartSearch };
