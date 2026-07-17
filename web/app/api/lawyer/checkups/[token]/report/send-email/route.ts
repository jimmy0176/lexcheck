import { NextResponse } from "next/server";
import { getAuthSettings, isValidEmail, requireLawyerApi } from "@/lib/auth";
import { isEmailConfigured, sendSystemEmail } from "@/lib/email";
import { buildReportDocxBuffer } from "@/lib/report-docx";

export const runtime = "nodejs";

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const lawyer = await requireLawyerApi();
  if (!lawyer) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { token } = await params;
  const body = (await req.json()) as { to?: string; subject?: string; message?: string };

  const { prisma } = await import("@/lib/prisma");
  const checkup = await prisma.checkup.findUnique({
    where: { token },
    include: {
      client: { select: { email: true } },
      workspace: { include: { finalReport: true } },
    },
  });
  if (!checkup) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const reportText = checkup.workspace?.finalReport?.reportText?.trim();
  if (!reportText) {
    return NextResponse.json({ error: "bad_request", message: "请先保存报告后再发送" }, { status: 400 });
  }

  const to = (body.to ?? "").trim() || checkup.client?.email?.trim() || "";
  if (!isValidEmail(to)) {
    return NextResponse.json({ error: "bad_request", message: "请填写正确的收件邮箱" }, { status: 400 });
  }

  const settings = await getAuthSettings();
  if (!isEmailConfigured(settings)) {
    return NextResponse.json(
      { error: "email_not_configured", message: "系统邮箱尚未配置，请联系管理员在后台管理-系统邮箱中设置" },
      { status: 400 }
    );
  }

  const companyLabel = checkup.companyName?.trim() || "企业";
  const subject = (body.subject ?? "").trim() || `${companyLabel}法律体检报告`;
  const message = (body.message ?? "").trim() || `附件为${companyLabel}的企业法律体检报告，请查收。如有疑问请随时联系我们。`;
  const filenameBase = (checkup.companyName?.trim() || token).replace(/[/\\?%*:|"<>]/g, "_").slice(0, 60);

  let attachment: Buffer;
  try {
    attachment = await buildReportDocxBuffer(reportText, {
      companyName: checkup.companyName,
      issueDate: checkup.workspace?.finalReport?.generatedAt,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "server_error", message: `报告生成 Word 附件失败：${e instanceof Error ? e.message : String(e)}` },
      { status: 500 }
    );
  }

  try {
    await sendSystemEmail(settings, {
      to,
      subject,
      text: message,
      html: `<p>${escapeHtml(message).replace(/\n/g, "<br/>")}</p>`,
      attachments: [{ filename: `${filenameBase}.docx`, content: attachment }],
    });
  } catch (e) {
    return NextResponse.json(
      { error: "email_send_failed", message: `发送失败：${e instanceof Error ? e.message : String(e)}` },
      { status: 502 }
    );
  }

  if (checkup.workspace) {
    await prisma.checkupFinalReport.update({
      where: { workspaceId: checkup.workspace.id },
      data: { emailSentAt: new Date(), emailSentTo: to },
    });
  }

  return NextResponse.json({ ok: true, sentTo: to });
}
