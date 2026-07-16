import { NextResponse } from "next/server";
import { getAuthSettings, requireAdminApi } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const admin = await requireAdminApi();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const settings = await getAuthSettings();
  return NextResponse.json({ settings });
}

export async function PATCH(req: Request) {
  const admin = await requireAdminApi();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  try {
    const body = (await req.json()) as {
      tempCodeEnabled?: boolean;
      tempCode?: string;
      registrationMode?: string;
      inviteCode?: string;
      questionnaireCooldownHours?: number;
      sharedLlmProviderId?: string;
      sharedLlmModel?: string;
      sharedLlmApiKey?: string;
      sharedLlmBaseUrl?: string;
      backupLlmProviderId?: string;
      backupLlmModel?: string;
      backupLlmApiKey?: string;
      backupLlmBaseUrl?: string;
      smtpHost?: string;
      smtpPort?: number;
      smtpSecure?: boolean;
      smtpUser?: string;
      smtpPass?: string;
      smtpFromName?: string;
    };

    const data: Record<string, unknown> = {};
    if (typeof body.tempCodeEnabled === "boolean") data.tempCodeEnabled = body.tempCodeEnabled;
    if (typeof body.tempCode === "string") {
      const t = body.tempCode.trim();
      if (!t) return NextResponse.json({ error: "bad_request", message: "临时验证码不能为空" }, { status: 400 });
      data.tempCode = t;
    }
    if (body.registrationMode === "open" || body.registrationMode === "invite_only") {
      data.registrationMode = body.registrationMode;
    }
    if (typeof body.inviteCode === "string") data.inviteCode = body.inviteCode.trim();
    if (typeof body.questionnaireCooldownHours === "number") {
      if (!Number.isFinite(body.questionnaireCooldownHours) || body.questionnaireCooldownHours < 0) {
        return NextResponse.json({ error: "bad_request", message: "冷却小时数须为非负数" }, { status: 400 });
      }
      data.questionnaireCooldownHours = Math.round(body.questionnaireCooldownHours);
    }
    if (typeof body.sharedLlmProviderId === "string") data.sharedLlmProviderId = body.sharedLlmProviderId.trim() || null;
    if (typeof body.sharedLlmModel === "string") data.sharedLlmModel = body.sharedLlmModel.trim() || null;
    if (typeof body.sharedLlmApiKey === "string") data.sharedLlmApiKey = body.sharedLlmApiKey.trim() || null;
    if (typeof body.sharedLlmBaseUrl === "string") data.sharedLlmBaseUrl = body.sharedLlmBaseUrl.trim() || null;
    if (typeof body.backupLlmProviderId === "string") data.backupLlmProviderId = body.backupLlmProviderId.trim() || null;
    if (typeof body.backupLlmModel === "string") data.backupLlmModel = body.backupLlmModel.trim() || null;
    if (typeof body.backupLlmApiKey === "string") data.backupLlmApiKey = body.backupLlmApiKey.trim() || null;
    if (typeof body.backupLlmBaseUrl === "string") data.backupLlmBaseUrl = body.backupLlmBaseUrl.trim() || null;
    if (typeof body.smtpHost === "string") data.smtpHost = body.smtpHost.trim() || null;
    if (typeof body.smtpPort === "number") {
      if (!Number.isFinite(body.smtpPort) || body.smtpPort <= 0) {
        return NextResponse.json({ error: "bad_request", message: "SMTP 端口须为正数" }, { status: 400 });
      }
      data.smtpPort = Math.round(body.smtpPort);
    }
    if (typeof body.smtpSecure === "boolean") data.smtpSecure = body.smtpSecure;
    if (typeof body.smtpUser === "string") data.smtpUser = body.smtpUser.trim() || null;
    if (typeof body.smtpPass === "string") data.smtpPass = body.smtpPass.trim() || null;
    if (typeof body.smtpFromName === "string") data.smtpFromName = body.smtpFromName.trim() || null;

    const { prisma } = await import("@/lib/prisma");
    const settings = await prisma.authSettings.update({ where: { id: "singleton" }, data });
    return NextResponse.json({ ok: true, settings });
  } catch (e) {
    return NextResponse.json({ error: "server_error", message: String(e) }, { status: 500 });
  }
}
