export type SmtpConfig = {
  smtpHost: string | null;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string | null;
  smtpPass: string | null;
  smtpFromName: string | null;
};

export function isEmailConfigured(settings: SmtpConfig): boolean {
  return Boolean(settings.smtpHost?.trim() && settings.smtpUser?.trim() && settings.smtpPass?.trim());
}

export async function sendSystemEmail(
  settings: SmtpConfig,
  opts: {
    to: string;
    subject: string;
    text?: string;
    html?: string;
    attachments?: { filename: string; content: Buffer }[];
  }
) {
  if (!isEmailConfigured(settings)) {
    throw new Error("系统邮箱未配置，请联系管理员在后台管理-系统邮箱中设置");
  }
  const nodemailer = await import("nodemailer");
  const transporter = nodemailer.createTransport({
    host: settings.smtpHost!.trim(),
    port: settings.smtpPort,
    secure: settings.smtpSecure,
    auth: { user: settings.smtpUser!.trim(), pass: settings.smtpPass!.trim() },
    connectionTimeout: 15_000,
    socketTimeout: 30_000,
  });
  const fromName = settings.smtpFromName?.trim() || "Lexcheck";
  await transporter.sendMail({
    from: `"${fromName}" <${settings.smtpUser!.trim()}>`,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
    attachments: opts.attachments,
  });
}
