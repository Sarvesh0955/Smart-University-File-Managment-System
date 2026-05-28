const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

/** GET /api/colleges */
const getAll = async (req, res, next) => {
  try {
    const colleges = await prisma.college.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { departments: true } } },
    });
    res.json({ colleges });
  } catch (error) {
    next(error);
  }
};

/** POST /api/colleges — Admin only */
const create = async (req, res, next) => {
  try {
    const { name, code } = req.body;
    if (!name || !code) {
      return res.status(400).json({ error: "Name and code are required" });
    }

    const college = await prisma.college.create({ data: { name, code } });
    res.status(201).json({ college });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({ error: "College name or code already exists" });
    }
    next(error);
  }
};

/** DELETE /api/colleges/:id — Admin only */
const remove = async (req, res, next) => {
  try {
    await prisma.college.delete({ where: { id: req.params.id } });
    res.json({ message: "College deleted" });
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "College not found" });
    }
    next(error);
  }
};

module.exports = { getAll, create, remove };
