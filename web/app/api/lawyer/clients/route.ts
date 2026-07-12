import { NextResponse } from "next/server";
import { isValidPhone, requireLawyerApi } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const lawyer = await requireLawyerApi();
  if (!lawyer) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { prisma } = await import("@/lib/prisma");
  const clients = await prisma.user.findMany({
    where: { role: "client" },
    select: { id: true, name: true, companyName: true, phone: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ clients });
}

export async function POST(req: Request) {
  const lawyer = await requireLawyerApi();
  if (!lawyer) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const body = (await req.json()) as { phone?: string; name?: string; companyName?: string };
    const phone = (body.phone ?? "").trim();
    const name = (body.name ?? "").trim();
    const companyName = (body.companyName ?? "").trim();

    if (!isValidPhone(phone)) {
      return NextResponse.json({ error: "bad_request", message: "请输入正确的手机号" }, { status: 400 });
    }
    if (!companyName) {
      return NextResponse.json({ error: "bad_request", message: "客户账号需填写公司名称" }, { status: 400 });
    }

    const { prisma } = await import("@/lib/prisma");
    const existing = await prisma.user.findUnique({ where: { phone } });
    if (existing) {
      return NextResponse.json({ error: "conflict", message: "该手机号已存在账号" }, { status: 409 });
    }

    const user = await prisma.user.create({
      data: { phone, role: "client", name: name || null, companyName },
    });
    return NextResponse.json({ ok: true, user });
  } catch (e) {
    return NextResponse.json({ error: "server_error", message: String(e) }, { status: 500 });
  }
}
