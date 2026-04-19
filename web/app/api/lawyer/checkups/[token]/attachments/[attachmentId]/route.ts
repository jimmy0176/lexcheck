import { readFile, unlink } from "node:fs/promises";
import { NextResponse } from "next/server";
import { extractAttachmentText } from "@/lib/extract-attachment-text";
import { getProviderById } from "@/lib/llm-providers";

export const runtime = "nodejs";

function normalizeBase(url: string) {
  return url.trim().replace(/\/+$/, "");
}

function normalizeAssistantText(content: unknown): string {
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

async function runAiExtraction(params: {
  sourceText: string;
  fileName: string;
  extractionRule: string;
  providerId: string;
  model: string;
  apiKey: string;
  baseUrlOverride: string;
}) {
  const provider = getProviderById(params.providerId);
  const base = normalizeBase(params.baseUrlOverride || provider?.baseUrl || "");
  if (!base) throw new Error("未配置可用 Base URL，请先在大模型设置中保存");
  if (!params.model.trim()) throw new Error("未配置模型名称，请先在大模型设置中保存");
  if (!params.apiKey.trim()) throw new Error("未配置 API Key，请先在大模型设置中保存");

  const systemPrompt =
    "你是企业法律尽调资料提取助手。你将收到单个附件的全文文本，请按用户规则提取事实信息，保留原文证据，不得编造。输出中文 Markdown。";
  const defaultRule =
    "提取与法律尽调相关的核心事实，按“关键信息 / 证据摘录 / 风险提示”分段输出；无法确认处明确写“未从本附件识别到”。";
  const text = params.sourceText.trim().slice(0, 16000);
  const userPrompt = [
    `附件文件名：${params.fileName}`,
    "",
    "【提取规则】",
    (params.extractionRule || defaultRule).trim(),
    "",
    "【附件全文】",
    text || "（空）",
  ].join("\n");

  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.apiKey.trim()}`,
      "User-Agent": "Lexcheck/1.0 (attachment-ai-extract)",
    },
    body: JSON.stringify({
      model: params.model.trim(),
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 1600,
    }),
    cache: "no-store",
  });
  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`AI接口异常 HTTP ${res.status}${raw ? `：${raw.slice(0, 300)}` : ""}`);
  }
  let parsed: { choices?: Array<{ message?: { content?: unknown } }> } | null = null;
  try {
    parsed = JSON.parse(raw) as { choices?: Array<{ message?: { content?: unknown } }> };
  } catch {
    throw new Error("AI接口返回非 JSON，无法解析");
  }
  const answer = normalizeAssistantText(parsed?.choices?.[0]?.message?.content);
  if (!answer) throw new Error("AI接口未返回有效提取结果");
  return answer;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string; attachmentId: string }> }
) {
  const { token, attachmentId } = await params;
  try {
    const { prisma } = await import("@/lib/prisma");
    const checkup = await prisma.checkup.findUnique({ where: { token } });
    if (!checkup) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const att = await prisma.checkupAttachment.findFirst({
      where: { id: attachmentId, checkupId: checkup.id },
    });
    if (!att) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const buf = await readFile(att.storagePath);
    return new NextResponse(buf, {
      headers: {
        "Content-Type": att.mimeType || "application/octet-stream",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(att.fileName)}`,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: "server_error", message: String(e) },
      { status: 500 }
    );
  }
}

/** 从已存文件重新解析文本（内容提取「自动提取」） */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ token: string; attachmentId: string }> }
) {
  const { token, attachmentId } = await params;
  try {
    let body: {
      mode?: "auto" | "ai";
      extractionRule?: string;
      providerId?: string;
      model?: string;
      apiKey?: string;
      baseUrlOverride?: string;
    } = {};
    try {
      body = (await req.json()) as typeof body;
    } catch {
      body = {};
    }

    const { prisma } = await import("@/lib/prisma");
    const checkup = await prisma.checkup.findUnique({ where: { token } });
    if (!checkup) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const att = await prisma.checkupAttachment.findFirst({
      where: { id: attachmentId, checkupId: checkup.id },
    });
    if (!att) return NextResponse.json({ error: "not_found" }, { status: 404 });

    let extractedText: string | null = null;
    let extractError: string | null = null;
    const mode = body.mode === "ai" ? "ai" : "auto";
    if (mode === "ai") {
      try {
        const source = await extractAttachmentText(att.storagePath);
        extractedText = await runAiExtraction({
          sourceText: source,
          fileName: att.fileName,
          extractionRule: (body.extractionRule ?? "").trim(),
          providerId: (body.providerId ?? "").trim(),
          model: (body.model ?? "").trim(),
          apiKey: (body.apiKey ?? "").trim(),
          baseUrlOverride: (body.baseUrlOverride ?? "").trim(),
        });
      } catch (e) {
        extractError = String(e);
      }
    } else {
      try {
        extractedText = await extractAttachmentText(att.storagePath);
      } catch (e) {
        extractError = String(e);
      }
    }

    const updated = await prisma.checkupAttachment.update({
      where: { id: att.id },
      data: {
        extractedText: extractedText ?? att.extractedText,
        extractError,
      },
    });

    return NextResponse.json({
      ok: true,
      mode,
      attachment: {
        id: updated.id,
        fileName: updated.fileName,
        extractedText: updated.extractedText,
        extractError: updated.extractError,
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

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ token: string; attachmentId: string }> }
) {
  const { token, attachmentId } = await params;
  try {
    const { prisma } = await import("@/lib/prisma");
    const checkup = await prisma.checkup.findUnique({ where: { token } });
    if (!checkup) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const att = await prisma.checkupAttachment.findFirst({
      where: { id: attachmentId, checkupId: checkup.id },
    });
    if (!att) return NextResponse.json({ error: "not_found" }, { status: 404 });
    await prisma.checkupAttachment.delete({ where: { id: att.id } });
    try {
      await unlink(att.storagePath);
    } catch {
      // ignore missing file
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: "server_error", message: String(e) },
      { status: 500 }
    );
  }
}
