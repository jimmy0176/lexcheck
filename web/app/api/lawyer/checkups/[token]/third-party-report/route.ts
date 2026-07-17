import path from "node:path";
import { unlink } from "node:fs/promises";
import { NextResponse } from "next/server";
import { requireLawyerApi } from "@/lib/auth";
import { saveUploadFile, validateUploadFile } from "@/lib/checkup-attachments";
import { extractAttachmentText } from "@/lib/extract-attachment-text";
import { ADVANCED_THIRDPARTY_DETAIL_TRIGGER_CHARS, getThirdPartyDetailedExtract } from "@/lib/checkup-report-generate";

export const runtime = "nodejs";

async function findThirdPartyAttachment(prisma: import("@prisma/client").PrismaClient, checkupId: string) {
  return prisma.checkupAttachment.findFirst({
    where: { checkupId, kind: "thirdParty" },
    orderBy: { createdAt: "desc" },
  });
}

function hasDetailedExtract(parsedSummaryJson: unknown): boolean {
  const cached = parsedSummaryJson as { detailedExtract?: string } | null;
  return Boolean(cached?.detailedExtract?.trim());
}

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const lawyer = await requireLawyerApi();
  if (!lawyer) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { token } = await params;
  const { prisma } = await import("@/lib/prisma");
  const checkup = await prisma.checkup.findUnique({ where: { token }, include: { workspace: true } });
  if (!checkup) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const attachment = await findThirdPartyAttachment(prisma, checkup.id);

  return NextResponse.json({
    attachment: attachment
      ? {
          id: attachment.id,
          fileName: attachment.fileName,
          sizeBytes: attachment.sizeBytes,
          createdAt: attachment.createdAt,
          hasExtractedText: Boolean(attachment.extractedText?.trim()),
          extractError: attachment.extractError,
          extractedTextTruncated: attachment.extractedTextTruncated,
          extractedTextOriginalLength: attachment.extractedTextOriginalLength,
          willUseDetailedExtract: (attachment.extractedText?.trim().length ?? 0) > ADVANCED_THIRDPARTY_DETAIL_TRIGGER_CHARS,
          hasDetailedExtract: hasDetailedExtract(attachment.parsedSummaryJson),
        }
      : null,
    enabled: checkup.workspace?.thirdPartyReportEnabled ?? false,
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const lawyer = await requireLawyerApi();
  if (!lawyer) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { token } = await params;
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "no_file", message: "请选择要上传的文件" }, { status: 400 });
    }
    const validationErr = validateUploadFile(file);
    if (validationErr) {
      return NextResponse.json({ error: "invalid_file", message: validationErr }, { status: 400 });
    }

    const { prisma } = await import("@/lib/prisma");
    const checkup = await prisma.checkup.findUnique({ where: { token } });
    if (!checkup) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const existing = await findThirdPartyAttachment(prisma, checkup.id);
    if (existing) {
      await prisma.checkupAttachment.delete({ where: { id: existing.id } });
      try {
        await unlink(existing.storagePath);
      } catch {
        // 文件已不存在也无妨
      }
    }

    const { storagePath: rawStoragePath, ext } = await saveUploadFile(token, file);
    const storagePath = path.normalize(rawStoragePath);

    let extractedText: string | null = null;
    let extractError: string | null = null;
    let extractedTextTruncated = false;
    let extractedTextOriginalLength: number | null = null;
    try {
      const result = await extractAttachmentText(storagePath);
      extractedText = result.text;
      extractedTextTruncated = result.truncated;
      extractedTextOriginalLength = result.originalLength;
    } catch (e) {
      extractError = String(e instanceof Error ? e.message : e);
    }

    const created = await prisma.checkupAttachment.create({
      data: {
        checkupId: checkup.id,
        kind: "thirdParty",
        fileName: file.name,
        fileExt: ext,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        storagePath,
        extractedText,
        extractError,
        extractedTextTruncated,
        extractedTextOriginalLength,
        parsedSummaryJson: undefined,
      },
    });

    await prisma.checkupWorkspace.upsert({
      where: { checkupId: checkup.id },
      create: { checkupId: checkup.id, progressJson: {}, thirdPartyReportEnabled: true },
      update: { thirdPartyReportEnabled: true },
    });

    // 原文超过高级模式的详细摘要触发门槛时，上传阶段就预处理一次，避免留到生成报告时才等这个调用；
    // 这里是尽力而为，失败也不影响本次上传结果——生成报告时 getThirdPartyContentForAdvanced() 还会按需重试。
    let detailedExtractReady = false;
    if ((extractedText?.trim().length ?? 0) > ADVANCED_THIRDPARTY_DETAIL_TRIGGER_CHARS) {
      try {
        const detailed = await getThirdPartyDetailedExtract(prisma, created, lawyer.id);
        detailedExtractReady = Boolean(detailed);
      } catch {
        // 预处理失败不阻塞上传，交给报告生成时的按需重试
      }
    }

    return NextResponse.json({
      ok: true,
      attachment: {
        id: created.id,
        fileName: created.fileName,
        sizeBytes: created.sizeBytes,
        createdAt: created.createdAt,
        hasExtractedText: Boolean(created.extractedText?.trim()),
        extractError: created.extractError,
        extractedTextTruncated: created.extractedTextTruncated,
        extractedTextOriginalLength: created.extractedTextOriginalLength,
        willUseDetailedExtract: (extractedText?.trim().length ?? 0) > ADVANCED_THIRDPARTY_DETAIL_TRIGGER_CHARS,
        hasDetailedExtract: detailedExtractReady,
      },
      enabled: true,
    });
  } catch (e) {
    return NextResponse.json({ error: "server_error", message: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const lawyer = await requireLawyerApi();
  if (!lawyer) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { token } = await params;
  const body = (await req.json()) as { enabled?: boolean };
  const enabled = Boolean(body.enabled);

  const { prisma } = await import("@/lib/prisma");
  const checkup = await prisma.checkup.findUnique({ where: { token } });
  if (!checkup) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await prisma.checkupWorkspace.upsert({
    where: { checkupId: checkup.id },
    create: { checkupId: checkup.id, progressJson: {}, thirdPartyReportEnabled: enabled },
    update: { thirdPartyReportEnabled: enabled },
  });

  return NextResponse.json({ ok: true, enabled });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const lawyer = await requireLawyerApi();
  if (!lawyer) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { token } = await params;
  const { prisma } = await import("@/lib/prisma");
  const checkup = await prisma.checkup.findUnique({ where: { token } });
  if (!checkup) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const existing = await findThirdPartyAttachment(prisma, checkup.id);
  if (existing) {
    await prisma.checkupAttachment.delete({ where: { id: existing.id } });
    try {
      await unlink(existing.storagePath);
    } catch {
      // 文件已不存在也无妨
    }
  }

  await prisma.checkupWorkspace.upsert({
    where: { checkupId: checkup.id },
    create: { checkupId: checkup.id, progressJson: {}, thirdPartyReportEnabled: false },
    update: { thirdPartyReportEnabled: false },
  });

  return NextResponse.json({ ok: true });
}
