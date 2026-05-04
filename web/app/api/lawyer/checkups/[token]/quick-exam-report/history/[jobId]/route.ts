import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string; jobId: string }> }
) {
  const { token, jobId } = await params;
  try {
    const { prisma } = await import("@/lib/prisma");
    const checkup = await prisma.checkup.findUnique({ where: { token }, select: { id: true } });
    if (!checkup) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const job = await prisma.quickExamReportJob.findFirst({
      where: { id: jobId, checkupId: checkup.id, status: "success" },
      select: { id: true, reportText: true, createdAt: true, mode: true },
    });
    if (!job) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ job });
  } catch (e) {
    return NextResponse.json({ error: "server_error", message: String(e) }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ token: string; jobId: string }> }
) {
  const { token, jobId } = await params;
  try {
    const { prisma } = await import("@/lib/prisma");
    const checkup = await prisma.checkup.findUnique({ where: { token }, select: { id: true } });
    if (!checkup) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const job = await prisma.quickExamReportJob.findFirst({
      where: { id: jobId, checkupId: checkup.id },
      select: { id: true },
    });
    if (!job) return NextResponse.json({ error: "not_found" }, { status: 404 });
    await prisma.quickExamReportJob.delete({ where: { id: jobId } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: "server_error", message: String(e) }, { status: 500 });
  }
}
