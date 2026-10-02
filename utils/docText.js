import path from "path";
import { createRequire } from "module";
import mammoth from "mammoth";
import * as XLSX from "xlsx";

const require = createRequire(import.meta.url);

export const CHAT_UPLOAD_LIMITS = {
  maxFiles: 5,
  maxBytesPerFile: 15 * 1024 * 1024,
  maxCharsPerFile: 12000,
  maxCharsTotal: 40000,
};

const TEXT_EXTENSIONS = new Set([
  ".txt", ".md", ".markdown", ".csv", ".json", ".js", ".jsx", ".ts", ".tsx",
  ".py", ".java", ".c", ".cpp", ".h", ".cs", ".go", ".rs", ".html", ".css",
  ".xml", ".yaml", ".yml", ".log", ".sql",
]);

function truncate(text, max) {
  if (text.length <= max) return { text, truncated: false };
  return { text: text.slice(0, max), truncated: true };
}

async function extractPdf(buffer) {
  const mod = require("pdf-parse");
  // pdf-parse v1 (standard): callable function
  const fn = typeof mod === "function" ? mod : mod?.default;
  if (typeof fn === "function") {
    const data = await fn(buffer);
    return String(data.text || "");
  }
  // pdf-parse v2 fallback
  if (mod && mod.PDFParse) {
    const parser = new mod.PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return String(result.text || "");
    } finally {
      try {
        await parser.destroy();
      } catch {
        // ignore cleanup errors
      }
    }
  }
  throw new Error("PDF parser could not be initialized.");
}

async function extractDocx(buffer) {
  const result = await mammoth.extractRawText({ buffer });
  return String(result.value || "");
}

function extractSpreadsheet(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const parts = [];
  for (const sheetName of workbook.SheetNames.slice(0, 10)) {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    if (csv.trim()) parts.push(`--- Sheet: ${sheetName} ---\n${csv}`);
  }
  return parts.join("\n");
}

export async function extractDocumentText(file) {
  const ext = path.extname(file.originalname || "").toLowerCase();
  const mime = file.mimetype || "";

  if (mime.startsWith("image/")) {
    return { kind: "image", text: "" };
  }
  if (mime === "application/pdf" || ext === ".pdf") {
    return { kind: "document", text: await extractPdf(file.buffer) };
  }
  if (
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    ext === ".docx"
  ) {
    return { kind: "document", text: await extractDocx(file.buffer) };
  }
  if (mime === "application/msword" || ext === ".doc") {
    throw new Error(`"${file.originalname}" is an old .doc file. Please re-save it as .docx and retry.`);
  }
  if (
    mime.includes("spreadsheet") ||
    mime.includes("excel") ||
    [".xlsx", ".xls", ".csv"].includes(ext)
  ) {
    return { kind: "document", text: extractSpreadsheet(file.buffer) };
  }
  if (mime.startsWith("text/") || mime === "application/json" || TEXT_EXTENSIONS.has(ext)) {
    return { kind: "document", text: file.buffer.toString("utf-8") };
  }
  if (
    mime === "application/vnd.ms-powerpoint" ||
    mime === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    [".ppt", ".pptx"].includes(ext)
  ) {
    throw new Error(`"${file.originalname}" is a presentation. Please export it as PDF and retry.`);
  }
  throw new Error(`"${file.originalname}" (${mime || ext || "unknown type"}) is not supported.`);
}

export function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
