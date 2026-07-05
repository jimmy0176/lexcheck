import { NextResponse } from "next/server";
import { requireLawyerApi } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const __lawyer = await requireLawyerApi();
  if (!__lawyer) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { token } = await params;
  try {
    const { prisma } = await import("@/lib/prisma");
    const checkup = await prisma.checkup.findUnique({ where: { token }, select: { id: true } });
    if (!checkup) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const allJobs = await prisma.quickExamReportJob.findMany({
      where: { checkupId: checkup.id, status: "success" },
      orderBy: { createdAt: "asc" },
      select: { id: true, createdAt: true, mode: true },
    });
    // 版本号 = 按生成先后顺序（升序）的序号，不受下方展示顺序/截断影响
    const jobs = allJobs
      .map((job, i) => ({ ...job, version: i + 1 }))
      .reverse()
      .slice(0, 50);
    return NextResponse.json({ jobs });
  } catch (e) {
    return NextResponse.json({ error: "server_error", message: String(e) }, { status: 500 });
  }
}
