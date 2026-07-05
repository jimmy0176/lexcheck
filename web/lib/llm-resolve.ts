import { getProviderById } from "@/lib/llm-providers";
import { callChatCompletions, jsonObjectFormatIfSupported, type ChatMessage } from "@/lib/quick-exam-llm";

export type LlmProfileSource = "own" | "shared" | "backup";

export type LlmProfile = {
  source: LlmProfileSource;
  providerId: string;
  model: string;
  apiKey: string;
  base: string;
};

function toProfile(
  source: LlmProfileSource,
  providerId: string | null | undefined,
  model: string | null | undefined,
  apiKey: string | null | undefined,
  baseUrl: string | null | undefined
): LlmProfile | null {
  const pid = (providerId ?? "").trim();
  const m = (model ?? "").trim();
  const key = (apiKey ?? "").trim();
  if (!pid || !m || !key) return null;
  const provider = getProviderById(pid);
  const base = pid === "custom" ? (baseUrl ?? "").trim() : (provider?.baseUrl ?? "");
  if (!base) return null;
  return { source, providerId: pid, model: m, apiKey: key, base };
}

/** 按优先级返回可用档案：律师本人 -> 管理员共用 -> 管理员共用备用。未配置完整的档案会被跳过。 */
export async function resolveLlmProfiles(lawyerId: string): Promise<LlmProfile[]> {
  const { prisma } = await import("@/lib/prisma");
  const [user, settings] = await Promise.all([
    prisma.user.findUnique({ where: { id: lawyerId } }),
    prisma.authSettings.findUnique({ where: { id: "singleton" } }),
  ]);

  const profiles: LlmProfile[] = [];
  const own =
    user && toProfile("own", user.llmProviderId, user.llmModel, user.llmApiKey, user.llmBaseUrl);
  if (own) profiles.push(own);
  const shared =
    settings &&
    toProfile(
      "shared",
      settings.sharedLlmProviderId,
      settings.sharedLlmModel,
      settings.sharedLlmApiKey,
      settings.sharedLlmBaseUrl
    );
  if (shared) profiles.push(shared);
  const backup =
    settings &&
    toProfile(
      "backup",
      settings.backupLlmProviderId,
      settings.backupLlmModel,
      settings.backupLlmApiKey,
      settings.backupLlmBaseUrl
    );
  if (backup) profiles.push(backup);
  return profiles;
}

export type LlmFallbackResult = { ok: true; text: string; usedSource: LlmProfileSource } | { ok: false };

/** 依次尝试各档案，第一个调用成功的即返回；全部失败时 ok:false，由调用方决定降级方式。 */
export async function callChatCompletionsWithFallback(
  profiles: LlmProfile[],
  args: { messages: ChatMessage[]; temperature?: number; max_tokens?: number; wantJson?: boolean }
): Promise<LlmFallbackResult> {
  for (const p of profiles) {
    try {
      const text = await callChatCompletions({
        base: p.base,
        apiKey: p.apiKey,
        model: p.model,
        messages: args.messages,
        temperature: args.temperature,
        max_tokens: args.max_tokens,
        response_format: args.wantJson ? jsonObjectFormatIfSupported(p.providerId) : undefined,
      });
      return { ok: true, text, usedSource: p.source };
    } catch {
      continue;
    }
  }
  return { ok: false };
}
