import { NextResponse } from "next/server";
import { requireLawyerApi } from "@/lib/auth";

export const runtime = "nodejs";

async function loadWorkspace(token: string) {
  const { prisma } = await import("@/lib/prisma");
  const checkup = await prisma.checkup.findUnique({
    where: { token },
    include: { workspace: { include: { finalReport: true } } },
  });
  if (!checkup) return null;
  if (checkup.workspace) return checkup.workspace;
  return prisma.checkupWorkspace.create({
    data: { checkupId: checkup.id, progressJson: {} },
    include: { finalReport: true },
  });
}

/** 保存报告正文（人工编辑后的版本）；已定稿的报告需先取消定稿才能再次保存。 */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const lawyer = await requireLawyerApi();
  if (!lawyer) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { token } = await params;
  const body = (await req.json()) as { reportText?: string };
  const reportText = (body.reportText ?? "").trim();
  if (!reportText) {
    return NextResponse.json({ error: "bad_request", message: "报告内容不能为空" }, { status: 400 });
  }

  const workspace = await loadWorkspace(token);
  if (!workspace) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (workspace.finalReport?.finalizedAt) {
    return NextResponse.json({ error: "finalized", message: "报告已定稿，请先取消定稿再修改" }, { status: 400 });
  }

  const { prisma } = await import("@/lib/prisma");
  const saved = await prisma.checkupFinalReport.upsert({
    where: { workspaceId: workspace.id },
    create: { workspaceId: workspace.id, reportText },
    update: { reportText, generatedAt: new Date() },
  });

  return NextResponse.json({
    ok: true,
    finalReport: {
      reportText: saved.reportText,
      updatedAt: saved.updatedAt,
      finalizedAt: saved.finalizedAt,
    },
  });
}

/** 定稿 / 取消定稿：定稿后锁定编辑与重新生成，需先取消定稿才能再次保存。 */
export async function PATCH(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const lawyer = await requireLawyerApi();
  if (!lawyer) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { token } = await params;
  const body = (await req.json()) as { finalize?: boolean };

  const workspace = await loadWorkspace(token);
  if (!workspace?.finalReport) {
    return NextResponse.json({ error: "bad_request", message: "请先保存报告" }, { status: 400 });
  }

  const { prisma } = await import("@/lib/prisma");
  const saved = await prisma.checkupFinalReport.update({
    where: { workspaceId: workspace.id },
    data: { finalizedAt: body.finalize ? new Date() : null },
  });

  return NextResponse.json({ ok: true, finalizedAt: saved.finalizedAt });
}
