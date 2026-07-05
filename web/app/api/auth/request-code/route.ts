import { NextResponse } from "next/server";
import { getAuthSettings, isValidPhone } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { phone?: string };
    const phone = (body.phone ?? "").trim();

    if (!isValidPhone(phone)) {
      return NextResponse.json({ error: "bad_request", message: "请输入正确的手机号" }, { status: 400 });
    }

    const settings = await getAuthSettings();
    if (!settings.tempCodeEnabled) {
      return NextResponse.json(
        { error: "code_service_unavailable", message: "验证码服务暂未开通，请联系管理员" },
        { status: 400 }
      );
    }

    const { prisma } = await import("@/lib/prisma");
    const existing = await prisma.user.findUnique({ where: { phone } });

    if (existing) {
      return NextResponse.json({ ok: true, isNewPhone: false, requireInviteCode: false });
    }

    // 未注册手机号：只能作为客户账号注册，律师账号一律由管理员添加。
    return NextResponse.json({
      ok: true,
      isNewPhone: true,
      requireInviteCode: settings.registrationMode === "invite_only",
    });
  } catch (e) {
    return NextResponse.json({ error: "server_error", message: String(e) }, { status: 500 });
  }
}
