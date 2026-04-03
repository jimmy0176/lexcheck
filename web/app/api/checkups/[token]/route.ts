import { NextResponse } from "next/server";

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
  try {
    const prisma = await getPrisma();
    const checkup = await prisma.checkup.findUnique({ where: { token } });

    if (!checkup) {
      return NextResponse.json({
        token,
        companyName: "",
        status: "draft",
        answers: {},
        savedAt: null,
        submittedAt: null,
      });
    }

    return NextResponse.json({
      token: checkup.token,
      companyName: checkup.companyName ?? "",
      status: checkup.status,
      answers: checkup.answersJson,
      savedAt: checkup.savedAt.toISOString(),
      submittedAt: checkup.submittedAt ? checkup.submittedAt.toISOString() : null,
    });
  } catch {
    // DB/Prisma unavailable: keep questionnaire usable with client-side fallback.
    return NextResponse.json({
      token,
      companyName: "",
      status: "draft",
      answers: {},
      savedAt: null,
      submittedAt: null,
      storageMode: "local-fallback",
    });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const body = (await req.json()) as { companyName?: unknown; answers?: unknown };
  const companyName = typeof body.companyName === "string" ? body.companyName.trim() : "";
  const answers = body.answers ?? {};
  const now = new Date();

  try {
    const prisma = await getPrisma();
    const checkup = await prisma.checkup.upsert({
      where: { token },
      create: {
        token,
        companyName,
        status: "draft",
        answersJson: answers,
        savedAt: now,
      },
      update: {
        companyName,
        answersJson: answers,
        savedAt: now,
      },
    });

    return NextResponse.json({
      ok: true,
      token: checkup.token,
      companyName: checkup.companyName ?? "",
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

