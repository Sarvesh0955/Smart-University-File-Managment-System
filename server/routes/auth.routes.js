const router = require("express").Router();
const auth = require("../middleware/auth");
const requireRole = require("../middleware/role");
const {
  register,
  login,
  getMe,
  getPending,
  approveUser,
  rejectUser,
  updateProfile,
} = require("../controllers/auth.controller");

// Public routes
router.post("/register", register);
router.post("/login", login);

// Protected routes
router.get("/me", auth, getMe);
router.patch("/profile", auth, updateProfile);

// Admin-only routes
router.get("/pending", auth, requireRole("ADMIN"), getPending);
router.patch("/approve/:id", auth, requireRole("ADMIN"), approveUser);
router.delete("/reject/:id", auth, requireRole("ADMIN"), rejectUser);

module.exports = router;
