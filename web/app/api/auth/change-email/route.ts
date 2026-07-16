import { NextResponse } from "next/server";
import { consumeEmailVerificationCode, createEmailVerificationCode, getAuthSettings, getSessionUser, isValidEmail } from "@/lib/auth";
import { isEmailConfigured, sendSystemEmail } from "@/lib/email";

export const runtime = "nodejs";

type Body = { step?: "request" | "confirm"; newEmail?: string; code?: string };

/** 已登录用户自助换绑邮箱：先向新邮箱发验证码，再用验证码确认生效，避免误填/被盗用他人邮箱。 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json()) as Body;
  const newEmail = (body.newEmail ?? "").trim();
  if (!isValidEmail(newEmail)) {
    return NextResponse.json({ error: "bad_request", message: "请输入正确的邮箱地址" }, { status: 400 });
  }

  const { prisma } = await import("@/lib/prisma");

  if (body.step === "confirm") {
    const code = (body.code ?? "").trim();
    if (!code) return NextResponse.json({ error: "bad_request", message: "请输入验证码" }, { status: 400 });
    const validCode = await consumeEmailVerificationCode(newEmail, code);
    if (!validCode) return NextResponse.json({ error: "bad_code", message: "验证码错误或已过期" }, { status: 400 });

    const taken = await prisma.user.findUnique({ where: { email: newEmail } });
    if (taken && taken.id !== user.id) {
      return NextResponse.json({ error: "conflict", message: "该邮箱已被其他账号使用" }, { status: 409 });
    }
    const updated = await prisma.user.update({ where: { id: user.id }, data: { email: newEmail } });
    return NextResponse.json({ ok: true, email: updated.email });
  }

  // step === "request"（默认）
  const taken = await prisma.user.findUnique({ where: { email: newEmail } });
  if (taken && taken.id !== user.id) {
    return NextResponse.json({ error: "conflict", message: "该邮箱已被其他账号使用" }, { status: 409 });
  }
  const settings = await getAuthSettings();
  if (!isEmailConfigured(settings)) {
    return NextResponse.json(
      { error: "code_service_unavailable", message: "系统邮箱尚未配置，请联系管理员" },
      { status: 400 }
    );
  }
  const code = await createEmailVerificationCode(newEmail);
  try {
    await sendSystemEmail(settings, {
      to: newEmail,
      subject: "Lexcheck 邮箱换绑验证码",
      text: `您正在将 Lexcheck 账号绑定到此邮箱，验证码是：${code}，10 分钟内有效。如非本人操作请忽略此邮件。`,
      html: `<p>您正在将 Lexcheck 账号绑定到此邮箱，验证码是：<b style="font-size:18px">${code}</b>，10 分钟内有效。</p><p>如非本人操作请忽略此邮件。</p>`,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "email_send_failed", message: `验证码发送失败：${e instanceof Error ? e.message : String(e)}` },
      { status: 502 }
    );
  }
  return NextResponse.json({ ok: true });
}
