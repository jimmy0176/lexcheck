import { NextResponse } from "next/server";
import { isValidEmail, isValidPhone, requireAdminApi } from "@/lib/auth";

export const runtime = "nodejs";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminApi();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;

  try {
    const body = (await req.json()) as {
      name?: string;
      companyName?: string;
      isAdmin?: boolean;
      email?: string;
      phone?: string;
    };

    if (id === admin.id && typeof body.isAdmin === "boolean" && !body.isAdmin) {
      return NextResponse.json(
        { error: "bad_request", message: "不能取消自己的管理员权限，请由其他管理员操作" },
        { status: 400 }
      );
    }

    const { prisma } = await import("@/lib/prisma");
    const data: Record<string, unknown> = {};
    if (typeof body.name === "string") data.name = body.name.trim() || null;
    if (typeof body.companyName === "string") data.companyName = body.companyName.trim() || null;
    if (typeof body.isAdmin === "boolean") data.isAdmin = body.isAdmin;
    if (typeof body.email === "string") {
      const email = body.email.trim();
      if (!email || !isValidEmail(email)) {
        return NextResponse.json({ error: "bad_request", message: "请输入正确的邮箱地址" }, { status: 400 });
      }
      const taken = await prisma.user.findUnique({ where: { email } });
      if (taken && taken.id !== id) {
        return NextResponse.json({ error: "conflict", message: "该邮箱已被其他账号使用" }, { status: 409 });
      }
      data.email = email;
    }
    if (typeof body.phone === "string") {
      const phone = body.phone.trim();
      if (phone) {
        if (!isValidPhone(phone)) {
          return NextResponse.json({ error: "bad_request", message: "手机号格式不正确" }, { status: 400 });
        }
        const taken = await prisma.user.findUnique({ where: { phone } });
        if (taken && taken.id !== id) {
          return NextResponse.json({ error: "conflict", message: "该手机号已被其他账号使用" }, { status: 409 });
        }
      }
      data.phone = phone || null;
    }

    const user = await prisma.user.update({ where: { id }, data });
    return NextResponse.json({ ok: true, user });
  } catch (e) {
    return NextResponse.json({ error: "server_error", message: String(e) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminApi();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;

  if (id === admin.id) {
    return NextResponse.json({ error: "bad_request", message: "不能删除自己的账号" }, { status: 400 });
  }

  try {
    const { prisma } = await import("@/lib/prisma");
    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: "server_error", message: String(e) }, { status: 500 });
  }
}
