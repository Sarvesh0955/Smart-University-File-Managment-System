const { GoogleGenAI } = require("@google/genai");
const Groq = require("groq-sdk");

/**
 * Classifier Service
 * 
 * Uses LLMs (Gemini first, Grok fallback) to classify academic documents.
 * Accepts either extracted text or image buffers for multimodal classification.
 * Returns: { category, subjectId, confidence }
 */

// Initialize clients lazily
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
 * Build the classification prompt.
 * @param {string} fileName - original file name
 * @param {string} textContent - extracted text (if available)
 * @param {Array} subjects - array of { id, name, code, semester, department }
 * @param {Array} categories - valid category enum values
 */
function buildPrompt(fileName, textContent, subjects, categories) {
  const subjectList = subjects.map(s => 
    `  - ID: "${s.id}" | Name: "${s.name}" | Code: "${s.code}" | Semester: ${s.semesterNumber} | Department: "${s.departmentName}"`
  ).join("\n");

  return `You are an expert academic document classifier for a university resource management system.

TASK: Classify the following document into one of the available Subjects AND one of the available Categories.

FILE NAME: "${fileName}"

${textContent ? `DOCUMENT CONTENT (first few pages):
---
${textContent}
---` : "NOTE: The document content is provided as images attached to this message. Analyze the images to classify the document."}

AVAILABLE CATEGORIES:
${categories.map(c => `  - ${c}`).join("\n")}

Category descriptions:
  - NOTES: Lecture notes, class notes, handwritten/typed study notes
  - BOOK: Textbooks, reference books, book chapters
  - PYQ: Previous Year Question papers, exam papers, test papers, midterm/endterm papers
  - ASSIGNMENT: Homework, assignments, problem sets, tutorials
  - LAB: Lab manuals, lab reports, practical files, experiment records
  - MISC: Any document that doesn't fit above categories

AVAILABLE SUBJECTS:
${subjectList}

INSTRUCTIONS:
1. Analyze the file name and content carefully.
2. Match the document to the MOST RELEVANT subject from the list above. If the document covers topics that clearly belong to multiple subjects, provide an array of all relevant subject IDs.
3. Determine the document category.
4. Provide a confidence score (0-100) based on how certain you are about BOTH the subject and category classification.
   - 90-100: Very confident — clear subject codes, exam headers, or explicit mentions
   - 70-89: Fairly confident — topic strongly matches a subject
   - 50-69: Uncertain — could belong to multiple subjects
   - Below 50: Very uncertain — insufficient information to classify

RESPOND WITH ONLY valid JSON (no markdown, no explanation):
{
  "subjectIds": ["<subject ID 1>", "<subject ID 2>"],
  "category": "<one of the categories>",
  "confidence": <number 0-100>,
  "reasoning": "<brief 1-line explanation>"
}`;
}

/**
 * Classify using Gemini API (supports text and multimodal/image input).
 */
async function classifyWithGemini(fileName, extractedContent, subjects, categories) {
  const client = getGeminiClient();
  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";

  const prompt = buildPrompt(
    fileName,
    extractedContent.type === "text" ? extractedContent.content : null,
    subjects,
    categories
  );

  const parts = [{ text: prompt }];

  // If we have images, add them as inline data
  if (extractedContent.type === "image" && Array.isArray(extractedContent.content)) {
    for (const img of extractedContent.content) {
      parts.push({
        inlineData: {
          mimeType: img.mimeType,
          data: img.buffer.toString("base64"),
        },
      });
    }
  }

  const response = await client.models.generateContent({
    model: model,
    contents: [{ role: "user", parts }],
    config: {
      responseMimeType: "application/json",
    },
  });

  const text = response.text || "";
  return parseClassificationResponse(text);
}

/**
 * Classify using Groq API (text-only fallback).
 * Note: Groq currently doesn't support image inputs, so we rely on filename if images-only.
 */
async function classifyWithGroq(fileName, extractedContent, subjects, categories) {
  const client = getGroqClient();
  const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

  // Groq is text-only — if we only have images, provide filename context
  const textContent = extractedContent.type === "text"
    ? extractedContent.content
    : `[This is an image-based document. Only the filename is available for classification: "${fileName}"]`;

  const prompt = buildPrompt(fileName, textContent, subjects, categories);

  const response = await client.chat.completions.create({
    model: model,
    messages: [
      {
        role: "system",
        content: "You are an academic document classifier. Always respond with valid JSON only.",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.1,
    max_tokens: 500,
    response_format: { type: "json_object" },
  });

  const text = response.choices?.[0]?.message?.content || "";
  return parseClassificationResponse(text);
}

/**
 * Parse the JSON response from any LLM.
 */
function parseClassificationResponse(rawText) {
  try {
    // Strip markdown code blocks if present
    let cleaned = rawText.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }
    
    const parsed = JSON.parse(cleaned);
    
    // Handle fallback if it returns single subjectId instead of array
    if (parsed.subjectId && !parsed.subjectIds) {
      parsed.subjectIds = [parsed.subjectId];
    }

    // Validate required fields
    if (!parsed.subjectIds || !Array.isArray(parsed.subjectIds) || parsed.subjectIds.length === 0 || !parsed.category || parsed.confidence === undefined) {
      throw new Error("Missing required fields in LLM response");
    }
    
    return {
      subjectIds: parsed.subjectIds,
      category: parsed.category.toUpperCase(),
      confidence: Math.min(100, Math.max(0, parseInt(parsed.confidence, 10))),
      reasoning: parsed.reasoning || "No reasoning provided",
    };
  } catch (err) {
    console.error("[Classifier] Failed to parse LLM response:", rawText);
    throw new Error(`Failed to parse classification response: ${err.message}`);
  }
}

/**
 * Main classification function with Gemini → Grok fallback.
 * 
 * @param {string} fileName - original file name
 * @param {{ type: 'text'|'image', content: any }} extractedContent - from parser service
 * @param {Array} subjects - available subjects from DB
 * @param {Array} categories - valid category values
 * @returns {{ subjectId, category, confidence, reasoning, provider }}
 */
async function classify(fileName, extractedContent, subjects, categories) {
  // Try Gemini first
  try {
    console.log(`[Classifier] Attempting Gemini classification for "${fileName}"`);
    const result = await classifyWithGemini(fileName, extractedContent, subjects, categories);
    console.log(`[Classifier] Gemini result: ${result.category} → ${result.subjectId} (${result.confidence}%)`);
    return { ...result, provider: "gemini" };
  } catch (geminiErr) {
    console.warn(`[Classifier] Gemini failed for "${fileName}":`, geminiErr.message);
  }

  // Fallback to Grok
  try {
    console.log(`[Classifier] Falling back to Groq for "${fileName}"`);
    const result = await classifyWithGroq(fileName, extractedContent, subjects, categories);
    console.log(`[Classifier] Groq result: ${result.category} → ${result.subjectId} (${result.confidence}%)`);
    return { ...result, provider: "groq" };
  } catch (groqErr) {
    console.error(`[Classifier] Groq also failed for "${fileName}":`, groqErr.message);
    throw new Error(`All AI providers failed for "${fileName}". Gemini error, then Groq error.`);
  }
}

module.exports = { classify };
