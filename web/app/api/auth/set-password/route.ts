import { NextResponse } from "next/server";
import { getSessionUser, hashPassword, verifyPassword } from "@/lib/auth";

export const runtime = "nodejs";

/** 已登录用户自助设置/修改密码：首次设置无需旧密码，已有密码时必须提供正确的旧密码才能修改。 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json()) as { currentPassword?: string; newPassword?: string };
  const newPassword = body.newPassword ?? "";
  if (newPassword.length < 6) {
    return NextResponse.json({ error: "bad_request", message: "新密码至少 6 位" }, { status: 400 });
  }

  if (user.passwordHash) {
    const currentPassword = body.currentPassword ?? "";
    if (!currentPassword || !verifyPassword(currentPassword, user.passwordHash)) {
      return NextResponse.json({ error: "bad_password", message: "原密码不正确" }, { status: 400 });
    }
  }

  const { prisma } = await import("@/lib/prisma");
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(newPassword) } });

  return NextResponse.json({ ok: true });
}
