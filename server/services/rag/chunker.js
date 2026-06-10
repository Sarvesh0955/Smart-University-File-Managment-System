/**
 * Chunker Service (RAG Pipeline)
 *
 * Splits extracted full text into overlapping chunks suitable
 * for embedding and vector storage.
 *
 * Uses paragraph-aware splitting: preserves document structure
 * by splitting on paragraph boundaries first, then merging
 * small paragraphs into chunks up to the size limit.
 */

const DEFAULT_CHUNK_SIZE = 800;
const DEFAULT_OVERLAP = 150;

/**
 * Split text into overlapping, paragraph-aware chunks.
 *
 * @param {string} text - The full text to chunk
 * @param {object} options
 * @param {number} options.size - Target chunk size in characters (default 800)
 * @param {number} options.overlap - Overlap between chunks in characters (default 150)
 * @returns {string[]} Array of text chunks
 */
function chunkText(text, { size = DEFAULT_CHUNK_SIZE, overlap = DEFAULT_OVERLAP } = {}) {
  if (!text || typeof text !== "string") return [];

  const trimmed = text.trim();
  if (trimmed.length === 0) return [];
  if (trimmed.length <= size) return [cleanChunk(trimmed)];

  // Step 1: Split into paragraphs (preserve meaningful structure)
  const paragraphs = splitIntoParagraphs(trimmed);

  if (paragraphs.length === 0) return [];

  // Step 2: Merge small paragraphs into chunks up to the size limit
  const chunks = [];
  let currentChunk = "";

  for (const para of paragraphs) {
    const cleaned = cleanChunk(para);
    if (!cleaned) continue;

    // If this paragraph alone exceeds chunk size, split it further
    if (cleaned.length > size) {
      // Flush current chunk first
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
        // Keep overlap from end of current chunk
        currentChunk = getOverlapText(currentChunk, overlap);
      }

      // Split the large paragraph by sentences
      const subChunks = splitLargeParagraph(cleaned, size, overlap);
      chunks.push(...subChunks.slice(0, -1));
      // Keep the last sub-chunk as the start of the next chunk
      currentChunk = subChunks[subChunks.length - 1] || "";
      continue;
    }

    // Would adding this paragraph exceed the chunk size?
    const combined = currentChunk
      ? currentChunk + "\n\n" + cleaned
      : cleaned;

    if (combined.length > size && currentChunk.trim()) {
      // Flush current chunk
      chunks.push(currentChunk.trim());
      // Start new chunk with overlap from previous + current paragraph
      const overlapText = getOverlapText(currentChunk, overlap);
      currentChunk = overlapText ? overlapText + "\n\n" + cleaned : cleaned;
    } else {
      currentChunk = combined;
    }
  }

  // Don't forget the last chunk
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  // Filter out chunks that are too short to be useful
  return chunks.filter((c) => c.length >= 30);
}

/**
 * Split text into paragraphs based on double-newlines or significant whitespace.
 */
function splitIntoParagraphs(text) {
  // Split on double+ newlines (paragraph breaks)
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/**
 * Split a large paragraph into smaller chunks by sentence boundaries.
 */
function splitLargeParagraph(text, size, overlap) {
  // Split by sentence-ending punctuation
  const sentences = text.match(/[^.!?\n]+[.!?\n]+|[^.!?\n]+$/g) || [text];
  const chunks = [];
  let current = "";

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    if (!trimmedSentence) continue;

    const combined = current ? current + " " + trimmedSentence : trimmedSentence;

    if (combined.length > size && current) {
      chunks.push(current.trim());
      // Overlap: keep the tail of the previous chunk
      const overlapText = getOverlapText(current, overlap);
      current = overlapText ? overlapText + " " + trimmedSentence : trimmedSentence;
    } else {
      current = combined;
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks;
}

/**
 * Get the last N characters of text, breaking at a word boundary.
 */
function getOverlapText(text, overlapSize) {
  if (!text || overlapSize <= 0) return "";
  if (text.length <= overlapSize) return text;

  const tail = text.substring(text.length - overlapSize);
  // Try to break at a word boundary
  const spaceIdx = tail.indexOf(" ");
  return spaceIdx > 0 ? tail.substring(spaceIdx + 1) : tail;
}

/**
 * Clean up a chunk: normalize internal whitespace without destroying structure.
 */
function cleanChunk(text) {
  return text
    .replace(/[ \t]+/g, " ")     // Collapse horizontal whitespace only
    .replace(/\n{3,}/g, "\n\n")  // Max 2 consecutive newlines
    .trim();
}

module.exports = { chunkText, DEFAULT_CHUNK_SIZE, DEFAULT_OVERLAP };
