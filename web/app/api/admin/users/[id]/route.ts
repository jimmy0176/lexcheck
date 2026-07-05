import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";

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
    };

    if (id === admin.id && typeof body.isAdmin === "boolean" && !body.isAdmin) {
      return NextResponse.json(
        { error: "bad_request", message: "不能取消自己的管理员权限，请由其他管理员操作" },
        { status: 400 }
      );
    }

    const data: Record<string, unknown> = {};
    if (typeof body.name === "string") data.name = body.name.trim() || null;
    if (typeof body.companyName === "string") data.companyName = body.companyName.trim() || null;
    if (typeof body.isAdmin === "boolean") data.isAdmin = body.isAdmin;

    const { prisma } = await import("@/lib/prisma");
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
