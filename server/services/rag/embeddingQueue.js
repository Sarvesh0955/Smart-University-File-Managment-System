/**
 * Embedding Queue Service (RAG Pipeline)
 *
 * A dedicated BullMQ queue for background document embedding.
 * Completely separate from the existing classification queue.
 *
 * Flow:
 * 1. Resource is uploaded → addToEmbeddingQueue(resourceId)
 * 2. Worker picks up the job
 * 3. Extracts full text → chunks it → embeds locally → saves to DB
 */

const { Queue, Worker } = require("bullmq");
const IORedis = require("ioredis");
const path = require("path");
const { PrismaClient } = require("@prisma/client");
const { extractFullText } = require("./textExtractor");
const { chunkText } = require("./chunker");
const { embedBatch } = require("./embeddings");

const prisma = new PrismaClient();

let connection = null;
let embeddingQueue = null;
let worker = null;

/**
 * Get or create the Redis connection for the embedding queue.
 */
function getConnection() {
  if (!connection) {
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
    connection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
    });
    connection.on("error", (err) => {
      console.error("[RAG Queue] Redis connection error:", err.message || err);
    });
  }
  return connection;
}

/**
 * Get or create the embedding queue.
 */
function getQueue() {
  if (!embeddingQueue) {
    embeddingQueue = new Queue("document-embedding", {
      connection: getConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
        removeOnComplete: { count: 200 },
        removeOnFail: { count: 100 },
      },
    });
    console.log("[RAG Queue] Embedding queue created");
  }
  return embeddingQueue;
}

/**
 * Add a resource to the embedding queue.
 * @param {string} resourceId - Database ID of the Resource to embed
 */
async function addToEmbeddingQueue(resourceId) {
  const queue = getQueue();
  await queue.add(
    "embed",
    { resourceId },
    { delay: 2000 } // Slight delay to let the file finish writing to disk
  );
  console.log(`[RAG Queue] Added resource ${resourceId} to embedding queue`);
}

/**
 * Process a single embedding job.
 */
async function processEmbeddingJob(job) {
  const { resourceId } = job.data;
  console.log(`[RAG Worker] Processing embedding for resource: ${resourceId}`);

  // 1. Fetch the resource from DB (with subjects for metadata)
  const resource = await prisma.resource.findUnique({
    where: { id: resourceId },
    include: { subjects: { select: { name: true } } },
  });

  if (!resource) {
    console.warn(`[RAG Worker] Resource ${resourceId} not found, skipping`);
    return { status: "skipped", reason: "not_found" };
  }

  // 2. Check if chunks already exist (avoid re-processing)
  const existingChunks = await prisma.documentChunk.count({
    where: { resourceId },
  });

  if (existingChunks > 0) {
    console.log(`[RAG Worker] Resource ${resourceId} already has ${existingChunks} chunks, skipping`);
    return { status: "skipped", reason: "already_embedded" };
  }

  // 3. Extract full text
  const filePath = path.join(__dirname, "..", "..", "uploads", resource.diskPath);
  const fullText = await extractFullText(filePath, resource.mimeType, resource.name);

  if (!fullText || fullText.trim().length < 20) {
    console.warn(`[RAG Worker] No meaningful text extracted from "${resource.name}"`);
    return { status: "skipped", reason: "no_text" };
  }

  // 4. Chunk the text
  const chunks = chunkText(fullText);
  console.log(`[RAG Worker] "${resource.name}" → ${chunks.length} chunks`);

  if (chunks.length === 0) {
    return { status: "skipped", reason: "no_chunks" };
  }

  // 5. Build metadata prefix for embedding context
  // This helps the embedding model associate chunks with their source document
  const subjectNames = resource.subjects.map((s) => s.name).join(", ");
  const metaParts = [`Document: "${resource.name}"`];
  if (resource.category) metaParts.push(`Category: ${resource.category}`);
  if (subjectNames) metaParts.push(`Subject: ${subjectNames}`);
  const metaPrefix = metaParts.join(" | ") + "\n---\n";

  // 6. Create prefixed versions for embedding (but store original text in DB)
  const textsForEmbedding = chunks.map((chunk) => metaPrefix + chunk);

  // 7. Generate embeddings locally (using prefixed text)
  const embeddings = await embedBatch(textsForEmbedding);
  console.log(`[RAG Worker] Generated ${embeddings.length} embeddings for "${resource.name}"`);

  // 8. Batch-insert into document_chunks using raw SQL
  // Store the ORIGINAL chunk text (not prefixed) so retrieved context is clean
  for (let i = 0; i < chunks.length; i++) {
    const vectorStr = `[${embeddings[i].join(",")}]`;
    await prisma.$executeRawUnsafe(
      `INSERT INTO document_chunks (id, "resourceId", content, "chunkIndex", embedding, "createdAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4::vector, NOW())`,
      resourceId,
      chunks[i],
      i,
      vectorStr
    );
  }

  console.log(`[RAG Worker] ✅ Saved ${chunks.length} chunks for "${resource.name}"`);

  return {
    status: "embedded",
    chunksCreated: chunks.length,
    textLength: fullText.length,
  };
}

/**
 * Start the embedding worker.
 * Should be called once on server startup.
 */
function startEmbeddingWorker() {
  if (worker) {
    console.log("[RAG Worker] Embedding worker already running");
    return;
  }

  worker = new Worker("document-embedding", processEmbeddingJob, {
    connection: getConnection(),
    concurrency: 1, // Process one at a time (CPU-bound embedding)
  });

  worker.on("completed", (job, result) => {
    console.log(`[RAG Worker] Job ${job.id} completed:`, result);
  });

  worker.on("failed", (job, err) => {
    console.error(`[RAG Worker] Job ${job?.id} failed:`, err?.message || err);
  });

  worker.on("error", (err) => {
    console.error("[RAG Worker] Worker error:", err?.message || err);
  });

  console.log("[RAG Worker] Embedding worker started (concurrency: 1)");
}

module.exports = { addToEmbeddingQueue, startEmbeddingWorker };
