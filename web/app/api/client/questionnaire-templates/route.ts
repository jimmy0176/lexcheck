import { NextResponse } from "next/server";
import { requireClientApi } from "@/lib/auth";
import { ensureDefaultQuestionnaireTemplate } from "@/lib/questionnaire-templates";

export const runtime = "nodejs";

export async function GET() {
  const client = await requireClientApi();
  if (!client) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { prisma } = await import("@/lib/prisma");
  await ensureDefaultQuestionnaireTemplate(prisma);

  const assignments = await prisma.questionnaireAssignment.findMany({
    where: { OR: [{ clientId: null }, { clientId: client.id }] },
    include: { template: true },
  });
  const templates = new Map(assignments.map((a) => [a.templateId, a.template]));

  const checkups = await prisma.checkup.findMany({
    where: { clientId: client.id, templateId: { in: [...templates.keys()] } },
    orderBy: { updatedAt: "desc" },
  });

  const items = [...templates.values()].map((t) => {
    const draft = checkups.find((c) => c.templateId === t.id && c.status === "draft");
    const lastSubmitted = checkups
      .filter((c) => c.templateId === t.id && c.status === "submitted")
      .sort((a, b) => (b.submittedAt?.getTime() ?? 0) - (a.submittedAt?.getTime() ?? 0))[0];
    return {
      id: t.id,
      name: t.name,
      note: t.note,
      status: draft ? "draft" : lastSubmitted ? "submitted" : "none",
      token: draft?.token ?? lastSubmitted?.token ?? null,
      lastSubmittedAt: lastSubmitted?.submittedAt ?? null,
    };
  });

  return NextResponse.json({ templates: items });
}
