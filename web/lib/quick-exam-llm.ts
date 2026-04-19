import { quickExamLlmSupportsJsonObject } from "@/lib/quick-exam-json";

export function normalizeAssistantText(content: unknown): string {
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((x) =>
        x && typeof x === "object" && "text" in x && typeof (x as { text?: unknown }).text === "string"
          ? (x as { text: string }).text
          : ""
      )
      .filter(Boolean)
      .join("\n")
      .trim();
  }
  return "";
}

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export async function callChatCompletions(opts: {
  base: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: "json_object" };
}): Promise<string> {
  const { base, apiKey, model, messages, temperature = 0.2, max_tokens = 4096, response_format } = opts;
  const body: Record<string, unknown> = {
    model,
    messages,
    temperature,
    max_tokens,
  };
  if (response_format) body.response_format = response_format;

  const res = await fetch(`${base.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "User-Agent": "Lexcheck/1.0 (quick-exam-report)",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const rawText = await res.text();
  if (!res.ok) {
    throw new Error(`AI接口异常 HTTP ${res.status}${rawText ? `：${rawText.slice(0, 400)}` : ""}`);
  }
  let parsed: { choices?: Array<{ message?: { content?: unknown } }> } | null = null;
  try {
    parsed = JSON.parse(rawText) as { choices?: Array<{ message?: { content?: unknown } }> };
  } catch {
    throw new Error("AI接口返回非 JSON");
  }
  const text = normalizeAssistantText(parsed?.choices?.[0]?.message?.content);
  if (!text) throw new Error("AI未返回有效正文");
  return text;
}

export function jsonObjectFormatIfSupported(providerId: string): { type: "json_object" } | undefined {
  return quickExamLlmSupportsJsonObject(providerId) ? { type: "json_object" } : undefined;
}
