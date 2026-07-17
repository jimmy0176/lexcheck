import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { User } from "@prisma/client";

export const SESSION_COOKIE = "lexcheck_session";
const SESSION_TTL_DAYS = 30;

/** 初始总管理员账号：律师角色 + isAdmin，短信服务商未接入前用临时验证码登录。 */
export const BOOTSTRAP_ADMIN_PHONE = "13906259519";

export const PHONE_PATTERN = /^1[3-9]\d{9}$/;

export function isValidPhone(phone: string): boolean {
  return PHONE_PATTERN.test(phone.trim());
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email.trim());
}

const SCRYPT_KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, SCRYPT_KEYLEN);
  const expected = Buffer.from(hash, "hex");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

const EMAIL_CODE_TTL_MINUTES = 10;

/** 生成一个 6 位邮箱验证码并落库（不负责发送）；调用方拿到返回值后自行通过系统邮箱发出。 */
export async function createEmailVerificationCode(email: string): Promise<string> {
  const { prisma } = await import("@/lib/prisma");
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + EMAIL_CODE_TTL_MINUTES * 60 * 1000);
  await prisma.emailVerificationCode.create({ data: { email, code, expiresAt } });
  return code;
}

/** 校验并一次性消费一个邮箱验证码；成功返回 true，过期/错误/已用过返回 false。 */
export async function consumeEmailVerificationCode(email: string, code: string): Promise<boolean> {
  const { prisma } = await import("@/lib/prisma");
  const record = await prisma.emailVerificationCode.findFirst({
    where: { email, code, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!record) return false;
  await prisma.emailVerificationCode.update({ where: { id: record.id }, data: { consumedAt: new Date() } });
  return true;
}

/** 幂等初始化：确保单例配置行和种子管理员账号存在。可在任意请求路径上重复调用。 */
export async function ensureBootstrapAuthState(): Promise<void> {
  const { prisma } = await import("@/lib/prisma");
  await prisma.authSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton" },
    update: {},
  });
  await prisma.user.upsert({
    where: { phone: BOOTSTRAP_ADMIN_PHONE },
    create: { phone: BOOTSTRAP_ADMIN_PHONE, role: "lawyer", isAdmin: true, name: "系统管理员" },
    update: {},
  });
}

export async function getAuthSettings() {
  await ensureBootstrapAuthState();
  const { prisma } = await import("@/lib/prisma");
  return prisma.authSettings.findUniqueOrThrow({ where: { id: "singleton" } });
}

export async function createSession(userId: string) {
  const { prisma } = await import("@/lib/prisma");
  const id = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  await prisma.session.create({ data: { id, userId, expiresAt } });
  return { id, expiresAt };
}

export async function setSessionCookie(id: string, expiresAt: Date) {
  const store = await cookies();
  store.set(SESSION_COOKIE, id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getSessionUser(): Promise<User | null> {
  const store = await cookies();
  const id = store.get(SESSION_COOKIE)?.value;
  if (!id) return null;
  const { prisma } = await import("@/lib/prisma");
  const session = await prisma.session.findUnique({ where: { id }, include: { user: true } });
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({ where: { id } }).catch(() => {});
    return null;
  }
  return session.user;
}

/** 供 Server Component 页面使用：未登录或非律师角色时跳转到首页登录；已登录但角色不对时首页会按角色送回其自己的主页，不会死循环。 */
export async function requireLawyerPage(): Promise<User> {
  const user = await getSessionUser();
  if (!user || user.role !== "lawyer") redirect("/");
  return user;
}

/** 供 Server Component 页面使用：非管理员跳回工作台首页。 */
export async function requireAdminPage(): Promise<User> {
  const user = await requireLawyerPage();
  if (!user.isAdmin) redirect("/lawyer/checkups/lexcheck");
  return user;
}

/** 供 Route Handler 使用：返回 null 时由调用方响应 401。 */
export async function requireLawyerApi(): Promise<User | null> {
  const user = await getSessionUser();
  if (!user || user.role !== "lawyer") return null;
  return user;
}

export async function requireAdminApi(): Promise<User | null> {
  const user = await requireLawyerApi();
  if (!user || !user.isAdmin) return null;
  return user;
}

export async function requireClientApi(): Promise<User | null> {
  const user = await getSessionUser();
  if (!user || user.role !== "client") return null;
  return user;
}
