import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { readQuestionnaireConfigForCheckup } from "@/lib/questionnaire-templates";

export const runtime = "nodejs";

async function getPrisma() {
  const mod = await import("@/lib/prisma");
  return mod.prisma;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const user = await getSessionUser();
  if (!user || user.role !== "client") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const prisma = await getPrisma();
    const checkup = await prisma.checkup.findUnique({ where: { token } });

    if (!checkup) {
      return NextResponse.json({
        token,
        companyName: "",
        contactName: "",
        contactPhone: "",
        status: "draft",
        answers: {},
        savedAt: null,
        submittedAt: null,
        config: null,
      });
    }

    if (checkup.clientId !== user.id) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const config = await readQuestionnaireConfigForCheckup(prisma, checkup);

    return NextResponse.json({
      token: checkup.token,
      companyName: checkup.companyName ?? "",
      contactName: checkup.contactName ?? "",
      contactPhone: checkup.contactPhone ?? "",
      status: checkup.status,
      answers: checkup.answersJson,
      savedAt: checkup.savedAt.toISOString(),
      submittedAt: checkup.submittedAt ? checkup.submittedAt.toISOString() : null,
      config,
    });
  } catch {
    // DB/Prisma unavailable: keep questionnaire usable with client-side fallback.
    return NextResponse.json({
      token,
      companyName: "",
      contactName: "",
      contactPhone: "",
      status: "draft",
      answers: {},
      savedAt: null,
      submittedAt: null,
      config: null,
      storageMode: "local-fallback",
    });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const user = await getSessionUser();
  if (!user || user.role !== "client") {
    return NextResponse.json({ ok: false, message: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json()) as {
    companyName?: unknown;
    contactName?: unknown;
    contactPhone?: unknown;
    answers?: unknown;
  };
  const companyName = typeof body.companyName === "string" ? body.companyName.trim() : "";
  const contactName = typeof body.contactName === "string" ? body.contactName.trim() : "";
  const contactPhone = typeof body.contactPhone === "string" ? body.contactPhone.trim() : "";
  const answers = body.answers ?? {};
  const now = new Date();

  try {
    const prisma = await getPrisma();
    const existing = await prisma.checkup.findUnique({ where: { token } });
    if (existing && existing.clientId !== user.id) {
      return NextResponse.json({ ok: false, message: "forbidden" }, { status: 403 });
    }
    const checkup = await prisma.checkup.upsert({
      where: { token },
      create: {
        token,
        companyName,
        contactName,
        contactPhone,
        status: "draft",
        answersJson: answers,
        savedAt: now,
        clientId: user.id,
      },
      update: {
        companyName,
        contactName,
        contactPhone,
        answersJson: answers,
        savedAt: now,
      },
    });

    return NextResponse.json({
      ok: true,
      token: checkup.token,
      companyName: checkup.companyName ?? "",
      contactName: checkup.contactName ?? "",
      contactPhone: checkup.contactPhone ?? "",
      status: checkup.status,
      savedAt: checkup.savedAt.toISOString(),
      storageMode: "server",
    });
  } catch {
    return NextResponse.json(
      { ok: false, message: "server storage unavailable", storageMode: "local-fallback" },
      { status: 503 }
    );
  }
}

