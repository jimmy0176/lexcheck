import { NextResponse } from "next/server";
import { getAuthSettings, requireAdminApi } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const admin = await requireAdminApi();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const settings = await getAuthSettings();
  return NextResponse.json({ settings });
}

export async function PATCH(req: Request) {
  const admin = await requireAdminApi();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  try {
    const body = (await req.json()) as {
      tempCodeEnabled?: boolean;
      tempCode?: string;
      registrationMode?: string;
      inviteCode?: string;
      questionnaireCooldownHours?: number;
    };

    const data: Record<string, unknown> = {};
    if (typeof body.tempCodeEnabled === "boolean") data.tempCodeEnabled = body.tempCodeEnabled;
    if (typeof body.tempCode === "string") {
      const t = body.tempCode.trim();
      if (!t) return NextResponse.json({ error: "bad_request", message: "临时验证码不能为空" }, { status: 400 });
      data.tempCode = t;
    }
    if (body.registrationMode === "open" || body.registrationMode === "invite_only") {
      data.registrationMode = body.registrationMode;
    }
    if (typeof body.inviteCode === "string") data.inviteCode = body.inviteCode.trim();
    if (typeof body.questionnaireCooldownHours === "number") {
      if (!Number.isFinite(body.questionnaireCooldownHours) || body.questionnaireCooldownHours < 0) {
        return NextResponse.json({ error: "bad_request", message: "冷却小时数须为非负数" }, { status: 400 });
      }
      data.questionnaireCooldownHours = Math.round(body.questionnaireCooldownHours);
    }

    const { prisma } = await import("@/lib/prisma");
    const settings = await prisma.authSettings.update({ where: { id: "singleton" }, data });
    return NextResponse.json({ ok: true, settings });
  } catch (e) {
    return NextResponse.json({ error: "server_error", message: String(e) }, { status: 500 });
  }
}
