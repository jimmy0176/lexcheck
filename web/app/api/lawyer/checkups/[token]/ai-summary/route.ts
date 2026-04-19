import { NextResponse } from "next/server";
import path from "node:path";
import { readFile } from "node:fs/promises";
import type { Answers, QuestionnaireConfig } from "@/lib/questionnaire-types";
import {
  generateDeepSeekAdvice,
  generateRuleAdvice,
} from "@/lib/ai-advice";
import { truncateForPrompt } from "@/lib/checkup-attachments";

export const runtime = "nodejs";

async function readQuestionnaireConfig() {
  const filePath = path.join(process.cwd(), "public", "questionnaire.json");
  const raw = await readFile(filePath, "utf-8");
  return JSON.parse(raw) as QuestionnaireConfig;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const mode = new URL(req.url).searchParams.get("mode") ?? "rules";
  const includeAi = mode === "full";
  const includeAttachments =
    new URL(req.url).searchParams.get("includeAttachments") === "true";
  const customRequirement =
    new URL(req.url).searchParams.get("customRequirement")?.trim() ?? "";
  try {
    const { prisma } = await import("@/lib/prisma");
    const checkup = await prisma.checkup.findUnique({
      where: { token },
      include: {
        attachments: includeAttachments
          ? {
              where: { kind: "detailed" },
              orderBy: { createdAt: "desc" },
              take: 3,
            }
          : false,
      },
    });
    if (!checkup) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    const config = await readQuestionnaireConfig();
    const answers = (checkup.answersJson ?? {}) as Answers;
    const advice = generateRuleAdvice(config, answers);
    const hasKey = Boolean(process.env.DEEPSEEK_API_KEY?.trim());

    if (!includeAi) {
      return NextResponse.json({
        riskLevel: advice.riskLevel,
        riskHighlights: advice.riskHighlights,
        recommendations: advice.recommendations,
        aiOpinion: null,
        fallbackSummary: advice.summary,
        meta: {
          deepseekConfigured: hasKey,
          usedDeepseek: false,
          deepseekError: null,
          deepseekHttpStatus: null,
        },
      });
    }

    const attachmentSummary =
      includeAttachments && checkup.attachments.length > 0
        ? truncateForPrompt(
            checkup.attachments
              .map((a, idx) => {
                const head = `附件${idx + 1}：${a.fileName}`;
                if (a.extractedText?.trim()) {
                  return `${head}\n${truncateForPrompt(a.extractedText.trim(), 2200)}`;
                }
                if (a.extractError) {
                  return `${head}\n（解析失败：${a.extractError}）`;
                }
                return `${head}\n（未提取到有效文本）`;
              })
              .join("\n\n"),
            6000
          )
        : null;
    const attachmentInputs =
      includeAttachments && checkup.attachments.length > 0
        ? checkup.attachments.map((a) => ({
            id: a.id,
            fileName: a.fileName,
            extractedChars: (a.extractedText ?? "").trim().length,
            includedInPrompt: Boolean(a.extractedText?.trim()),
            extractError: a.extractError ?? null,
          }))
        : [];

    const deepseek = await generateDeepSeekAdvice(config, answers, {
      attachmentSummary,
      customRequirement: customRequirement.slice(0, 1200),
    });

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
        attachmentsUsed: Boolean(attachmentSummary),
        attachmentInputs,
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
