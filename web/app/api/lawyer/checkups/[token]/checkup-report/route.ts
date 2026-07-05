import { NextResponse } from "next/server";
import { requireLawyerApi } from "@/lib/auth";
import { generateCheckupReport, type ReportGenerationMode } from "@/lib/checkup-report-generate";
import { DEFAULT_PRIORITY_THRESHOLDS, type PriorityThresholds } from "@/lib/checkup-report-assemble";
import { getProviderById } from "@/lib/llm-providers";

export const runtime = "nodejs";
export const maxDuration = 60;

function normalizeBase(url: string) {
  return url.trim().replace(/\/+$/, "");
}

function normalizeThresholds(input: unknown): PriorityThresholds {
  if (!input || typeof input !== "object") return DEFAULT_PRIORITY_THRESHOLDS;
  const t = input as Partial<PriorityThresholds>;
  const low = typeof t.low === "number" ? t.low : DEFAULT_PRIORITY_THRESHOLDS.low;
  const mid = typeof t.mid === "number" ? t.mid : DEFAULT_PRIORITY_THRESHOLDS.mid;
  const midHigh = typeof t.midHigh === "number" ? t.midHigh : DEFAULT_PRIORITY_THRESHOLDS.midHigh;
  return { low, mid, midHigh };
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const __lawyer = await requireLawyerApi();
  if (!__lawyer) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { token } = await params;
  try {
    const body = (await req.json()) as {
      promptMd?: string;
      outputMd?: string;
      providerId?: string;
      model?: string;
      apiKey?: string;
      baseUrlOverride?: string;
      thresholds?: unknown;
      mode?: string;
    };
    const promptMd = (body.promptMd ?? "").trim();
    const outputMd = (body.outputMd ?? "").trim();
    const providerId = (body.providerId ?? "").trim();
    const model = (body.model ?? "").trim();
    const apiKey = (body.apiKey ?? "").trim();
    const baseUrlOverride = (body.baseUrlOverride ?? "").trim();
    const thresholds = normalizeThresholds(body.thresholds);
    const mode: ReportGenerationMode = body.mode === "fusion" ? "fusion" : "concat";

    const provider = getProviderById(providerId);
    const base = normalizeBase(baseUrlOverride || provider?.baseUrl || "");
    if (!base) {
      return NextResponse.json(
        { error: "bad_request", message: "未配置可用 Base URL，请先在大模型设置中保存" },
        { status: 400 }
      );
    }
    if (!model) {
      return NextResponse.json(
        { error: "bad_request", message: "未配置模型名称，请先在大模型设置中保存" },
        { status: 400 }
      );
    }
    if (!apiKey) {
      return NextResponse.json(
        { error: "bad_request", message: "未配置 API Key，请先在大模型设置中保存" },
        { status: 400 }
      );
    }
    if (providerId === "custom" && !baseUrlOverride.trim()) {
      return NextResponse.json(
        { error: "bad_request", message: "当前供应商为自定义，请先填写并保存 Base URL" },
        { status: 400 }
      );
    }

    const { prisma } = await import("@/lib/prisma");
    const { reportText, moduleCount } = await generateCheckupReport({
      prisma,
      token,
      promptMd,
      outputMd,
      base,
      apiKey,
      model,
      providerId,
      mode,
      thresholds,
    });

    return NextResponse.json({ ok: true, reportText, moduleCount });
  } catch (e) {
    const msg = String(e);
    if (msg === "Error: not_found") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ error: "server_error", message: msg }, { status: 500 });
  }
}
