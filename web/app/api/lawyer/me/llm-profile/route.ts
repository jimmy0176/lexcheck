import { NextResponse } from "next/server";
import { requireLawyerApi } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const lawyer = await requireLawyerApi();
  if (!lawyer) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({
    profile: {
      providerId: lawyer.llmProviderId ?? "",
      model: lawyer.llmModel ?? "",
      apiKey: lawyer.llmApiKey ?? "",
      baseUrl: lawyer.llmBaseUrl ?? "",
    },
  });
}

export async function PATCH(req: Request) {
  const lawyer = await requireLawyerApi();
  if (!lawyer) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const body = (await req.json()) as {
      providerId?: string;
      model?: string;
      apiKey?: string;
      baseUrl?: string;
    };
    const { prisma } = await import("@/lib/prisma");
    await prisma.user.update({
      where: { id: lawyer.id },
      data: {
        llmProviderId: (body.providerId ?? "").trim() || null,
        llmModel: (body.model ?? "").trim() || null,
        llmApiKey: (body.apiKey ?? "").trim() || null,
        llmBaseUrl: (body.baseUrl ?? "").trim() || null,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: "server_error", message: String(e) }, { status: 500 });
  }
}
