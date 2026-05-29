const fs = require("fs");
const path = require("path");

/**
 * Parser Service
 * 
 * Multi-format text extraction with image fallback strategy:
 * 1. Try to extract raw text from the file (PDF, DOCX, PPTX, XLSX, plain text).
 * 2. If text extraction yields < MIN_TEXT_LENGTH characters (e.g., scanned PDF),
 *    fall back to converting the first few pages to images for multimodal LLM input.
 */

const MIN_TEXT_LENGTH = 50; // minimum chars to consider text extraction successful

/**
 * Detect file type category from mime type and extension.
 */
function detectFileType(mimeType, fileName) {
  const ext = path.extname(fileName).toLowerCase();
  
  if (mimeType === "application/pdf" || ext === ".pdf") return "pdf";
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "application/msword" ||
    ext === ".docx" || ext === ".doc"
  ) return "docx";
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    mimeType === "application/vnd.ms-powerpoint" ||
    ext === ".pptx" || ext === ".ppt"
  ) return "pptx";
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimeType === "application/vnd.ms-excel" ||
    ext === ".xlsx" || ext === ".xls"
  ) return "xlsx";
  if (mimeType?.startsWith("image/")) return "image";
  if (mimeType?.startsWith("text/") || [".txt", ".md", ".csv", ".json", ".js", ".py", ".c", ".cpp", ".java"].includes(ext)) return "text";
  
  return "unknown";
}

/**
 * Extract text from a PDF file.
 * Falls back to returning image buffers if text is insufficient.
 */
async function extractFromPdf(filePath) {
  try {
    const pdfParse = require("pdf-parse");
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    
    const text = data.text?.trim() || "";
    if (text.length >= MIN_TEXT_LENGTH) {
      // Truncate to ~4000 chars (first 2 pages worth) for LLM context
      return { type: "text", content: text.substring(0, 4000) };
    }
    
    // Text extraction failed (scanned PDF) — fall back to images
    console.log(`[Parser] PDF text too short (${text.length} chars), falling back to image extraction`);
    return await extractPdfAsImages(filePath);
  } catch (err) {
    console.error("[Parser] PDF parse error:", err.message);
    // Try image fallback
    return await extractPdfAsImages(filePath);
  }
}

/**
 * Convert first 2-3 pages of a PDF to image buffers for multimodal LLM.
 */
async function extractPdfAsImages(filePath) {
  try {
    const { fromPath } = require("pdf2pic");
    const converter = fromPath(filePath, {
      density: 150,
      saveFilename: "page",
      savePath: path.dirname(filePath),
      format: "png",
      width: 1200,
      height: 1600,
    });

    const images = [];
    const pagesToConvert = Math.min(3, 3); // first 3 pages

    for (let i = 1; i <= pagesToConvert; i++) {
      try {
        const result = await converter(i);
        if (result?.path && fs.existsSync(result.path)) {
          const imageBuffer = fs.readFileSync(result.path);
          images.push({
            buffer: imageBuffer,
            mimeType: "image/png",
          });
          // Clean up temp image
          fs.unlinkSync(result.path);
        }
      } catch (pageErr) {
        // Page might not exist if PDF has fewer pages
        break;
      }
    }

    if (images.length > 0) {
      return { type: "image", content: images };
    }

    // Complete failure — return filename-only hint
    return { type: "text", content: `[File: ${path.basename(filePath)}] - Could not extract content` };
  } catch (err) {
    console.error("[Parser] PDF to image conversion failed:", err.message);
    return { type: "text", content: `[File: ${path.basename(filePath)}] - Could not extract content` };
  }
}

/**
 * Extract text from Office documents (DOCX, PPTX, XLSX) using officeparser.
 */
async function extractFromOffice(filePath) {
  try {
    const officeparser = require("officeparser");
    const text = await officeparser.parseOfficeAsync(filePath);
    
    const trimmed = text?.trim() || "";
    if (trimmed.length >= MIN_TEXT_LENGTH) {
      return { type: "text", content: trimmed.substring(0, 4000) };
    }
    
    return { type: "text", content: `[File: ${path.basename(filePath)}] - Minimal text content extracted` };
  } catch (err) {
    console.error("[Parser] Office parse error:", err.message);
    return { type: "text", content: `[File: ${path.basename(filePath)}] - Could not extract content` };
  }
}

/**
 * Read an image file as a buffer for multimodal LLM input.
 */
async function extractFromImage(filePath, mimeType) {
  try {
    const imageBuffer = fs.readFileSync(filePath);
    return {
      type: "image",
      content: [{ buffer: imageBuffer, mimeType: mimeType || "image/png" }],
    };
  } catch (err) {
    console.error("[Parser] Image read error:", err.message);
    return { type: "text", content: `[Image file: ${path.basename(filePath)}]` };
  }
}

/**
 * Read a plain text file.
 */
async function extractFromText(filePath) {
  try {
    const text = fs.readFileSync(filePath, "utf-8");
    return { type: "text", content: text.substring(0, 4000) };
  } catch (err) {
    console.error("[Parser] Text read error:", err.message);
    return { type: "text", content: `[File: ${path.basename(filePath)}]` };
  }
}

/**
 * Main entry point: extract content from any supported file.
 * 
 * @param {string} filePath - Absolute path to the file on disk
 * @param {string} mimeType - MIME type of the file
 * @param {string} fileName - Original filename
 * @returns {{ type: 'text' | 'image', content: string | Array<{buffer: Buffer, mimeType: string}> }}
 */
async function extractContent(filePath, mimeType, fileName) {
  const fileType = detectFileType(mimeType, fileName);
  
  console.log(`[Parser] Extracting content from "${fileName}" (type: ${fileType})`);
  
  switch (fileType) {
    case "pdf":
      return await extractFromPdf(filePath);
    case "docx":
    case "pptx":
    case "xlsx":
      return await extractFromOffice(filePath);
    case "image":
      return await extractFromImage(filePath, mimeType);
    case "text":
      return await extractFromText(filePath);
    default:
      // For unknown file types, just provide the filename as context
      return { type: "text", content: `[Unknown file type: ${fileName}] - No content could be extracted` };
  }
}

module.exports = { extractContent, detectFileType };
