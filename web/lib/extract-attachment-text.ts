import path from "node:path";
import { readFile } from "node:fs/promises";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { truncateForPrompt } from "./checkup-attachments";

const MAX_EXTRACTED_CHARS = 24000;

function normalizeText(raw: string) {
  return raw.replace(/\r/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export async function extractAttachmentText(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".pdf") {
    const buf = await readFile(filePath);
    const parser = new PDFParse({ data: buf });
    const parsed = await parser.getText();
    await parser.destroy();
    const normalized = normalizeText(parsed.text || "");
    return truncateForPrompt(normalized, MAX_EXTRACTED_CHARS);
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
    const normalized = normalizeText(extracted);
    return truncateForPrompt(normalized, MAX_EXTRACTED_CHARS);
  }
  if (ext === ".doc") {
    return "暂不支持自动解析 .doc（建议转为 .docx 后上传）。";
  }
  return "该文件类型暂不支持文本提取。";
}
