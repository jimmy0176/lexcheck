import { NextResponse } from "next/server";
import {
  consumeEmailVerificationCode,
  createSession,
  getAuthSettings,
  isValidEmail,
  isValidPhone,
  setSessionCookie,
  verifyPassword,
} from "@/lib/auth";

export const runtime = "nodejs";

type Body = {
  method?: "phone_code" | "email_code" | "email_password";
  phone?: string;
  email?: string;
  code?: string;
  password?: string;
  name?: string;
  companyName?: string;
  inviteCode?: string;
};

function publicUser(user: { id: string; role: string; isAdmin: boolean; name: string | null; companyName: string | null }) {
  return {
    id: user.id,
    role: user.role,
    isAdmin: user.isAdmin,
    name: user.name,
    companyName: user.companyName,
  };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const method = body.method ?? "phone_code";
    const settings = await getAuthSettings();
    const { prisma } = await import("@/lib/prisma");

    if (method === "email_password") {
      const email = (body.email ?? "").trim();
      const password = body.password ?? "";
      if (!isValidEmail(email)) {
        return NextResponse.json({ error: "bad_request", message: "请输入正确的邮箱地址" }, { status: 400 });
      }
      if (!password) {
        return NextResponse.json({ error: "bad_request", message: "请输入密码" }, { status: 400 });
      }
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        return NextResponse.json({ error: "not_found", message: "账号不存在" }, { status: 400 });
      }
      if (!user.passwordHash) {
        return NextResponse.json(
          { error: "no_password", message: "该账号尚未设置密码，请使用邮箱验证码登录" },
          { status: 400 }
        );
      }
      if (!verifyPassword(password, user.passwordHash)) {
        return NextResponse.json({ error: "bad_password", message: "密码错误" }, { status: 400 });
      }
      const session = await createSession(user.id);
      await setSessionCookie(session.id, session.expiresAt);
      return NextResponse.json({ ok: true, user: publicUser(user) });
    }

    if (method === "email_code") {
      const email = (body.email ?? "").trim();
      const code = (body.code ?? "").trim();
      if (!isValidEmail(email)) {
        return NextResponse.json({ error: "bad_request", message: "请输入正确的邮箱地址" }, { status: 400 });
      }
      if (!code) {
        return NextResponse.json({ error: "bad_request", message: "请输入验证码" }, { status: 400 });
      }
      const validCode = await consumeEmailVerificationCode(email, code);
      if (!validCode) {
        return NextResponse.json({ error: "bad_code", message: "验证码错误或已过期" }, { status: 400 });
      }

      const existing = await prisma.user.findUnique({ where: { email } });
      let userId: string;
      if (existing) {
        userId = existing.id;
      } else {
        if (settings.registrationMode === "invite_only") {
          const inviteCode = (body.inviteCode ?? "").trim();
          if (!inviteCode || !settings.inviteCode || inviteCode !== settings.inviteCode) {
            return NextResponse.json({ error: "bad_invite_code", message: "邀请码错误" }, { status: 400 });
          }
        }
        const name = (body.name ?? "").trim();
        const companyName = (body.companyName ?? "").trim();
        if (!name || !companyName) {
          return NextResponse.json({ error: "bad_request", message: "请填写姓名和公司名称" }, { status: 400 });
        }
        const phone = (body.phone ?? "").trim();
        if (phone && !isValidPhone(phone)) {
          return NextResponse.json({ error: "bad_request", message: "手机号格式不正确" }, { status: 400 });
        }
        if (phone) {
          const phoneTaken = await prisma.user.findUnique({ where: { phone } });
          if (phoneTaken) {
            return NextResponse.json({ error: "conflict", message: "该手机号已被其他账号使用" }, { status: 409 });
          }
        }
        const created = await prisma.user.create({
          data: { email, phone: phone || null, role: "client", name, companyName },
        });
        userId = created.id;
      }
      const session = await createSession(userId);
      await setSessionCookie(session.id, session.expiresAt);
      const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
      return NextResponse.json({ ok: true, user: publicUser(user) });
    }

    // method === "phone_code"（默认，向后兼容旧客户端）
    const phone = (body.phone ?? "").trim();
    const code = (body.code ?? "").trim();

    if (!isValidPhone(phone)) {
      return NextResponse.json({ error: "bad_request", message: "请输入正确的手机号" }, { status: 400 });
    }
    if (!code) {
      return NextResponse.json({ error: "bad_request", message: "请输入验证码" }, { status: 400 });
    }
    if (!settings.tempCodeEnabled) {
      return NextResponse.json(
        { error: "code_service_unavailable", message: "验证码服务暂未开通，请联系管理员" },
        { status: 400 }
      );
    }
    if (code !== settings.tempCode) {
      return NextResponse.json({ error: "bad_code", message: "验证码错误" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { phone } });
    let userId: string;
    if (existing) {
      userId = existing.id;
    } else {
      if (settings.registrationMode === "invite_only") {
        const inviteCode = (body.inviteCode ?? "").trim();
        if (!inviteCode || !settings.inviteCode || inviteCode !== settings.inviteCode) {
          return NextResponse.json({ error: "bad_invite_code", message: "邀请码错误" }, { status: 400 });
        }
      }
      const name = (body.name ?? "").trim();
      const companyName = (body.companyName ?? "").trim();
      if (!name || !companyName) {
        return NextResponse.json({ error: "bad_request", message: "请填写姓名和公司名称" }, { status: 400 });
      }
      const created = await prisma.user.create({
        data: { phone, role: "client", name, companyName },
      });
      userId = created.id;
    }

    const session = await createSession(userId);
    await setSessionCookie(session.id, session.expiresAt);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return NextResponse.json({ ok: true, user: publicUser(user) });
  } catch (e) {
    return NextResponse.json({ error: "server_error", message: String(e) }, { status: 500 });
  }
}
