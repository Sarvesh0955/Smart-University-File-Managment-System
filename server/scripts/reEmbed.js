/**
 * Re-Embed Script
 *
 * Finds all classified resources that have 0 document chunks
 * and adds them to the embedding queue for processing.
 *
 * Usage: node scripts/reEmbed.js
 *
 * Requires Redis to be running.
 */

const { PrismaClient } = require("@prisma/client");
const { addToEmbeddingQueue } = require("../services/rag/embeddingQueue");

const prisma = new PrismaClient();

async function main() {
  console.log("[Re-Embed] Finding resources with no embeddings...\n");

  // Find classified resources with 0 chunks
  const resources = await prisma.resource.findMany({
    where: {
      classStatus: "CLASSIFIED",
      chunks: { none: {} },
    },
    select: {
      id: true,
      name: true,
      mimeType: true,
      category: true,
    },
  });

  if (resources.length === 0) {
    console.log("[Re-Embed] All resources already have embeddings. Nothing to do.");
    await prisma.$disconnect();
    process.exit(0);
  }

  console.log(`[Re-Embed] Found ${resources.length} resources without embeddings:\n`);
  for (const r of resources) {
    console.log(`  • ${r.name} (${r.category || "uncategorized"}) [${r.mimeType}]`);
  }

  console.log(`\n[Re-Embed] Adding ${resources.length} resources to embedding queue...\n`);

  let queued = 0;
  for (const r of resources) {
    try {
      await addToEmbeddingQueue(r.id);
      queued++;
    } catch (err) {
      console.error(`  ✗ Failed to queue "${r.name}":`, err.message);
    }
  }

  console.log(`\n[Re-Embed] ✅ Queued ${queued}/${resources.length} resources for embedding.`);
  console.log("[Re-Embed] The embedding worker will process them in the background.");
  console.log("[Re-Embed] Watch server logs for progress.\n");

  await prisma.$disconnect();

  // Give BullMQ a moment to flush the queue messages to Redis
  setTimeout(() => process.exit(0), 2000);
}

main().catch((err) => {
  console.error("[Re-Embed] Fatal error:", err);
  process.exit(1);
});
