import path from "node:path";
import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import type { Answers, QuestionnaireConfig } from "@/lib/questionnaire-types";
import { generateDeepSeekAdvice, generateRuleAdvice } from "@/lib/ai-advice";

export const runtime = "nodejs";

async function readQuestionnaireConfig() {
  const filePath = path.join(process.cwd(), "public", "questionnaire.json");
  const raw = await readFile(filePath, "utf-8");
  return JSON.parse(raw) as QuestionnaireConfig;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  try {
    const body = (await req.json()) as { noteInstruction?: string };
    const noteInstruction = (body.noteInstruction ?? "").trim().slice(0, 800);

    const { prisma } = await import("@/lib/prisma");
    const checkup = await prisma.checkup.findUnique({
      where: { token },
      include: {
        workspace: {
          include: {
            sectionDrafts: { orderBy: { updatedAt: "asc" } },
            finalReport: true,
          },
        },
      },
    });
    if (!checkup?.workspace) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const includedDrafts = checkup.workspace.sectionDrafts.filter((d) => d.included);
    if (includedDrafts.length === 0) {
      return NextResponse.json({ error: "no_drafts" }, { status: 400 });
    }
    const mergedSections = includedDrafts
      .map((d, idx) => {
        const text = (d.reviewedText ?? "").trim() || d.draftText.trim();
        return `第${idx + 1}部分：${d.sectionName}\n${text}`;
      })
      .join("\n\n");

    const config = await readQuestionnaireConfig();
    const answers = (checkup.answersJson ?? {}) as Answers;
    const rules = generateRuleAdvice(config, answers);

    const deep = await generateDeepSeekAdvice(config, answers, {
      attachmentSummary: [
        "以下为律师已筛选分部草稿，请整合为正式体检报告，保留结构化标题与行动建议。",
        mergedSections,
      ].join("\n\n"),
      customRequirement: noteInstruction
        ? `请在文末补充“其他注意事项”并结合以下指令：${noteInstruction}`
        : "请在文末输出“其他注意事项”小节。",
    });

    const reportText =
      deep.text?.trim() ||
      [
        `企业法律体检报告（${checkup.companyName?.trim() || checkup.token}）`,
        "",
        mergedSections,
        "",
        "其他注意事项：",
        "1. 本报告基于问卷与补充材料生成，需由律师复核后对外使用；",
        "2. 对于证据不足或材料缺失项，建议列入后续尽调清单。",
      ].join("\n");

    const notesText = [
      `风险等级：${rules.riskLevel}`,
      "优先事项：",
      ...(rules.recommendations.slice(0, 3).map((s, idx) => `${idx + 1}. ${s}`) || []),
      ...(noteInstruction ? [`律师补充指令：${noteInstruction}`] : []),
    ].join("\n");

    const saved = await prisma.checkupFinalReport.upsert({
      where: { workspaceId: checkup.workspace.id },
      create: {
        workspaceId: checkup.workspace.id,
        reportText,
        notesText,
      },
      update: {
        reportText,
        notesText,
        generatedAt: new Date(),
      },
    });

    return NextResponse.json({
      ok: true,
      finalReport: {
        id: saved.id,
        reportText: saved.reportText,
        notesText: saved.notesText ?? "",
        updatedAt: saved.updatedAt,
      },
      usedDeepSeek: Boolean(deep.text),
      deepseekError: deep.error ?? null,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "server_error", message: String(e) },
      { status: 500 }
    );
  }
}
