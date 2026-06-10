const express = require("express");
const { authenticate } = require("../middleware/auth");
const { smartSearch } = require("../controllers/search.controller");

const router = express.Router();

// GET /api/search/smart?q=...
router.get("/smart", authenticate, smartSearch);

module.exports = router;
