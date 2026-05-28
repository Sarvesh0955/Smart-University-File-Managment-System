const router = require("express").Router();
const auth = require("../middleware/auth");
const requireRole = require("../middleware/role");
const { getAll, create, remove } = require("../controllers/semester.controller");

router.get("/", auth, getAll);
router.post("/", auth, requireRole("ADMIN"), create);
router.delete("/:id", auth, requireRole("ADMIN"), remove);

module.exports = router;
