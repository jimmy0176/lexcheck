import path from "node:path";
import { pathToFileURL } from "node:url";
import { readFile } from "node:fs/promises";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { truncateForPrompt } from "./checkup-attachments";

const MAX_EXTRACTED_CHARS = 100000;

/**
 * pdfjs-dist 默认用相对路径 "./pdf.worker.mjs" 动态 import worker，
 * 在 Turbopack 打包后的 chunk 里找不到实际文件会报错；显式指到 node_modules 里的真实文件绕过这个问题。
 */
let pdfWorkerConfigured = false;
function ensurePdfWorkerConfigured() {
  if (pdfWorkerConfigured) return;
  pdfWorkerConfigured = true;
  const workerPath = path.join(
    process.cwd(),
    "node_modules",
    "pdf-parse",
    "dist",
    "pdf-parse",
    "esm",
    "pdf.worker.mjs"
  );
  PDFParse.setWorker(pathToFileURL(workerPath).href);
}

function normalizeText(raw: string) {
  return raw.replace(/\r/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export type ExtractedAttachmentText = {
  text: string;
  /** 原文超出 MAX_EXTRACTED_CHARS、被截断丢弃了尾部内容 */
  truncated: boolean;
  /** 截断前的完整字符数；未截断时等于 text.length（不含"…（已截断）"这类提示后缀） */
  originalLength: number;
};

function buildResult(normalized: string): ExtractedAttachmentText {
  const truncated = normalized.length > MAX_EXTRACTED_CHARS;
  return {
    text: truncateForPrompt(normalized, MAX_EXTRACTED_CHARS),
    truncated,
    originalLength: normalized.length,
  };
}

export async function extractAttachmentText(filePath: string): Promise<ExtractedAttachmentText> {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".pdf") {
    ensurePdfWorkerConfigured();
    const buf = await readFile(filePath);
    const parser = new PDFParse({ data: buf });
    const parsed = await parser.getText();
    await parser.destroy();
    return buildResult(normalizeText(parsed.text || ""));
  }
  if (ext === ".docx") {
    const buf = await readFile(filePath);
    let extracted = "";
    try {
      const parsed = await mammoth.extractRawText({ buffer: buf });
      extracted = parsed.value || "";
    } catch {
      extracted = "";
    }
    // 某些 Office/WPS 文档 rawText 可能接近空值，降级为 HTML 文本剥离
    if (!extracted.trim()) {
      try {
        const html = await mammoth.convertToHtml({ buffer: buf });
        extracted = html.value.replace(/<[^>]+>/g, " ");
      } catch {
        extracted = "";
      }
    }
    return buildResult(normalizeText(extracted));
  }
  if (ext === ".doc") {
    return { text: "暂不支持自动解析 .doc（建议转为 .docx 后上传）。", truncated: false, originalLength: 0 };
  }
  return { text: "该文件类型暂不支持文本提取。", truncated: false, originalLength: 0 };
}
