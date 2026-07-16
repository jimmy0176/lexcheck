import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ user: null });
  return NextResponse.json({
    user: {
      id: user.id,
      role: user.role,
      isAdmin: user.isAdmin,
      name: user.name,
      companyName: user.companyName,
    },
  });
}

/** 任意登录用户自助修改自己的姓名（仅姓名，不改手机号/公司名称/角色）。 */
export async function PATCH(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json()) as { name?: string };
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "bad_request", message: "姓名不能为空" }, { status: 400 });
  }

  const { prisma } = await import("@/lib/prisma");
  const updated = await prisma.user.update({ where: { id: user.id }, data: { name } });

  return NextResponse.json({
    ok: true,
    user: {
      id: updated.id,
      role: updated.role,
      isAdmin: updated.isAdmin,
      name: updated.name,
      companyName: updated.companyName,
    },
  });
}
