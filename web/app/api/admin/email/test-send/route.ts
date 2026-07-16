import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { sendSystemEmail } from "@/lib/email";

export const runtime = "nodejs";

type Body = {
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUser?: string;
  smtpPass?: string;
  smtpFromName?: string;
  to?: string;
};

export async function POST(req: Request) {
  const admin = await requireAdminApi();
  if (!admin) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "请求体无效" }, { status: 400 });
  }

  const host = (body.smtpHost ?? "").trim();
  const port = body.smtpPort ?? 465;
  const secure = body.smtpSecure ?? true;
  const user = (body.smtpUser ?? "").trim();
  const pass = (body.smtpPass ?? "").trim();
  const fromName = (body.smtpFromName ?? "").trim() || "Lexcheck";
  const to = (body.to ?? "").trim();

  if (!host) return NextResponse.json({ ok: false, error: "请填写 SMTP 服务器地址" }, { status: 400 });
  if (!user || !pass) return NextResponse.json({ ok: false, error: "请填写发件邮箱与授权码/密码" }, { status: 400 });
  if (!to) return NextResponse.json({ ok: false, error: "请填写测试收件邮箱" }, { status: 400 });

  const started = Date.now();
  try {
    await sendSystemEmail(
      { smtpHost: host, smtpPort: port, smtpSecure: secure, smtpUser: user, smtpPass: pass, smtpFromName: fromName },
      {
        to,
        subject: "Lexcheck 系统邮箱测试",
        text: "这是一封来自 Lexcheck 系统邮箱配置的测试邮件，收到即代表配置可用。",
        html: "<p>这是一封来自 <b>Lexcheck</b> 系统邮箱配置的测试邮件，收到即代表配置可用。</p>",
      }
    );

    const elapsedMs = Date.now() - started;
    return NextResponse.json({
      ok: true,
      elapsedMs,
      message: `发送成功，耗时约 ${elapsedMs} ms`,
    });
  } catch (e) {
    const elapsedMs = Date.now() - started;
    const err = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, elapsedMs, error: `发送失败：${err}` });
  }
}
