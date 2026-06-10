/**
 * Text Extractor Service (RAG Pipeline)
 *
 * Dedicated full-text extraction for the RAG pipeline.
 * Unlike the classifier's parser which truncates to 4000 chars,
 * this extracts the COMPLETE text from all file types.
 */

const fs = require("fs");
const path = require("path");

const MIN_TEXT_LENGTH = 50;

/**
 * Detect file type from MIME type and extension.
 */
function detectFileType(mimeType, fileName) {
  const ext = path.extname(fileName).toLowerCase();

  if (mimeType === "application/pdf" || ext === ".pdf") return "pdf";
  if (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "application/msword" ||
    ext === ".docx" ||
    ext === ".doc"
  )
    return "office";
  if (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    mimeType === "application/vnd.ms-powerpoint" ||
    ext === ".pptx" ||
    ext === ".ppt"
  )
    return "office";
  if (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimeType === "application/vnd.ms-excel" ||
    ext === ".xlsx" ||
    ext === ".xls"
  )
    return "office";
  if (mimeType?.startsWith("image/")) return "image";
  if (
    mimeType?.startsWith("text/") ||
    [
      ".txt", ".md", ".csv", ".json", ".js", ".py", ".c", ".cpp",
      ".java", ".ts", ".jsx", ".tsx", ".html", ".css", ".go", ".rs",
      ".rb", ".php", ".sh", ".bat", ".yaml", ".yml", ".xml", ".sql",
      ".r", ".m", ".h", ".hpp",
    ].includes(ext)
  )
    return "text";

  return "unknown";
}

/**
 * Extract full text from a PDF.
 * Falls back to local OCR via tesseract.js for scanned PDFs.
 */
async function extractFromPdf(filePath) {
  try {
    const pdfParse = require("pdf-parse");
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);

    const text = data.text?.trim() || "";
    if (text.length >= MIN_TEXT_LENGTH) {
      console.log(`[RAG TextExtractor] PDF text extracted: ${text.length} chars`);
      return text;
    }

    // Scanned PDF — fall back to local OCR
    console.log(
      `[RAG TextExtractor] PDF text too short (${text.length} chars), using OCR...`
    );
    return await ocrPdfPages(filePath);
  } catch (err) {
    console.error("[RAG TextExtractor] PDF parse error:", err.message);
    return await ocrPdfPages(filePath);
  }
}

/**
 * OCR all pages of a scanned PDF using tesseract.js (local).
 */
async function ocrPdfPages(filePath) {
  try {
    const { fromPath } = require("pdf2pic");
    const { createWorker } = require("tesseract.js");

    const converter = fromPath(filePath, {
      density: 200,
      saveFilename: `ocr_page_${Date.now()}`,
      savePath: path.dirname(filePath),
      format: "png",
      width: 1600,
      height: 2200,
    });

    // Get page count from pdf-parse
    const pdfParse = require("pdf-parse");
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    const pageCount = Math.min(data.numpages || 1, 50); // Cap at 50 pages for sanity

    console.log(
      `[RAG TextExtractor] OCR processing ${pageCount} pages...`
    );

    const worker = await createWorker("eng");
    const allText = [];

    for (let i = 1; i <= pageCount; i++) {
      try {
        const result = await converter(i);
        if (result?.path && fs.existsSync(result.path)) {
          const {
            data: { text },
          } = await worker.recognize(result.path);
          allText.push(text || "");
          // Clean up temp image
          fs.unlinkSync(result.path);
        }
      } catch (pageErr) {
        console.warn(
          `[RAG TextExtractor] OCR failed for page ${i}:`,
          pageErr.message
        );
        break;
      }
    }

    await worker.terminate();

    const combined = allText.join("\n\n");
    console.log(
      `[RAG TextExtractor] OCR complete: ${combined.length} chars from ${allText.length} pages`
    );
    return combined || `[Scanned PDF: ${path.basename(filePath)}] - OCR extraction yielded no text`;
  } catch (err) {
    console.error("[RAG TextExtractor] OCR pipeline failed:", err.message);
    return "";
  }
}

/**
 * Extract full text from Office documents (DOCX, PPTX, XLSX).
 */
async function extractFromOffice(filePath) {
  try {
    const officeparser = require("officeparser");
    const text = await officeparser.parseOfficeAsync(filePath);
    const trimmed = text?.trim() || "";
    console.log(
      `[RAG TextExtractor] Office text extracted: ${trimmed.length} chars`
    );
    return trimmed;
  } catch (err) {
    console.error("[RAG TextExtractor] Office parse error:", err.message);
    return "";
  }
}

/**
 * OCR a single image file using tesseract.js (local).
 */
async function extractFromImage(filePath) {
  try {
    const { createWorker } = require("tesseract.js");
    const worker = await createWorker("eng");
    const {
      data: { text },
    } = await worker.recognize(filePath);
    await worker.terminate();
    console.log(
      `[RAG TextExtractor] Image OCR: ${text.length} chars`
    );
    return text?.trim() || "";
  } catch (err) {
    console.error("[RAG TextExtractor] Image OCR error:", err.message);
    return "";
  }
}

/**
 * Read a plain text / code file.
 */
function extractFromText(filePath) {
  try {
    const text = fs.readFileSync(filePath, "utf-8");
    console.log(
      `[RAG TextExtractor] Text file read: ${text.length} chars`
    );
    return text;
  } catch (err) {
    console.error("[RAG TextExtractor] Text read error:", err.message);
    return "";
  }
}

/**
 * Main entry point: extract FULL text from any supported file.
 *
 * @param {string} filePath - Absolute path to the file on disk
 * @param {string} mimeType - MIME type of the file
 * @param {string} fileName - Original filename
 * @returns {Promise<string>} Full extracted text
 */
async function extractFullText(filePath, mimeType, fileName) {
  const fileType = detectFileType(mimeType, fileName);

  console.log(
    `[RAG TextExtractor] Extracting full text from "${fileName}" (type: ${fileType})`
  );

  switch (fileType) {
    case "pdf":
      return await extractFromPdf(filePath);
    case "office":
      return await extractFromOffice(filePath);
    case "image":
      return await extractFromImage(filePath);
    case "text":
      return extractFromText(filePath);
    default:
      console.warn(
        `[RAG TextExtractor] Unsupported file type: ${fileType} for "${fileName}"`
      );
      return "";
  }
}

module.exports = { extractFullText };
