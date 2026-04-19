import type { PreliminaryChunkSummary } from "@/lib/quick-exam-preliminary-summary-types";
import { normalizeChunkSummary } from "@/lib/quick-exam-preliminary-summary-types";

const JSON_OBJECT_CAPABLE_PROVIDERS = new Set([
  "dashscope",
  "deepseek",
  "zhipu",
  "moonshot",
]);

/**
 * 是否对 chat/completions 使用 `response_format: { type: "json_object" }`（OpenAI 兼容）。
 * 自定义 Base URL 默认关闭，避免未知网关报错。
 */
export function quickExamLlmSupportsJsonObject(providerId: string): boolean {
  if (process.env.QUICK_EXAM_FORCE_JSON_OBJECT === "1") return true;
  if (process.env.QUICK_EXAM_DISABLE_JSON_OBJECT === "1") return false;
  return JSON_OBJECT_CAPABLE_PROVIDERS.has(providerId);
}

export function extractFirstJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) {
        esc = false;
        continue;
      }
      if (c === "\\") {
        esc = true;
        continue;
      }
      if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') {
      inStr = true;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

export function parseJsonLenient(raw: string): unknown {
  const t = raw.trim();
  const fenced = t.match(/^```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1].trim() : t;
  try {
    return JSON.parse(body);
  } catch {
    const sub = extractFirstJsonObject(body);
    if (sub) return JSON.parse(sub);
    throw new Error("无法解析为 JSON");
  }
}

export function parsePreliminaryChunkSummaryJson(
  raw: string,
  sourceFileName: string,
  chunkIndex: number
): PreliminaryChunkSummary {
  const parsed = parseJsonLenient(raw);
  return normalizeChunkSummary(parsed, sourceFileName, chunkIndex);
}
