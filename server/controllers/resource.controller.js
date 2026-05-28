const { PrismaClient } = require("@prisma/client");
const path = require("path");
const fs = require("fs");

const prisma = new PrismaClient();

/**
 * POST /api/resources/upload
 * Multi-file upload. Requires subjectId, category in body.
 */
const upload = async (req, res, next) => {
  try {
    const { subjectId, category } = req.body;
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: "No files provided" });
    }
    if (!subjectId || !category) {
      return res
        .status(400)
        .json({ error: "subjectId and category are required" });
    }

    // Validate category
    const validCategories = [
      "NOTES",
      "PYQS",
      "LAB_MANUALS",
      "ASSIGNMENTS",
      "REFERENCE",
    ];
    if (!validCategories.includes(category.toUpperCase())) {
      return res.status(400).json({ error: "Invalid category" });
    }

    // Lookup subject to get semester, department, college references
    const subject = await prisma.subject.findUnique({
      where: { id: subjectId },
      include: {
        semester: true,
        department: { include: { college: true } },
      },
    });

    if (!subject) {
      return res.status(404).json({ error: "Subject not found" });
    }

    // Create resource records for each uploaded file
    const resources = [];
    for (const file of files) {
      const resource = await prisma.resource.create({
        data: {
          name: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          diskPath: file.filename,
          category: category.toUpperCase(),
          subjectId: subject.id,
          semesterId: subject.semesterId,
          departmentId: subject.departmentId,
          collegeId: subject.department.collegeId,
          uploadedById: req.user.id,
        },
        include: {
          uploadedBy: { select: { id: true, name: true } },
        },
      });
      resources.push(resource);
    }

    res.status(201).json({
      message: `${resources.length} file(s) uploaded successfully`,
      resources,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/resources
 * List resources with filtering & sorting.
 * Query params: subjectId, category, sort (name|createdAt|size), order (asc|desc)
 */
const list = async (req, res, next) => {
  try {
    const { subjectId, category, sort = "createdAt", order = "desc" } = req.query;

    const where = {};
    if (subjectId) where.subjectId = subjectId;
    if (category) where.category = category.toUpperCase();

    // Validate sort field
    const validSorts = ["name", "createdAt", "size"];
    const sortField = validSorts.includes(sort) ? sort : "createdAt";
    const sortOrder = order === "asc" ? "asc" : "desc";

    const resources = await prisma.resource.findMany({
      where,
      orderBy: { [sortField]: sortOrder },
      include: {
        uploadedBy: { select: { id: true, name: true } },
        subject: { select: { name: true, code: true } },
        semester: { select: { number: true } },
        department: { select: { name: true, code: true } },
        college: { select: { name: true } },
      },
    });

    res.json({ resources });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/resources/search?q=...
 * Basic ILIKE search on file name.
 */
const search = async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length === 0) {
      return res.status(400).json({ error: "Search query is required" });
    }

    const resources = await prisma.resource.findMany({
      where: {
        name: { contains: q, mode: "insensitive" },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        uploadedBy: { select: { id: true, name: true } },
        subject: { select: { name: true, code: true } },
        semester: { select: { number: true } },
        department: { select: { name: true, code: true } },
        college: { select: { name: true } },
      },
    });

    res.json({ resources });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/resources/:id
 * Get a single resource's metadata
 */
const getOne = async (req, res, next) => {
  try {
    const resource = await prisma.resource.findUnique({
      where: { id: req.params.id },
      include: {
        uploadedBy: { select: { id: true, name: true } },
        subject: { select: { name: true, code: true } },
        semester: { select: { number: true } },
        department: { select: { name: true, code: true } },
        college: { select: { name: true } },
      },
    });

    if (!resource) {
      return res.status(404).json({ error: "Resource not found" });
    }

    res.json({ resource });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/resources/:id/download
 * Download file binary.
 */
const download = async (req, res, next) => {
  try {
    const resource = await prisma.resource.findUnique({
      where: { id: req.params.id },
    });

    if (!resource) {
      return res.status(404).json({ error: "Resource not found" });
    }

    const filePath = path.join(__dirname, "..", "uploads", resource.diskPath);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found on disk" });
    }

    res.download(filePath, resource.name);
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/resources/:id/rename
 * Rename a file. Senior can rename own, Admin can rename any.
 */
const rename = async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: "New name is required" });
    }

    const resource = await prisma.resource.findUnique({
      where: { id: req.params.id },
    });

    if (!resource) {
      return res.status(404).json({ error: "Resource not found" });
    }

    // Permission check: Senior can only rename own uploads
    if (req.user.role === "SENIOR" && resource.uploadedById !== req.user.id) {
      return res.status(403).json({ error: "You can only rename your own uploads" });
    }

    const updated = await prisma.resource.update({
      where: { id: req.params.id },
      data: { name },
    });

    res.json({ message: "File renamed", resource: updated });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/resources/:id/move
 * Move a file to a different subject/category.
 */
const move = async (req, res, next) => {
  try {
    const { subjectId, category } = req.body;
    if (!subjectId && !category) {
      return res
        .status(400)
        .json({ error: "Provide subjectId and/or category to move to" });
    }

    const resource = await prisma.resource.findUnique({
      where: { id: req.params.id },
    });

    if (!resource) {
      return res.status(404).json({ error: "Resource not found" });
    }

    // Permission check
    if (req.user.role === "SENIOR" && resource.uploadedById !== req.user.id) {
      return res.status(403).json({ error: "You can only move your own uploads" });
    }

    const updateData = {};

    if (category) {
      updateData.category = category.toUpperCase();
    }

    if (subjectId) {
      // Lookup the target subject to get its parent references
      const subject = await prisma.subject.findUnique({
        where: { id: subjectId },
        include: { department: true },
      });

      if (!subject) {
        return res.status(404).json({ error: "Target subject not found" });
      }

      updateData.subjectId = subject.id;
      updateData.semesterId = subject.semesterId;
      updateData.departmentId = subject.departmentId;
      updateData.collegeId = subject.department.collegeId;
    }

    const updated = await prisma.resource.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        subject: { select: { name: true } },
      },
    });

    res.json({ message: "File moved", resource: updated });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/resources/:id
 * Hard delete: remove from DB + disk.
 * Senior can delete own, Admin can delete any.
 */
const remove = async (req, res, next) => {
  try {
    const resource = await prisma.resource.findUnique({
      where: { id: req.params.id },
    });

    if (!resource) {
      return res.status(404).json({ error: "Resource not found" });
    }

    // Permission check
    if (req.user.role === "SENIOR" && resource.uploadedById !== req.user.id) {
      return res
        .status(403)
        .json({ error: "You can only delete your own uploads" });
    }

    // Delete from disk
    const filePath = path.join(__dirname, "..", "uploads", resource.diskPath);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Delete from DB
    await prisma.resource.delete({ where: { id: req.params.id } });

    res.json({ message: "File deleted permanently" });
  } catch (error) {
    next(error);
  }
};

module.exports = { upload, list, search, getOne, download, rename, move, remove };
