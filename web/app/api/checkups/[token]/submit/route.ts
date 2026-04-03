import { NextResponse } from "next/server";

export const runtime = "nodejs";

async function getPrisma() {
  const mod = await import("@/lib/prisma");
  return mod.prisma;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const body = (await req.json()) as { companyName?: unknown; answers?: unknown };
  const companyName = typeof body.companyName === "string" ? body.companyName.trim() : "";
  const answers = body.answers ?? {};
  const now = new Date();

  if (!companyName) {
    return NextResponse.json(
      { ok: false, message: "companyName is required on submit" },
      { status: 400 }
    );
  }

  try {
    const prisma = await getPrisma();
    const checkup = await prisma.checkup.upsert({
      where: { token },
      create: {
        token,
        companyName,
        status: "submitted",
        answersJson: answers,
        savedAt: now,
        submittedAt: now,
      },
      update: {
        companyName,
        status: "submitted",
        answersJson: answers,
        savedAt: now,
        submittedAt: now,
      },
    });

    return NextResponse.json({
      ok: true,
      token: checkup.token,
      companyName: checkup.companyName ?? "",
      status: checkup.status,
      savedAt: checkup.savedAt.toISOString(),
      submittedAt: checkup.submittedAt?.toISOString() ?? null,
      storageMode: "server",
    });
  } catch {
    return NextResponse.json(
      { ok: false, message: "server storage unavailable", storageMode: "local-fallback" },
      { status: 503 }
    );
  }
}

