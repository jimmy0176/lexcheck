import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { clearSessionCookie, SESSION_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  try {
    const store = await cookies();
    const id = store.get(SESSION_COOKIE)?.value;
    if (id) {
      const { prisma } = await import("@/lib/prisma");
      await prisma.session.delete({ where: { id } }).catch(() => {});
    }
    await clearSessionCookie();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: "server_error", message: String(e) }, { status: 500 });
  }
}
