const router = require("express").Router();
const auth = require("../middleware/auth");
const requireRole = require("../middleware/role");
const uploadMiddleware = require("../middleware/upload");
const {
  upload,
  autoUpload,
  list,
  search,
  getOne,
  download,
  rename,
  move,
  remove,
  listPendingReview,
  manualClassify,
  listAutoSortHistory,
} = require("../controllers/resource.controller");

// Search must be before /:id to avoid "search" being treated as an ID
router.get("/search", auth, search);

// Pending review list (for auto-sort UI)
router.get("/pending-review", auth, requireRole("SENIOR", "ADMIN"), listPendingReview);

// Auto-sort history
router.get("/auto-history", auth, requireRole("SENIOR", "ADMIN"), listAutoSortHistory);

// List & Get
router.get("/", auth, list);
router.get("/:id", auth, getOne);

// Upload (multi-file) — Senior & Admin only
router.post(
  "/upload",
  auth,
  requireRole("SENIOR", "ADMIN"),
  uploadMiddleware.array("files", 10),
  upload
);

// Auto-Upload (AI sorting) — Senior & Admin only
router.post(
  "/auto-upload",
  auth,
  requireRole("SENIOR", "ADMIN"),
  uploadMiddleware.array("files", 20),
  autoUpload
);

// Manually classify a file (for NEEDS_REVIEW files)
router.patch("/:id/classify", auth, requireRole("SENIOR", "ADMIN"), manualClassify);

// Rename & Move — Senior (own) & Admin
router.patch("/:id/rename", auth, requireRole("SENIOR", "ADMIN"), rename);
router.patch("/:id/move", auth, requireRole("SENIOR", "ADMIN"), move);

// Download — any authenticated user
router.get("/:id/download", auth, download);

// Delete — Senior (own) & Admin (any)
router.delete("/:id", auth, requireRole("SENIOR", "ADMIN"), remove);

module.exports = router;
