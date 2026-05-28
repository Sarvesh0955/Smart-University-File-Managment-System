const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

/** GET /api/semesters?departmentId=... */
const getAll = async (req, res, next) => {
  try {
    const { departmentId } = req.query;
    const where = departmentId ? { departmentId } : {};

    const semesters = await prisma.semester.findMany({
      where,
      orderBy: { number: "asc" },
      include: {
        department: { select: { name: true, code: true } },
        _count: { select: { subjects: true } },
      },
    });
    res.json({ semesters });
  } catch (error) {
    next(error);
  }
};

/** POST /api/semesters — Admin only */
const create = async (req, res, next) => {
  try {
    const { number, departmentId } = req.body;
    if (!number || !departmentId) {
      return res
        .status(400)
        .json({ error: "Number and departmentId are required" });
    }

    const semester = await prisma.semester.create({
      data: { number: parseInt(number), departmentId },
    });
    res.status(201).json({ semester });
  } catch (error) {
    if (error.code === "P2002") {
      return res
        .status(409)
        .json({ error: "Semester already exists in this department" });
    }
    next(error);
  }
};

/** DELETE /api/semesters/:id — Admin only */
const remove = async (req, res, next) => {
  try {
    await prisma.semester.delete({ where: { id: req.params.id } });
    res.json({ message: "Semester deleted" });
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Semester not found" });
    }
    next(error);
  }
};

module.exports = { getAll, create, remove };
