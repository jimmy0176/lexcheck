import { extractAttachmentText } from "@/lib/extract-attachment-text";
import { splitTextIntoChunks } from "@/lib/quick-exam-chunk";
import { QUICK_EXAM_CHUNK_TARGET_CHARS } from "@/lib/quick-exam-constants";

export type PreliminaryFileBody = { fileName: string; text: string };

/**
 * 读取「三方速查」preliminary 附件全文（不做长度截断）。
 */
export async function loadPreliminaryAttachmentBodies(
  attachments: Array<{ fileName: string; storagePath: string }>
): Promise<PreliminaryFileBody[]> {
  const out: PreliminaryFileBody[] = [];
  for (const att of attachments) {
    try {
      const body = await extractAttachmentText(att.storagePath);
      out.push({ fileName: att.fileName, text: body });
    } catch {
      out.push({ fileName: att.fileName, text: `（无法解析该文件文本：${att.fileName}）` });
    }
  }
  return out;
}

export function buildPreliminaryFullNarrative(files: PreliminaryFileBody[]): string {
  if (files.length === 0) return "（三方速查暂无上传文件）";
  return files.map((f) => `【${f.fileName}】\n${f.text}`).join("\n\n---\n\n");
}

export type PlannedPreliminaryChunk = {
  globalIndex: number;
  fileName: string;
  chunkIndexInFile: number;
  text: string;
};

export type PreliminaryFileChunkStats = { fileName: string; chunkCount: number; chunked: boolean };

/**
 * 按文件分块，生成带全局序号的切块计划（算法确定，便于异步续跑时重复计算）。
 */
export function buildPreliminaryChunkPlan(
  files: PreliminaryFileBody[],
  maxCharsPerChunk: number = QUICK_EXAM_CHUNK_TARGET_CHARS
): { planned: PlannedPreliminaryChunk[]; fileStats: PreliminaryFileChunkStats[] } {
  const planned: PlannedPreliminaryChunk[] = [];
  let globalIndex = 0;
  const fileStats: PreliminaryFileChunkStats[] = [];
  for (const f of files) {
    const parts = splitTextIntoChunks(f.text, maxCharsPerChunk);
    const chunks = parts.length > 0 ? parts : [""];
    const chunked = chunks.length > 1;
    fileStats.push({ fileName: f.fileName, chunkCount: chunks.length, chunked });
    let ci = 0;
    for (const text of chunks) {
      planned.push({
        globalIndex: globalIndex++,
        fileName: f.fileName,
        chunkIndexInFile: ci++,
        text,
      });
    }
  }
  return { planned, fileStats };
}
