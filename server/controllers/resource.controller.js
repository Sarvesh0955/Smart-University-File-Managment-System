const { PrismaClient } = require("@prisma/client");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { addToQueue, getQueueStats } = require("../services/queue.service");
const { addToEmbeddingQueue } = require("../services/rag/embeddingQueue");

const prisma = new PrismaClient();

/**
 * Helper: Calculate SHA-256 hash of a file on disk
 */
function calculateFileHash(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);
    stream.on("error", (err) => reject(err));
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

/**
 * POST /api/resources/upload
 * Multi-file upload. Requires subjectIds, category in body.
 */
const upload = async (req, res, next) => {
  try {
    let { subjectIds, category } = req.body;
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: "No files provided" });
    }
    if (!subjectIds || !category) {
      return res
        .status(400)
        .json({ error: "subjectIds and category are required" });
    }

    if (typeof subjectIds === 'string') {
      try {
        subjectIds = JSON.parse(subjectIds);
      } catch (e) {
        subjectIds = subjectIds.split(',').map(s => s.trim());
      }
    }
    
    if (!Array.isArray(subjectIds) || subjectIds.length === 0) {
      return res.status(400).json({ error: "subjectIds must be a non-empty array" });
    }

    // Validate category
    const validCategories = ["NOTES", "BOOK", "PYQ", "ASSIGNMENT", "LAB", "MISC"];
    if (!validCategories.includes(category.toUpperCase())) {
      return res.status(400).json({ error: "Invalid category" });
    }

    // Lookup first subject to get semester, department, college references
    const subject = await prisma.subject.findUnique({
      where: { id: subjectIds[0] },
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
    let duplicates = 0;
    
    for (const file of files) {
      const filePath = path.join(__dirname, "..", "uploads", file.filename);
      const fileHash = await calculateFileHash(filePath);

      // Check for exact duplicate in DB
      const existing = await prisma.resource.findUnique({
        where: { fileHash },
      });

      if (existing) {
        // Delete the redundant uploaded file from disk
        fs.unlinkSync(filePath);
        duplicates++;
        continue;
      }

      const resource = await prisma.resource.create({
        data: {
          name: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          diskPath: file.filename,
          fileHash,
          category: category.toUpperCase(),
          classStatus: "CLASSIFIED",
          semesterId: subject.semesterId,
          departmentId: subject.departmentId,
          collegeId: subject.department.collegeId,
          uploadedById: req.user.id,
          subjects: {
            connect: subjectIds.map(id => ({ id }))
          }
        },
        include: {
          uploadedBy: { select: { id: true, name: true } },
          subjects: { select: { name: true, code: true } },
        },
      });
      resources.push(resource);

      // Enqueue for RAG embedding (background)
      try {
        await addToEmbeddingQueue(resource.id);
      } catch (embErr) {
        console.warn(`[Upload] Could not enqueue embedding for ${resource.id}:`, embErr.message);
      }
    }

    let message = `${resources.length} file(s) uploaded successfully.`;
    if (duplicates > 0) {
      message += ` ${duplicates} duplicate(s) were skipped.`;
    }

    res.status(201).json({
      message,
      resources,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/resources/auto-upload
 * Bulk upload files for AI auto-sorting.
 * Files are saved immediately with PENDING status and enqueued for background classification.
 */
const autoUpload = async (req, res, next) => {
  try {
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: "No files provided" });
    }

    const resources = [];
    let duplicates = 0;

    for (const file of files) {
      const filePath = path.join(__dirname, "..", "uploads", file.filename);
      const fileHash = await calculateFileHash(filePath);

      // Check for exact duplicate in DB
      const existing = await prisma.resource.findUnique({
        where: { fileHash },
      });

      if (existing) {
        // Delete the redundant uploaded file from disk
        fs.unlinkSync(filePath);
        duplicates++;
        continue;
      }

      const resource = await prisma.resource.create({
        data: {
          name: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          diskPath: file.filename,
          fileHash,
          category: null,
          classStatus: "PENDING",
          aiConfidence: null,
          semesterId: null,
          departmentId: null,
          collegeId: null,
          uploadedById: req.user.id,
        },
      });
      resources.push(resource);

      // Add to background classification queue
      await addToQueue(resource.id);

      // Enqueue for RAG embedding (background)
      try {
        await addToEmbeddingQueue(resource.id);
      } catch (embErr) {
        console.warn(`[AutoUpload] Could not enqueue embedding for ${resource.id}:`, embErr.message);
      }
    }

    let message = `${resources.length} file(s) uploaded and queued for AI classification.`;
    if (duplicates > 0) {
      message += ` ${duplicates} duplicate(s) were skipped.`;
    }

    res.status(201).json({
      message,
      resources,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/resources/pending-review
 * Fetch files that need manual review (PENDING or NEEDS_REVIEW).
 */
const listPendingReview = async (req, res, next) => {
  try {
    const { status } = req.query;

    const where = {};

    // Admins see all, others see only their own
    if (req.user.role !== "ADMIN") {
      where.uploadedById = req.user.id;
    }

    if (status === "PENDING") {
      where.classStatus = "PENDING";
    } else if (status === "NEEDS_REVIEW") {
      where.classStatus = "NEEDS_REVIEW";
    } else {
      where.classStatus = { in: ["PENDING", "NEEDS_REVIEW"] };
    }

    const resources = await prisma.resource.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        uploadedBy: { select: { id: true, name: true } },
        subjects: { select: { id: true, name: true, code: true } },
      },
    });

    // Get queue stats
    let queueStats = { waiting: 0, active: 0, completed: 0, failed: 0 };
    try {
      queueStats = await getQueueStats();
    } catch (e) {
      // Redis might not be available
    }

    res.json({ resources, queueStats });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/resources/auto-history
 * Fetch files that were automatically classified by AI or manually classified via Auto-Sort.
 */
const listAutoSortHistory = async (req, res, next) => {
  try {
    const where = {
      classStatus: "CLASSIFIED",
      aiConfidence: { not: null },
    };

    if (req.user.role !== "ADMIN") {
      where.uploadedById = req.user.id;
    }

    const resources = await prisma.resource.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        uploadedBy: { select: { id: true, name: true } },
        subjects: { select: { id: true, name: true, code: true } },
      },
    });

    res.json({ resources });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/resources/:id/classify
 * Manually classify a file that the AI couldn't handle.
 */
const manualClassify = async (req, res, next) => {
  try {
    let { subjectIds, category } = req.body;

    if (!subjectIds || !category) {
      return res.status(400).json({ error: "subjectIds and category are required" });
    }

    if (typeof subjectIds === 'string') {
      try { subjectIds = JSON.parse(subjectIds); }
      catch (e) { subjectIds = subjectIds.split(',').map(s => s.trim()); }
    }

    const validCategories = ["NOTES", "BOOK", "PYQ", "ASSIGNMENT", "LAB", "MISC"];
    if (!validCategories.includes(category.toUpperCase())) {
      return res.status(400).json({ error: "Invalid category" });
    }

    const resource = await prisma.resource.findUnique({
      where: { id: req.params.id },
    });

    if (!resource) {
      return res.status(404).json({ error: "Resource not found" });
    }

    if (req.user.role !== "ADMIN" && resource.uploadedById !== req.user.id) {
      return res.status(403).json({ error: "You can only classify your own uploads" });
    }

    const subject = await prisma.subject.findUnique({
      where: { id: subjectIds[0] },
      include: { department: true },
    });

    if (!subject) {
      return res.status(404).json({ error: "Subject not found" });
    }

    const updated = await prisma.resource.update({
      where: { id: req.params.id },
      data: {
        classStatus: "CLASSIFIED",
        category: category.toUpperCase(),
        semesterId: subject.semesterId,
        departmentId: subject.departmentId,
        collegeId: subject.department.collegeId,
        subjects: {
          set: subjectIds.map(id => ({ id })),
        },
      },
      include: {
        subjects: { select: { name: true, code: true } },
      },
    });

    res.json({ message: "File classified successfully", resource: updated });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/resources
 * List resources with filtering & sorting.
 */
const list = async (req, res, next) => {
  try {
    const { subjectId, category, sort = "createdAt", order = "desc" } = req.query;

    const where = {
      classStatus: "CLASSIFIED",
    };
    if (subjectId) {
      where.subjects = { some: { id: subjectId } };
    }
    if (category) where.category = category.toUpperCase();

    const validSorts = ["name", "createdAt", "size"];
    const sortField = validSorts.includes(sort) ? sort : "createdAt";
    const sortOrder = order === "asc" ? "asc" : "desc";

    const resources = await prisma.resource.findMany({
      where,
      orderBy: { [sortField]: sortOrder },
      include: {
        uploadedBy: { select: { id: true, name: true } },
        subjects: { select: { name: true, code: true } },
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
        classStatus: "CLASSIFIED",
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        uploadedBy: { select: { id: true, name: true } },
        subjects: { select: { name: true, code: true } },
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
 */
const getOne = async (req, res, next) => {
  try {
    const resource = await prisma.resource.findUnique({
      where: { id: req.params.id },
      include: {
        uploadedBy: { select: { id: true, name: true } },
        subjects: { select: { name: true, code: true } },
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
 */
const move = async (req, res, next) => {
  try {
    let { subjectIds, category } = req.body;
    if (!subjectIds && !category) {
      return res
        .status(400)
        .json({ error: "Provide subjectIds and/or category to move to" });
    }

    const resource = await prisma.resource.findUnique({
      where: { id: req.params.id },
    });

    if (!resource) {
      return res.status(404).json({ error: "Resource not found" });
    }

    if (req.user.role === "SENIOR" && resource.uploadedById !== req.user.id) {
      return res.status(403).json({ error: "You can only move your own uploads" });
    }

    const updateData = {};

    if (category) {
      updateData.category = category.toUpperCase();
    }

    if (subjectIds) {
      if (typeof subjectIds === 'string') {
        try { subjectIds = JSON.parse(subjectIds); }
        catch (e) { subjectIds = subjectIds.split(',').map(s => s.trim()); }
      }
      const subject = await prisma.subject.findUnique({
        where: { id: subjectIds[0] },
        include: { department: true },
      });

      if (!subject) {
        return res.status(404).json({ error: "Target subject not found" });
      }

      updateData.semesterId = subject.semesterId;
      updateData.departmentId = subject.departmentId;
      updateData.collegeId = subject.department.collegeId;
      
      updateData.subjects = {
        set: subjectIds.map(id => ({ id }))
      };
    }

    const updated = await prisma.resource.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        subjects: { select: { name: true } },
      },
    });

    res.json({ message: "File moved", resource: updated });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/resources/:id
 */
const remove = async (req, res, next) => {
  try {
    const resource = await prisma.resource.findUnique({
      where: { id: req.params.id },
    });

    if (!resource) {
      return res.status(404).json({ error: "Resource not found" });
    }

    if (req.user.role === "SENIOR" && resource.uploadedById !== req.user.id) {
      return res
        .status(403)
        .json({ error: "You can only delete your own uploads" });
    }

    const filePath = path.join(__dirname, "..", "uploads", resource.diskPath);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await prisma.resource.delete({ where: { id: req.params.id } });

    res.json({ message: "File deleted permanently" });
  } catch (error) {
    next(error);
  }
};

module.exports = { upload, autoUpload, list, search, getOne, download, rename, move, remove, listPendingReview, manualClassify, listAutoSortHistory };
