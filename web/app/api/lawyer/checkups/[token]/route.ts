import { NextResponse } from "next/server";
import { requireLawyerApi } from "@/lib/auth";

export const runtime = "nodejs";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const lawyer = await requireLawyerApi();
  if (!lawyer) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { token } = await params;
  const { prisma } = await import("@/lib/prisma");
  const checkup = await prisma.checkup.findUnique({ where: { token }, select: { id: true } });
  if (!checkup) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // 附件 / 工作区草稿与终稿 / 体检报告任务均已在 schema 中配置 onDelete: Cascade，随此次删除一并清理。
  await prisma.checkup.delete({ where: { id: checkup.id } });

  return NextResponse.json({ ok: true });
}
