/**
 * RAG Engine Service
 *
 * Core search & answer generation logic for the RAG pipeline.
 * - semanticSearch: vector similarity search against document_chunks
 * - generateAnswer: LLM answer generation using retrieved context
 */

const { PrismaClient } = require("@prisma/client");
const { GoogleGenAI } = require("@google/genai");
const Groq = require("groq-sdk");
const { embedText } = require("./embeddings");

const prisma = new PrismaClient();

// Lazy-init LLM clients
let geminiClient = null;
let groqClient = null;

function getGeminiClient() {
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return geminiClient;
}

function getGroqClient() {
  if (!groqClient) {
    groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return groqClient;
}

/**
 * Perform semantic (vector similarity) search against document_chunks.
 *
 * @param {string} queryText - The user's search query
 * @param {object} options
 * @param {string} [options.collegeId] - Filter by college
 * @param {string} [options.departmentId] - Filter by department
 * @param {string} [options.semesterId] - Filter by semester
 * @param {number} [options.limit] - Max results (default 10)
 * @returns {Promise<Array>} Matched chunks with resource metadata
 */
async function semanticSearch(queryText, { collegeId, departmentId, semesterId, limit = 10 } = {}) {
  // 1. Expand the query with academic context to improve embedding relevance
  const expandedQuery = `academic study material: ${queryText}`;
  const queryEmbedding = await embedText(expandedQuery);
  const vectorStr = `[${queryEmbedding.join(",")}]`;

  // 2. Build scope filter conditions
  const conditions = [];
  // Fetch more chunks from DB (25) to allow grouping by resource
  const chunkLimit = 25;
  const params = [vectorStr, chunkLimit];
  let paramIndex = 3;

  if (collegeId) {
    conditions.push(`r."collegeId" = $${paramIndex}`);
    params.push(collegeId);
    paramIndex++;
  }
  if (departmentId) {
    conditions.push(`r."departmentId" = $${paramIndex}`);
    params.push(departmentId);
    paramIndex++;
  }
  if (semesterId) {
    conditions.push(`r."semesterId" = $${paramIndex}`);
    params.push(semesterId);
    paramIndex++;
  }

  const whereClause = conditions.length > 0
    ? `AND ${conditions.join(" AND ")}`
    : "";

  // 3. Run cosine similarity search with minimum threshold
  const results = await prisma.$queryRawUnsafe(
    `SELECT
       dc.id AS "chunkId",
       dc.content,
       dc."chunkIndex",
       dc."resourceId",
       1 - (dc.embedding <=> $1::vector) AS similarity,
       r.name AS "resourceName",
       r."mimeType",
       r.size,
       r.category,
       r."diskPath",
       r."createdAt" AS "resourceCreatedAt",
       r."collegeId",
       r."departmentId",
       r."semesterId"
     FROM document_chunks dc
     JOIN resources r ON dc."resourceId" = r.id
     WHERE r."classStatus" = 'CLASSIFIED'
       AND 1 - (dc.embedding <=> $1::vector) > 0.35
     ${whereClause}
     ORDER BY dc.embedding <=> $1::vector
     LIMIT $2`,
    ...params
  );

  // Debug logging
  if (results.length > 0) {
    const topScore = parseFloat(results[0]?.similarity || 0);
    const bottomScore = parseFloat(results[results.length - 1]?.similarity || 0);
    console.log(`[RAG Search] Query: "${queryText}" → ${results.length} chunks (similarity: ${(topScore * 100).toFixed(1)}% - ${(bottomScore * 100).toFixed(1)}%)`);
  } else {
    console.log(`[RAG Search] Query: "${queryText}" → 0 chunks above threshold`);
  }

  // 4. Group by resource and return
  const resourceMap = new Map();

  for (const row of results) {
    if (!resourceMap.has(row.resourceId)) {
      resourceMap.set(row.resourceId, {
        resourceId: row.resourceId,
        resourceName: row.resourceName,
        mimeType: row.mimeType,
        size: row.size,
        category: row.category,
        diskPath: row.diskPath,
        createdAt: row.resourceCreatedAt,
        topSimilarity: parseFloat(row.similarity),
        chunks: [],
      });
    }
    resourceMap.get(row.resourceId).chunks.push({
      chunkId: row.chunkId,
      content: row.content,
      chunkIndex: row.chunkIndex,
      similarity: parseFloat(row.similarity),
    });
  }

  // Sort by top similarity and limit to requested number of resources
  return Array.from(resourceMap.values())
    .sort((a, b) => b.topSimilarity - a.topSimilarity)
    .slice(0, limit);
}

/**
 * Generate a conversational answer using retrieved context chunks.
 *
 * @param {string} query - The user's question
 * @param {Array} searchResults - Results from semanticSearch()
 * @param {Array} [chatHistory] - Previous messages in the conversation
 * @returns {Promise<{answer: string, sources: Array}>}
 */
async function generateAnswer(query, searchResults, chatHistory = []) {
  // Build context from top search results
  const contextParts = [];
  const sources = [];

  for (const result of searchResults.slice(0, 5)) {
    const chunkTexts = result.chunks
      .sort((a, b) => a.chunkIndex - b.chunkIndex)
      .map((c) => c.content)
      .join("\n");

    contextParts.push(
      `--- Source: "${result.resourceName}" (${result.category || "Unknown"}) ---\n${chunkTexts}`
    );

    sources.push({
      resourceId: result.resourceId,
      resourceName: result.resourceName,
      similarity: result.topSimilarity,
    });
  }

  const contextBlock = contextParts.join("\n\n");

  const systemPrompt = `You are an intelligent academic assistant for a university resource hub. Students ask you questions about their study materials, and you answer based STRICTLY on the provided document context.

RULES:
1. Answer ONLY based on the provided context. If the context doesn't contain enough information, say so clearly.
2. Be concise, clear, and educational in your responses.
3. Use markdown formatting (headings, bullet points, code blocks) for readability.
4. When referencing information, mention the source document name naturally.
5. If the question is unrelated to academics or the provided context, politely redirect.

DOCUMENT CONTEXT:
${contextBlock}`;

  // Build message history
  const messages = [
    { role: "system", content: systemPrompt },
  ];

  // Add chat history (last 10 messages to stay within context limits)
  for (const msg of chatHistory.slice(-10)) {
    messages.push({
      role: msg.role === "user" ? "user" : "assistant",
      content: msg.content,
    });
  }

  messages.push({ role: "user", content: query });

  // Try Gemini first, fallback to Groq
  let answer;
  try {
    answer = await generateWithGemini(messages);
  } catch (geminiErr) {
    console.warn("[RAG Engine] Gemini failed, falling back to Groq:", geminiErr.message);
    try {
      answer = await generateWithGroq(messages);
    } catch (groqErr) {
      console.error("[RAG Engine] Both providers failed:", groqErr.message);
      answer = "I'm sorry, I'm unable to generate an answer right now. Please try again later.";
    }
  }

  return { answer, sources };
}

/**
 * Generate with Gemini 1.5 Flash.
 */
async function generateWithGemini(messages) {
  const client = getGeminiClient();
  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";

  // Convert messages to Gemini format
  const systemInstruction = messages.find((m) => m.role === "system")?.content || "";
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  const response = await client.models.generateContent({
    model,
    contents,
    config: {
      systemInstruction,
      maxOutputTokens: 2048,
      temperature: 0.3,
    },
  });

  return response.text || "No response generated.";
}

/**
 * Generate with Groq (Llama 3).
 */
async function generateWithGroq(messages) {
  const client = getGroqClient();
  const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

  const response = await client.chat.completions.create({
    model,
    messages,
    temperature: 0.3,
    max_tokens: 2048,
  });

  return response.choices?.[0]?.message?.content || "No response generated.";
}

module.exports = { semanticSearch, generateAnswer };
