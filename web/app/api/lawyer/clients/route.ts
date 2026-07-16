import { NextResponse } from "next/server";
import { isValidEmail, isValidPhone, requireLawyerApi } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const lawyer = await requireLawyerApi();
  if (!lawyer) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { prisma } = await import("@/lib/prisma");
  const clients = await prisma.user.findMany({
    where: { role: "client" },
    select: { id: true, name: true, companyName: true, email: true, phone: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ clients });
}

export async function POST(req: Request) {
  const lawyer = await requireLawyerApi();
  if (!lawyer) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const body = (await req.json()) as { email?: string; phone?: string; name?: string; companyName?: string };
    const email = (body.email ?? "").trim();
    const phone = (body.phone ?? "").trim();
    const name = (body.name ?? "").trim();
    const companyName = (body.companyName ?? "").trim();

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "bad_request", message: "请输入正确的邮箱地址" }, { status: 400 });
    }
    if (phone && !isValidPhone(phone)) {
      return NextResponse.json({ error: "bad_request", message: "手机号格式不正确" }, { status: 400 });
    }
    if (!companyName) {
      return NextResponse.json({ error: "bad_request", message: "客户账号需填写公司名称" }, { status: 400 });
    }

    const { prisma } = await import("@/lib/prisma");
    const existingEmail = await prisma.user.findUnique({ where: { email } });
    if (existingEmail) {
      return NextResponse.json({ error: "conflict", message: "该邮箱已存在账号" }, { status: 409 });
    }
    if (phone) {
      const existingPhone = await prisma.user.findUnique({ where: { phone } });
      if (existingPhone) {
        return NextResponse.json({ error: "conflict", message: "该手机号已存在账号" }, { status: 409 });
      }
    }

    const user = await prisma.user.create({
      data: { email, phone: phone || null, role: "client", name: name || null, companyName },
    });
    return NextResponse.json({ ok: true, user });
  } catch (e) {
    return NextResponse.json({ error: "server_error", message: String(e) }, { status: 500 });
  }
}
