const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

/** GET /api/departments?collegeId=... */
const getAll = async (req, res, next) => {
  try {
    const { collegeId } = req.query;
    const where = collegeId ? { collegeId } : {};

    const departments = await prisma.department.findMany({
      where,
      orderBy: { name: "asc" },
      include: {
        college: { select: { name: true, code: true } },
        _count: { select: { semesters: true } },
      },
    });
    res.json({ departments });
  } catch (error) {
    next(error);
  }
};

/** POST /api/departments — Admin only */
const create = async (req, res, next) => {
  try {
    const { name, code, collegeId } = req.body;
    if (!name || !code || !collegeId) {
      return res
        .status(400)
        .json({ error: "Name, code, and collegeId are required" });
    }

    const department = await prisma.department.create({
      data: { name, code, collegeId },
    });
    res.status(201).json({ department });
  } catch (error) {
    if (error.code === "P2002") {
      return res
        .status(409)
        .json({ error: "Department name or code already exists in this college" });
    }
    next(error);
  }
};

/** DELETE /api/departments/:id — Admin only */
const remove = async (req, res, next) => {
  try {
    await prisma.department.delete({ where: { id: req.params.id } });
    res.json({ message: "Department deleted" });
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Department not found" });
    }
    next(error);
  }
};

module.exports = { getAll, create, remove };
