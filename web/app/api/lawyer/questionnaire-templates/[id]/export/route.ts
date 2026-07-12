import { NextResponse } from "next/server";
import { requireLawyerApi } from "@/lib/auth";
import { buildQuestionnaireWorkbook } from "@/lib/questionnaire-xlsx";
import type { QuestionnaireConfig } from "@/lib/questionnaire-types";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const lawyer = await requireLawyerApi();
  if (!lawyer) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const { prisma } = await import("@/lib/prisma");
  const template = await prisma.questionnaireTemplate.findUnique({ where: { id } });
  if (!template) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const config = template.content as unknown as QuestionnaireConfig;
  const workbook = buildQuestionnaireWorkbook(config);
  const raw = await workbook.xlsx.writeBuffer();
  const buffer = Buffer.from(raw as unknown as Uint8Array);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(template.name)}.xlsx`,
    },
  });
}
