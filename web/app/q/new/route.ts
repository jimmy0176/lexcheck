import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const token = randomUUID().replace(/-/g, "").slice(0, 12);
  try {
    const { prisma } = await import("@/lib/prisma");
    await prisma.checkup.create({
      data: {
        token,
        status: "draft",
        companyName: "",
        answersJson: {},
      },
    });
  } catch {
    // DB 不可用时也允许进入问卷页，后续由前端本地模式兜底
  }
  return NextResponse.redirect(new URL(`/q/${token}`, req.url));
}
