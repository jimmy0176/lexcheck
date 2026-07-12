import { NextResponse } from "next/server";
import { requireLawyerApi } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const lawyer = await requireLawyerApi();
  if (!lawyer) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const { prisma } = await import("@/lib/prisma");
  const template = await prisma.questionnaireTemplate.findUnique({
    where: { id },
    include: { _count: { select: { checkups: true } } },
  });
  if (!template) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({
    id: template.id,
    name: template.name,
    note: template.note,
    config: template.content,
    locked: template._count.checkups > 0,
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const lawyer = await requireLawyerApi();
  if (!lawyer) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = (await req.json()) as { name?: string; note?: string };
  const data: { name?: string; note?: string | null } = {};
  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name) return NextResponse.json({ error: "bad_request", message: "名称不能为空" }, { status: 400 });
    data.name = name;
  }
  if (typeof body.note === "string") data.note = body.note.trim() || null;

  const { prisma } = await import("@/lib/prisma");
  try {
    await prisma.questionnaireTemplate.update({ where: { id }, data });
  } catch {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const lawyer = await requireLawyerApi();
  if (!lawyer) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const { prisma } = await import("@/lib/prisma");
  const checkupCount = await prisma.checkup.count({ where: { templateId: id } });
  if (checkupCount > 0) {
    return NextResponse.json(
      { error: "locked", message: "已有客户使用该问卷，无法删除，可导出后修改为新问卷" },
      { status: 409 }
    );
  }

  try {
    await prisma.questionnaireTemplate.delete({ where: { id } });
  } catch {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
