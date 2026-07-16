import { NextResponse } from "next/server";
import { isValidEmail, isValidPhone, requireLawyerApi } from "@/lib/auth";

export const runtime = "nodejs";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const lawyer = await requireLawyerApi();
  if (!lawyer) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = (await req.json()) as { name?: string; companyName?: string; email?: string; phone?: string };
  const data: { name?: string | null; companyName?: string; email?: string; phone?: string | null } = {};
  if (typeof body.name === "string") data.name = body.name.trim() || null;
  if (typeof body.companyName === "string") {
    const companyName = body.companyName.trim();
    if (!companyName) {
      return NextResponse.json({ error: "bad_request", message: "公司名称不能为空" }, { status: 400 });
    }
    data.companyName = companyName;
  }

  const { prisma } = await import("@/lib/prisma");
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

  // 用 updateMany + role 过滤，确保这个面向普通律师开放的接口永远无法碰到律师账号。
  const result = await prisma.user.updateMany({ where: { id, role: "client" }, data });
  if (result.count === 0) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const user = await prisma.user.findUnique({ where: { id } });
  return NextResponse.json({ ok: true, user });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const lawyer = await requireLawyerApi();
  if (!lawyer) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const { prisma } = await import("@/lib/prisma");
  const result = await prisma.user.deleteMany({ where: { id, role: "client" } });
  if (result.count === 0) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
