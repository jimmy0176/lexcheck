import { NextResponse } from "next/server";
import path from "node:path";
import { readFile } from "node:fs/promises";
import type { Answers, QuestionnaireConfig } from "@/lib/questionnaire-types";
import {
  generateDeepSeekAdvice,
  generateRuleAdvice,
} from "@/lib/ai-advice";

export const runtime = "nodejs";

async function readQuestionnaireConfig() {
  const filePath = path.join(process.cwd(), "public", "questionnaire.json");
  const raw = await readFile(filePath, "utf-8");
  return JSON.parse(raw) as QuestionnaireConfig;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  try {
    const { prisma } = await import("@/lib/prisma");
    const checkup = await prisma.checkup.findUnique({ where: { token } });
    if (!checkup) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    const config = await readQuestionnaireConfig();
    const answers = (checkup.answersJson ?? {}) as Answers;
    const advice = generateRuleAdvice(config, answers);
    const deepseek = await generateDeepSeekAdvice(config, answers);
    const hasKey = Boolean(process.env.DEEPSEEK_API_KEY?.trim());

    return NextResponse.json({
      riskLevel: advice.riskLevel,
      riskHighlights: advice.riskHighlights,
      recommendations: advice.recommendations,
      aiOpinion: deepseek.text,
      fallbackSummary: advice.summary,
      meta: {
        deepseekConfigured: hasKey,
        usedDeepseek: Boolean(deepseek.text),
        deepseekError: deepseek.error ?? null,
        deepseekHttpStatus: deepseek.httpStatus ?? null,
      },
    });
  } catch (e) {
    console.error("[ai-summary]", e);
    return NextResponse.json(
      { error: "server_error", message: String(e) },
      { status: 500 }
    );
  }
}
