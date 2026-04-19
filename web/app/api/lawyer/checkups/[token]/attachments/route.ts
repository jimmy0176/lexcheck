import path from "node:path";
import { unlink } from "node:fs/promises";
import { NextResponse } from "next/server";
import {
  MAX_ATTACHMENT_FILES,
  saveUploadFile,
  validateUploadFile,
} from "@/lib/checkup-attachments";

export const runtime = "nodejs";

type AttachmentKind = "preliminary" | "detailed";

function parseKindParam(v: string | null): AttachmentKind | null {
  if (v === "preliminary" || v === "detailed") return v;
  return null;
}

function parseKindForm(v: FormDataEntryValue | null): AttachmentKind {
  const s = typeof v === "string" ? v.trim() : "";
  if (s === "preliminary") return "preliminary";
  return "detailed";
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  try {
    const kindFilter = parseKindParam(new URL(req.url).searchParams.get("kind"));
    const { prisma } = await import("@/lib/prisma");
    const checkup = await prisma.checkup.findUnique({
      where: { token },
      include: {
        attachments: {
          where: kindFilter ? { kind: kindFilter } : undefined,
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!checkup) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({
      attachments: checkup.attachments.map((a) => ({
        id: a.id,
        kind: a.kind,
        fileName: a.fileName,
        mimeType: a.mimeType,
        sizeBytes: a.sizeBytes,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
        hasExtractedText: Boolean(a.extractedText),
        extractError: a.extractError,
      })),
    });
  } catch (e) {
    return NextResponse.json(
      { error: "server_error", message: String(e) },
      { status: 500 }
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  try {
    const form = await req.formData();
    const uploaded = form.getAll("files").filter((v): v is File => v instanceof File);
    if (uploaded.length === 0) {
      return NextResponse.json({ error: "no_files" }, { status: 400 });
    }
    if (uploaded.length > MAX_ATTACHMENT_FILES) {
      return NextResponse.json(
        { error: "too_many_files", message: `单次最多上传 ${MAX_ATTACHMENT_FILES} 个文件` },
        { status: 400 }
      );
    }

    for (const file of uploaded) {
      const err = validateUploadFile(file);
      if (err) {
        return NextResponse.json({ error: "invalid_file", message: err }, { status: 400 });
      }
    }

    const { prisma } = await import("@/lib/prisma");
    const checkup = await prisma.checkup.findUnique({ where: { token } });
    if (!checkup) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const attachmentKind = parseKindForm(form.get("attachmentKind"));

    const saved = [];
    for (const file of uploaded) {
      const { storagePath, ext } = await saveUploadFile(token, file);
      const created = await prisma.checkupAttachment.create({
        data: {
          checkupId: checkup.id,
          kind: attachmentKind,
          fileName: file.name,
          fileExt: ext,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          storagePath: path.normalize(storagePath),
          extractedText: null,
          extractError: null,
        },
      });
      saved.push({
        id: created.id,
        fileName: created.fileName,
        sizeBytes: created.sizeBytes,
        extractError: created.extractError,
      });
    }

    return NextResponse.json({ ok: true, attachments: saved });
  } catch (e) {
    return NextResponse.json(
      { error: "server_error", message: String(e) },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  try {
    const kindFilter = parseKindParam(new URL(req.url).searchParams.get("kind"));
    const { prisma } = await import("@/lib/prisma");
    const checkup = await prisma.checkup.findUnique({
      where: { token },
      include: {
        attachments: {
          where: kindFilter ? { kind: kindFilter } : undefined,
        },
      },
    });
    if (!checkup) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const targets = checkup.attachments.map((a) => a.storagePath).filter(Boolean);
    await prisma.checkupAttachment.deleteMany({
      where: { checkupId: checkup.id, ...(kindFilter ? { kind: kindFilter } : {}) },
    });
    for (const p of targets) {
      try {
        await unlink(p);
      } catch {
        // ignore missing/deleted file errors
      }
    }

    return NextResponse.json({ ok: true, deletedCount: targets.length });
  } catch (e) {
    return NextResponse.json(
      { error: "server_error", message: String(e) },
      { status: 500 }
    );
  }
}
