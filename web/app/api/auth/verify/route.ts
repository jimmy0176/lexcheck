import { NextResponse } from "next/server";
import { createSession, getAuthSettings, isValidPhone, setSessionCookie } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      phone?: string;
      code?: string;
      name?: string;
      companyName?: string;
      inviteCode?: string;
    };
    const phone = (body.phone ?? "").trim();
    const code = (body.code ?? "").trim();

    if (!isValidPhone(phone)) {
      return NextResponse.json({ error: "bad_request", message: "请输入正确的手机号" }, { status: 400 });
    }
    if (!code) {
      return NextResponse.json({ error: "bad_request", message: "请输入验证码" }, { status: 400 });
    }

    const settings = await getAuthSettings();
    if (!settings.tempCodeEnabled) {
      return NextResponse.json(
        { error: "code_service_unavailable", message: "验证码服务暂未开通，请联系管理员" },
        { status: 400 }
      );
    }
    if (code !== settings.tempCode) {
      return NextResponse.json({ error: "bad_code", message: "验证码错误" }, { status: 400 });
    }

    const { prisma } = await import("@/lib/prisma");
    const existing = await prisma.user.findUnique({ where: { phone } });

    let userId: string;
    if (existing) {
      // 已有账号：直接按该账号本身的角色登录，不需要前端指定角色。
      userId = existing.id;
    } else {
      // 未注册手机号：一律创建为客户账号，律师账号只能由管理员添加。
      if (settings.registrationMode === "invite_only") {
        const inviteCode = (body.inviteCode ?? "").trim();
        if (!inviteCode || !settings.inviteCode || inviteCode !== settings.inviteCode) {
          return NextResponse.json({ error: "bad_invite_code", message: "邀请码错误" }, { status: 400 });
        }
      }
      const name = (body.name ?? "").trim();
      const companyName = (body.companyName ?? "").trim();
      if (!name || !companyName) {
        return NextResponse.json(
          { error: "bad_request", message: "请填写姓名和公司名称" },
          { status: 400 }
        );
      }
      const created = await prisma.user.create({
        data: { phone, role: "client", name, companyName },
      });
      userId = created.id;
    }

    const session = await createSession(userId);
    await setSessionCookie(session.id, session.expiresAt);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        role: user.role,
        isAdmin: user.isAdmin,
        name: user.name,
        companyName: user.companyName,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: "server_error", message: String(e) }, { status: 500 });
  }
}
