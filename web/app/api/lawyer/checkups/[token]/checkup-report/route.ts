import { NextResponse } from "next/server";
import { requireLawyerApi } from "@/lib/auth";
import { generateCheckupReport, type ReportGenerationMode } from "@/lib/checkup-report-generate";
import { DEFAULT_PRIORITY_THRESHOLDS, type PriorityThresholds } from "@/lib/checkup-report-assemble";
import type { LlmProfileSource } from "@/lib/llm-resolve";

export const runtime = "nodejs";
export const maxDuration = 60;

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
  const lawyer = await requireLawyerApi();
  if (!lawyer) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { token } = await params;
  try {
    const body = (await req.json()) as {
      promptMd?: string;
      thirdPartyPromptMd?: string;
      disclaimerText?: string;
      thresholds?: unknown;
      mode?: string;
      llmSource?: string;
    };
    const promptMd = (body.promptMd ?? "").trim();
    const thirdPartyPromptMd = (body.thirdPartyPromptMd ?? "").trim();
    const disclaimerText = (body.disclaimerText ?? "").trim();
    const thresholds = normalizeThresholds(body.thresholds);
    const mode: ReportGenerationMode =
      body.mode === "concat" ? "concat" : body.mode === "advanced" ? "advanced" : "fusion";
    const llmSource: LlmProfileSource | undefined =
      body.llmSource === "own" || body.llmSource === "shared" || body.llmSource === "backup"
        ? body.llmSource
        : undefined;

    const { prisma } = await import("@/lib/prisma");
    const { reportText, moduleCount, usedAi, degraded } = await generateCheckupReport({
      prisma,
      token,
      lawyerId: lawyer.id,
      promptMd,
      thirdPartyPromptMd,
      disclaimerText,
      mode,
      thresholds,
      llmSource,
    });

    return NextResponse.json({ ok: true, reportText, moduleCount, usedAi, degraded });
  } catch (e) {
    const msg = String(e);
    if (msg === "Error: not_found") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ error: "server_error", message: msg }, { status: 500 });
  }
}
