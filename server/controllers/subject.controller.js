const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

/** GET /api/subjects?semesterId=... */
const getAll = async (req, res, next) => {
  try {
    const { semesterId, departmentId } = req.query;
    const where = {};
    if (semesterId) where.semesterId = semesterId;
    if (departmentId) where.departmentId = departmentId;

    const subjects = await prisma.subject.findMany({
      where,
      orderBy: { name: "asc" },
      include: {
        semester: { select: { number: true } },
        department: { select: { name: true, code: true } },
        _count: { select: { resources: true } },
      },
    });
    res.json({ subjects });
  } catch (error) {
    next(error);
  }
};

/** POST /api/subjects — Admin only */
const create = async (req, res, next) => {
  try {
    const { name, code, semesterId, departmentId } = req.body;
    if (!name || !code || !semesterId || !departmentId) {
      return res
        .status(400)
        .json({ error: "Name, code, semesterId, and departmentId are required" });
    }

    const subject = await prisma.subject.create({
      data: { name, code, semesterId, departmentId },
    });
    res.status(201).json({ subject });
  } catch (error) {
    next(error);
  }
};

/** DELETE /api/subjects/:id — Admin only */
const remove = async (req, res, next) => {
  try {
    await prisma.subject.delete({ where: { id: req.params.id } });
    res.json({ message: "Subject deleted" });
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Subject not found" });
    }
    next(error);
  }
};

module.exports = { getAll, create, remove };
