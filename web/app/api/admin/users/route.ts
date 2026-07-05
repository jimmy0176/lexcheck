import { NextResponse } from "next/server";
import { isValidPhone, requireAdminApi } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const admin = await requireAdminApi();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { prisma } = await import("@/lib/prisma");
  const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ users });
}

export async function POST(req: Request) {
  const admin = await requireAdminApi();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  try {
    const body = (await req.json()) as {
      phone?: string;
      role?: string;
      name?: string;
      companyName?: string;
      isAdmin?: boolean;
    };
    const phone = (body.phone ?? "").trim();
    const role = body.role === "lawyer" ? "lawyer" : body.role === "client" ? "client" : null;
    const name = (body.name ?? "").trim();
    const companyName = (body.companyName ?? "").trim();

    if (!isValidPhone(phone)) {
      return NextResponse.json({ error: "bad_request", message: "请输入正确的手机号" }, { status: 400 });
    }
    if (!role) {
      return NextResponse.json({ error: "bad_request", message: "请选择账号角色" }, { status: 400 });
    }
    if (role === "client" && !companyName) {
      return NextResponse.json({ error: "bad_request", message: "客户账号需填写公司名称" }, { status: 400 });
    }

    const { prisma } = await import("@/lib/prisma");
    const existing = await prisma.user.findUnique({ where: { phone } });
    if (existing) {
      return NextResponse.json({ error: "conflict", message: "该手机号已存在账号" }, { status: 409 });
    }

    const user = await prisma.user.create({
      data: {
        phone,
        role,
        name: name || null,
        companyName: role === "client" ? companyName : null,
        isAdmin: role === "lawyer" ? Boolean(body.isAdmin) : false,
      },
    });
    return NextResponse.json({ ok: true, user });
  } catch (e) {
    return NextResponse.json({ error: "server_error", message: String(e) }, { status: 500 });
  }
}
