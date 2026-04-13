import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

export const MAX_ATTACHMENT_FILES = 3;
export const MAX_ATTACHMENT_SIZE_BYTES = 20 * 1024 * 1024;

const ALLOWED_EXTS = new Set([".pdf", ".doc", ".docx"]);
const ALLOWED_MIME_PREFIX = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export function getAttachmentsBaseDir() {
  return path.join(process.cwd(), "uploads", "checkups");
}

export function sanitizeFileName(name: string) {
  return name.replace(/[^\w.\-\u4e00-\u9fa5]/g, "_").slice(0, 160);
}

export function validateUploadFile(file: File) {
  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED_EXTS.has(ext)) {
    return `不支持的文件类型：${file.name}`;
  }
  if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
    return `文件过大（>${Math.round(MAX_ATTACHMENT_SIZE_BYTES / 1024 / 1024)}MB）：${file.name}`;
  }
  if (file.type && !ALLOWED_MIME_PREFIX.some((x) => file.type.startsWith(x))) {
    return `文件 MIME 类型不支持：${file.name}`;
  }
  return null;
}

export async function saveUploadFile(
  token: string,
  file: File
): Promise<{ storagePath: string; safeName: string; ext: string | null }> {
  const ext = path.extname(file.name).toLowerCase();
  const safeName = sanitizeFileName(path.basename(file.name, ext));
  const timestamp = Date.now();
  const finalName = `${timestamp}-${safeName}${ext}`;
  const baseDir = getAttachmentsBaseDir();
  const targetDir = path.join(baseDir, token);
  await mkdir(targetDir, { recursive: true });
  const targetPath = path.join(targetDir, finalName);
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(targetPath, buf);
  return { storagePath: targetPath, safeName: finalName, ext: ext || null };
}

export function truncateForPrompt(text: string, maxChars: number) {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}…（已截断）`;
}
