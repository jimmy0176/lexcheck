import { NextResponse } from "next/server";
import { requireLawyerApi } from "@/lib/auth";

export const runtime = "nodejs";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const lawyer = await requireLawyerApi();
  if (!lawyer) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = (await req.json()) as { name?: string; companyName?: string };
  const data: { name?: string | null; companyName?: string } = {};
  if (typeof body.name === "string") data.name = body.name.trim() || null;
  if (typeof body.companyName === "string") {
    const companyName = body.companyName.trim();
    if (!companyName) {
      return NextResponse.json({ error: "bad_request", message: "公司名称不能为空" }, { status: 400 });
    }
    data.companyName = companyName;
  }

  const { prisma } = await import("@/lib/prisma");
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
