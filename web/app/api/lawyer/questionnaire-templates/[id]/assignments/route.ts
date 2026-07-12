import { NextResponse } from "next/server";
import { requireLawyerApi } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const lawyer = await requireLawyerApi();
  if (!lawyer) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const { prisma } = await import("@/lib/prisma");
  const rows = await prisma.questionnaireAssignment.findMany({ where: { templateId: id } });
  const broadcast = rows.some((r) => r.clientId === null);
  const clientIds = rows.filter((r) => r.clientId !== null).map((r) => r.clientId as string);

  return NextResponse.json({ broadcast, clientIds });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const lawyer = await requireLawyerApi();
  if (!lawyer) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = (await req.json()) as { broadcast?: boolean; clientIds?: string[] };
  const broadcast = Boolean(body.broadcast);
  const clientIds = Array.isArray(body.clientIds) ? [...new Set(body.clientIds.filter((s) => typeof s === "string"))] : [];

  const { prisma } = await import("@/lib/prisma");
  const template = await prisma.questionnaireTemplate.findUnique({ where: { id } });
  if (!template) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await prisma.$transaction([
    prisma.questionnaireAssignment.deleteMany({ where: { templateId: id } }),
    prisma.questionnaireAssignment.createMany({
      data: [
        ...(broadcast ? [{ templateId: id, clientId: null }] : []),
        ...clientIds.map((clientId) => ({ templateId: id, clientId })),
      ],
    }),
  ]);

  return NextResponse.json({ ok: true });
}
