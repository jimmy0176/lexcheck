import { NextResponse } from "next/server";
import { requireLawyerApi } from "@/lib/auth";
import { ensureDefaultQuestionnaireTemplate } from "@/lib/questionnaire-templates";
import { parseQuestionnaireWorkbook } from "@/lib/questionnaire-xlsx";
import type { QuestionnaireConfig } from "@/lib/questionnaire-types";

export const runtime = "nodejs";

export async function GET() {
  const lawyer = await requireLawyerApi();
  if (!lawyer) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { prisma } = await import("@/lib/prisma");
  await ensureDefaultQuestionnaireTemplate(prisma);

  const templates = await prisma.questionnaireTemplate.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { checkups: true, assignments: true } },
    },
  });

  const items = templates.map((t) => {
    const config = t.content as unknown as QuestionnaireConfig;
    const questionCount = config.sections?.reduce((n, s) => n + s.questions.length, 0) ?? 0;
    return {
      id: t.id,
      name: t.name,
      note: t.note,
      createdAt: t.createdAt,
      sectionCount: config.sections?.length ?? 0,
      questionCount,
      checkupCount: t._count.checkups,
      assignmentCount: t._count.assignments,
      locked: t._count.checkups > 0,
    };
  });

  return NextResponse.json({ templates: items });
}

export async function POST(req: Request) {
  const lawyer = await requireLawyerApi();
  if (!lawyer) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  const name = String(form.get("name") ?? "").trim();
  const note = String(form.get("note") ?? "").trim();

  if (!name) {
    return NextResponse.json({ error: "bad_request", message: "请填写问卷名称" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "bad_request", message: "请选择要导入的 .xlsx 文件" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await parseQuestionnaireWorkbook(buffer);
  if (!result.ok) {
    return NextResponse.json({ error: "invalid_workbook", errors: result.errors }, { status: 422 });
  }

  const config: QuestionnaireConfig = { ...result.config, title: name };

  const { prisma } = await import("@/lib/prisma");
  const template = await prisma.questionnaireTemplate.create({
    data: {
      name,
      note: note || null,
      content: config as unknown as object,
      createdById: lawyer.id,
    },
  });

  return NextResponse.json({ ok: true, id: template.id });
}
