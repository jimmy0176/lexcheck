import path from "node:path";
import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import type { Answers, QuestionnaireConfig } from "@/lib/questionnaire-types";
import {
  generateDeepSeekAdvice,
  generateRuleAdvice,
} from "@/lib/ai-advice";
import { truncateForPrompt } from "@/lib/checkup-attachments";
import { resolveWorkspaceSectionMeta } from "@/lib/checkup-workflow";

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
    const body = (await req.json()) as {
      sectionKey?: string;
      customRequirement?: string;
    };
    const sectionKey = (body.sectionKey ?? "").trim();
    if (!sectionKey) {
      return NextResponse.json({ error: "invalid_section" }, { status: 400 });
    }
    const sectionMeta = resolveWorkspaceSectionMeta(sectionKey);
    if (!sectionMeta) {
      return NextResponse.json({ error: "unsupported_section" }, { status: 400 });
    }

    const { prisma } = await import("@/lib/prisma");
    const checkup = await prisma.checkup.findUnique({
      where: { token },
      include: {
        attachments: {
          where: { kind: "detailed" },
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
    });
    if (!checkup) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const config = await readQuestionnaireConfig();
    const answers = (checkup.answersJson ?? {}) as Answers;
    const rules = generateRuleAdvice(config, answers);
    const attachmentSummary =
      checkup.attachments.length > 0
        ? truncateForPrompt(
            checkup.attachments
              .map((a, idx) => {
                const base = `附件${idx + 1}：${a.fileName}`;
                if (a.extractedText?.trim()) {
                  return `${base}\n${truncateForPrompt(a.extractedText.trim(), 1600)}`;
                }
                return `${base}\n（无可用文本${a.extractError ? `，原因：${a.extractError}` : ""}）`;
              })
              .join("\n\n"),
            4500
          )
        : null;
    const custom = (body.customRequirement ?? "").trim().slice(0, 1200);

    const deep = await generateDeepSeekAdvice(config, answers, {
      attachmentSummary: [
        `目标分部：${sectionMeta.name}`,
        attachmentSummary ?? "暂无补充材料",
      ].join("\n\n"),
      customRequirement: custom || undefined,
    });

    const fallbackDraft = [
      `【${sectionMeta.name}】`,
      "",
      `风险等级：${rules.riskLevel}`,
      `概览：${rules.summary}`,
      "",
      "关键风险点：",
      ...(rules.riskHighlights.length
        ? rules.riskHighlights.map((s, idx) => `${idx + 1}. ${s}`)
        : ["1. 暂未识别到显著风险项。"]),
      "",
      "建议动作：",
      ...(rules.recommendations.length
        ? rules.recommendations.map((s, idx) => `${idx + 1}. ${s}`)
        : ["1. 按章节复核问卷并补齐证明材料。"]),
    ].join("\n");
    const draftText = deep.text?.trim() || fallbackDraft;

    const workspace = await prisma.checkupWorkspace.upsert({
      where: { checkupId: checkup.id },
      create: { checkupId: checkup.id, progressJson: {} },
      update: {},
    });
    const draft = await prisma.checkupSectionDraft.upsert({
      where: { workspaceId_sectionKey: { workspaceId: workspace.id, sectionKey } },
      create: {
        workspaceId: workspace.id,
        sectionKey,
        sectionName: sectionMeta.name,
        draftText,
        reviewedText: null,
        included: true,
        sourceMeta: {
          usedDeepSeek: Boolean(deep.text),
          deepseekError: deep.error ?? null,
          attachmentCount: checkup.attachments.length,
          generatedAt: new Date().toISOString(),
        },
      },
      update: {
        sectionName: sectionMeta.name,
        draftText,
        sourceMeta: {
          usedDeepSeek: Boolean(deep.text),
          deepseekError: deep.error ?? null,
          attachmentCount: checkup.attachments.length,
          generatedAt: new Date().toISOString(),
        },
      },
    });

    return NextResponse.json({
      ok: true,
      draft: {
        id: draft.id,
        sectionKey: draft.sectionKey,
        sectionName: draft.sectionName,
        draftText: draft.draftText,
        reviewedText: draft.reviewedText ?? "",
        included: draft.included,
        updatedAt: draft.updatedAt,
      },
      meta: {
        usedDeepSeek: Boolean(deep.text),
        deepseekError: deep.error ?? null,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: "server_error", message: String(e) },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  try {
    const body = (await req.json()) as {
      draftId?: string;
      reviewedText?: string;
      included?: boolean;
    };
    const draftId = (body.draftId ?? "").trim();
    if (!draftId) return NextResponse.json({ error: "invalid_draft" }, { status: 400 });

    const { prisma } = await import("@/lib/prisma");
    const checkup = await prisma.checkup.findUnique({
      where: { token },
      include: { workspace: true },
    });
    if (!checkup?.workspace) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const draft = await prisma.checkupSectionDraft.findUnique({ where: { id: draftId } });
    if (!draft || draft.workspaceId !== checkup.workspace.id) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    const updated = await prisma.checkupSectionDraft.update({
      where: { id: draft.id },
      data: {
        reviewedText:
          typeof body.reviewedText === "string" ? body.reviewedText.trim() || null : undefined,
        included: typeof body.included === "boolean" ? body.included : undefined,
      },
    });
    return NextResponse.json({
      ok: true,
      draft: {
        id: updated.id,
        reviewedText: updated.reviewedText ?? "",
        included: updated.included,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: "server_error", message: String(e) },
      { status: 500 }
    );
  }
}
