import { NextResponse } from "next/server";
import { getProviderById } from "@/lib/llm-providers";

export const runtime = "nodejs";

type Body = {
  providerId?: string;
  model?: string;
  apiKey?: string;
  /** 覆盖预设 base，用于自定义或调试 */
  baseUrlOverride?: string;
};

function normalizeBase(url: string) {
  return url.trim().replace(/\/+$/, "");
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "请求体无效" }, { status: 400 });
  }

  const providerId = (body.providerId ?? "").trim();
  const model = (body.model ?? "").trim();
  const apiKey = (body.apiKey ?? "").trim();
  const baseOverride = (body.baseUrlOverride ?? "").trim();

  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "请填写 API Key" }, { status: 400 });
  }
  if (!model) {
    return NextResponse.json({ ok: false, error: "请填写模型名称" }, { status: 400 });
  }

  const preset = providerId ? getProviderById(providerId) : undefined;
  const base =
    baseOverride ||
    (preset?.baseUrl ? normalizeBase(preset.baseUrl) : "") ||
    "";

  if (!base) {
    return NextResponse.json(
      { ok: false, error: "请选择供应商并填写 Base URL，或使用「自定义」填写接口地址" },
      { status: 400 }
    );
  }

  const url = `${base}/chat/completions`;
  const started = Date.now();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 35_000);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "User-Agent": "Lexcheck/1.0 (connectivity-test)",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 8,
        temperature: 0,
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    const elapsedMs = Date.now() - started;
    const raw = await res.text();

    if (!res.ok) {
      const snippet = raw.slice(0, 400);
      return NextResponse.json({
        ok: false,
        httpStatus: res.status,
        elapsedMs,
        error: `接口返回异常 HTTP ${res.status}${snippet ? `：${snippet}` : ""}`,
      });
    }

    let hasChoices = false;
    try {
      const parsed = JSON.parse(raw) as { choices?: unknown[] };
      hasChoices = Array.isArray(parsed.choices) && parsed.choices.length > 0;
    } catch {
      return NextResponse.json({
        ok: false,
        elapsedMs,
        error: "响应不是合法 JSON",
      });
    }

    if (!hasChoices) {
      return NextResponse.json({
        ok: false,
        elapsedMs,
        error: "响应中未包含 choices，可能非 OpenAI 兼容格式",
      });
    }

    return NextResponse.json({
      ok: true,
      elapsedMs,
      message: `连通成功，耗时约 ${elapsedMs} ms`,
    });
  } catch (e) {
    const elapsedMs = Date.now() - started;
    const err = e instanceof Error ? e.message : String(e);
    if (err.includes("abort") || err.includes("AbortError")) {
      return NextResponse.json({
        ok: false,
        elapsedMs,
        error: "请求超时（35s），请检查网络或接口地址",
      });
    }
    return NextResponse.json({
      ok: false,
      elapsedMs,
      error: `请求失败：${err}`,
    });
  } finally {
    clearTimeout(timeout);
  }
}
