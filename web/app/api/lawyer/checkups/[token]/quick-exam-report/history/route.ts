import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  try {
    const { prisma } = await import("@/lib/prisma");
    const checkup = await prisma.checkup.findUnique({ where: { token }, select: { id: true } });
    if (!checkup) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const jobs = await prisma.quickExamReportJob.findMany({
      where: { checkupId: checkup.id, status: "success" },
      orderBy: { createdAt: "desc" },
      select: { id: true, createdAt: true, mode: true },
      take: 50,
    });
    return NextResponse.json({ jobs });
  } catch (e) {
    return NextResponse.json({ error: "server_error", message: String(e) }, { status: 500 });
  }
}
