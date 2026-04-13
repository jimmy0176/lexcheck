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
    const parsed = await mammoth.extractRawText({ path: filePath });
    const normalized = normalizeText(parsed.value || "");
    return truncateForPrompt(normalized, MAX_EXTRACTED_CHARS);
  }
  if (ext === ".doc") {
    return "暂不支持自动解析 .doc（建议转为 .docx 后上传）。";
  }
  return "该文件类型暂不支持文本提取。";
}
