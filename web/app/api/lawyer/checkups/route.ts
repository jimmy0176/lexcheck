import { NextResponse } from "next/server";
import { requireLawyerApi } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const lawyer = await requireLawyerApi();
  if (!lawyer) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const { prisma } = await import("@/lib/prisma");
  const checkups = await prisma.checkup.findMany({
    where: status ? { status: status as "draft" | "submitted" } : undefined,
    include: { template: { select: { name: true } } },
    orderBy: status === "draft" ? { createdAt: "desc" } : { submittedAt: "desc" },
  });

  return NextResponse.json({
    checkups: checkups.map((c) => ({
      id: c.id,
      token: c.token,
      companyName: c.companyName,
      contactName: c.contactName,
      contactPhone: c.contactPhone,
      status: c.status,
      submittedAt: c.submittedAt,
      templateName: c.template?.name ?? null,
    })),
  });
}
