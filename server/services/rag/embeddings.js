/**
 * Embeddings Service (RAG Pipeline)
 *
 * Generates vector embeddings 100% locally using Transformers.js.
 * Model: Xenova/all-MiniLM-L6-v2 (384 dimensions)
 * Zero API calls, zero cost, zero rate limits.
 */

let pipeline = null;
let pipelinePromise = null;

/**
 * Lazily load the embedding pipeline (singleton).
 * The model downloads once (~23MB) and stays in memory.
 */
async function getPipeline() {
  if (pipeline) return pipeline;

  // Prevent multiple parallel initializations
  if (pipelinePromise) return pipelinePromise;

  pipelinePromise = (async () => {
    console.log("[RAG Embeddings] Loading local embedding model (first run downloads ~23MB)...");
    const { pipeline: tfPipeline } = await import("@xenova/transformers");
    pipeline = await tfPipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", {
      // Ensure we use the ONNX runtime
      quantized: true,
    });
    console.log("[RAG Embeddings] Embedding model loaded successfully!");
    return pipeline;
  })();

  return pipelinePromise;
}

/**
 * Generate an embedding for a single text string.
 *
 * @param {string} text - Text to embed
 * @returns {Promise<number[]>} 384-dimensional embedding vector
 */
async function embedText(text) {
  const extractor = await getPipeline();
  const output = await extractor(text, { pooling: "mean", normalize: true });
  return Array.from(output.data);
}

/**
 * Generate embeddings for an array of texts (batch processing).
 *
 * @param {string[]} texts - Array of texts to embed
 * @returns {Promise<number[][]>} Array of 384-dimensional embedding vectors
 */
async function embedBatch(texts) {
  if (!texts || texts.length === 0) return [];

  const extractor = await getPipeline();
  const results = [];

  // Process in small batches to avoid memory issues with large documents
  const BATCH_SIZE = 32;
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    for (const text of batch) {
      const output = await extractor(text, { pooling: "mean", normalize: true });
      results.push(Array.from(output.data));
    }

    if (i + BATCH_SIZE < texts.length) {
      console.log(`[RAG Embeddings] Embedded ${Math.min(i + BATCH_SIZE, texts.length)}/${texts.length} chunks...`);
    }
  }

  return results;
}

module.exports = { embedText, embedBatch, getPipeline };
