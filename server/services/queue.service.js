const { Queue, Worker } = require("bullmq");
const IORedis = require("ioredis");
const path = require("path");
const { PrismaClient } = require("@prisma/client");
const { extractContent } = require("./parser.service");
const { classify } = require("./classifier.service");

const prisma = new PrismaClient();

/**
 * Queue Service
 * 
 * Manages background document classification using BullMQ.
 * - Files are added to the queue on auto-upload.
 * - A single worker processes jobs one at a time (rate-limit friendly).
 * - Classified files are updated in the database.
 * - Low-confidence files are marked NEEDS_REVIEW.
 */

const VALID_CATEGORIES = ["NOTES", "BOOK", "PYQ", "ASSIGNMENT", "LAB", "MISC"];
const CONFIDENCE_THRESHOLD = parseInt(process.env.AI_CONFIDENCE_THRESHOLD || "80", 10);

let connection = null;
let classificationQueue = null;
let worker = null;

/**
 * Get or create the Redis connection.
 */
function getConnection() {
  if (!connection) {
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
    connection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null, // Required by BullMQ
    });
    connection.on("error", (err) => {
      console.error("[Queue] Redis connection error:", err.message || err);
    });
    connection.on("connect", () => {
      console.log("[Queue] Connected to Redis");
    });
  }
  return connection;
}

/**
 * Get or create the classification queue.
 */
function getQueue() {
  if (!classificationQueue) {
    classificationQueue = new Queue("document-classification", {
      connection: getConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
      },
    });
    console.log("[Queue] Classification queue created");
  }
  return classificationQueue;
}

/**
 * Add a resource to the classification queue.
 * @param {string} resourceId - database ID of the Resource to classify
 */
async function addToQueue(resourceId) {
  const queue = getQueue();
  await queue.add(
    "classify",
    { resourceId },
    {
      // Slight delay between jobs to respect API rate limits
      delay: 1000,
    }
  );
  console.log(`[Queue] Added resource ${resourceId} to classification queue`);
}

/**
 * Process a single classification job.
 */
async function processClassificationJob(job) {
  const { resourceId } = job.data;
  console.log(`[Worker] Processing classification for resource: ${resourceId}`);

  // 1. Fetch the resource from DB
  const resource = await prisma.resource.findUnique({
    where: { id: resourceId },
    include: { uploadedBy: true },
  });

  if (!resource) {
    console.warn(`[Worker] Resource ${resourceId} not found, skipping`);
    return { status: "skipped", reason: "not_found" };
  }

  if (resource.classStatus === "CLASSIFIED") {
    console.log(`[Worker] Resource ${resourceId} already classified, skipping`);
    return { status: "skipped", reason: "already_classified" };
  }

  // 2. Fetch all available subjects from the database (scoped to the user's college if possible)
  const subjectFilter = resource.uploadedBy?.collegeId
    ? { department: { collegeId: resource.uploadedBy.collegeId } }
    : {};

  const subjects = await prisma.subject.findMany({
    where: subjectFilter,
    include: {
      semester: true,
      department: true,
    },
  });

  if (subjects.length === 0) {
    console.warn(`[Worker] No subjects found for classification, marking NEEDS_REVIEW`);
    await prisma.resource.update({
      where: { id: resourceId },
      data: { classStatus: "NEEDS_REVIEW", aiConfidence: 0 },
    });
    return { status: "needs_review", reason: "no_subjects" };
  }

  // 3. Extract content from the file
  const filePath = path.join(__dirname, "..", "uploads", resource.diskPath);
  const extractedContent = await extractContent(filePath, resource.mimeType, resource.name);

  // 4. Classify using LLM
  const subjectsForLLM = subjects.map(s => ({
    id: s.id,
    name: s.name,
    code: s.code,
    semesterNumber: s.semester.number,
    departmentName: s.department.name,
  }));

  let classification;
  try {
    classification = await classify(resource.name, extractedContent, subjectsForLLM, VALID_CATEGORIES);
  } catch (err) {
    console.error(`[Worker] Classification failed for ${resourceId}:`, err.message);
    await prisma.resource.update({
      where: { id: resourceId },
      data: { classStatus: "NEEDS_REVIEW", aiConfidence: 0 },
    });
    return { status: "needs_review", reason: "ai_error" };
  }

  // 5. Validate the classified subject IDs actually exist
  const matchedSubjects = subjects.filter(s => classification.subjectIds.includes(s.id));

  if (matchedSubjects.length === 0) {
    console.warn(`[Worker] LLM returned unknown subjectIds: ${classification.subjectIds}`);
    await prisma.resource.update({
      where: { id: resourceId },
      data: {
        classStatus: "NEEDS_REVIEW",
        aiConfidence: classification.confidence,
      },
    });
    return { status: "needs_review", reason: "invalid_subject" };
  }

  // 6. Check confidence threshold
  if (classification.confidence < CONFIDENCE_THRESHOLD) {
    console.log(`[Worker] Low confidence (${classification.confidence}%) for ${resource.name}, marking NEEDS_REVIEW`);
    await prisma.resource.update({
      where: { id: resourceId },
      data: {
        classStatus: "NEEDS_REVIEW",
        aiConfidence: classification.confidence,
        // Store what the AI suggested, but don't assign location
        category: VALID_CATEGORIES.includes(classification.category) ? classification.category : null,
        subjects: {
          connect: matchedSubjects.map(s => ({ id: s.id }))
        }
      },
    });
    return { status: "needs_review", reason: "low_confidence", confidence: classification.confidence };
  }

  // 7. High confidence — assign the file to its location
  // We use the first matched subject's semester/department as the primary location for the file
  const primarySubject = matchedSubjects[0];
  const subjectNames = matchedSubjects.map(s => s.name).join(", ");
  console.log(`[Worker] ✅ Classified "${resource.name}" → ${subjectNames} (${classification.category}) [${classification.confidence}%]`);
  
  await prisma.resource.update({
    where: { id: resourceId },
    data: {
      classStatus: "CLASSIFIED",
      aiConfidence: classification.confidence,
      category: classification.category,
      semesterId: primarySubject.semesterId,
      departmentId: primarySubject.departmentId,
      collegeId: primarySubject.department.collegeId,
      subjects: {
        connect: matchedSubjects.map(s => ({ id: s.id }))
      },
    },
  });

  return {
    status: "classified",
    subjects: matchedSubjects.map(s => s.name),
    category: classification.category,
    confidence: classification.confidence,
    provider: classification.provider,
  };
}

/**
 * Initialize the BullMQ worker.
 * Should be called once on server startup.
 */
function startWorker() {
  if (worker) {
    console.log("[Worker] Worker already running");
    return;
  }

  worker = new Worker("document-classification", processClassificationJob, {
    connection: getConnection(),
    concurrency: 1, // Process one at a time to respect API rate limits
    limiter: {
      max: 5,
      duration: 60000, // max 5 jobs per minute
    },
  });

  worker.on("completed", (job, result) => {
    console.log(`[Worker] Job ${job.id} completed:`, result);
  });

  worker.on("failed", (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed:`, err?.message || err);
  });

  worker.on("error", (err) => {
    console.error("[Worker] Worker error:", err?.message || err);
  });

  console.log("[Worker] Classification worker started (concurrency: 1, rate: 5/min)");
}

/**
 * Get queue statistics for the frontend.
 */
async function getQueueStats() {
  const queue = getQueue();
  const [waiting, active, completed, failed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
  ]);
  return { waiting, active, completed, failed };
}

module.exports = { addToQueue, startWorker, getQueueStats, getQueue };
