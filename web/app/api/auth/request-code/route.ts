import { NextResponse } from "next/server";
import { createEmailVerificationCode, getAuthSettings, isValidEmail, isValidPhone } from "@/lib/auth";
import { isEmailConfigured, sendSystemEmail } from "@/lib/email";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { phone?: string; email?: string };
    const email = (body.email ?? "").trim();
    const phone = (body.phone ?? "").trim();

    const settings = await getAuthSettings();
    const { prisma } = await import("@/lib/prisma");

    if (email) {
      if (!isValidEmail(email)) {
        return NextResponse.json({ error: "bad_request", message: "请输入正确的邮箱地址" }, { status: 400 });
      }
      if (!isEmailConfigured(settings)) {
        return NextResponse.json(
          { error: "code_service_unavailable", message: "系统邮箱尚未配置，请联系管理员或改用手机号登录" },
          { status: 400 }
        );
      }

      const existing = await prisma.user.findUnique({ where: { email } });
      const isNewEmail = !existing;

      const code = await createEmailVerificationCode(email);
      try {
        await sendSystemEmail(settings, {
          to: email,
          subject: "Lexcheck 登录验证码",
          text: `您的验证码是：${code}，10 分钟内有效。如非本人操作请忽略此邮件。`,
          html: `<p>您的验证码是：<b style="font-size:18px">${code}</b>，10 分钟内有效。</p><p>如非本人操作请忽略此邮件。</p>`,
        });
      } catch (e) {
        return NextResponse.json(
          { error: "email_send_failed", message: `验证码发送失败：${e instanceof Error ? e.message : String(e)}` },
          { status: 502 }
        );
      }

      return NextResponse.json({
        ok: true,
        isNewEmail,
        requireInviteCode: isNewEmail && settings.registrationMode === "invite_only",
      });
    }

    if (!isValidPhone(phone)) {
      return NextResponse.json({ error: "bad_request", message: "请输入正确的手机号或邮箱" }, { status: 400 });
    }

    if (!settings.tempCodeEnabled) {
      return NextResponse.json(
        { error: "code_service_unavailable", message: "验证码服务暂未开通，请联系管理员" },
        { status: 400 }
      );
    }

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
