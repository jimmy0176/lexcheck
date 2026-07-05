import { randomUUID } from "node:crypto";

export type CheckupAccessResult =
  | { kind: "ok"; token: string }
  | { kind: "cooldown"; hoursRemaining: number };

/**
 * 客户端"新建/继续问卷"的统一入口：
 * 1. 有未提交草稿 -> 直接续填，不受冷却期限制。
 * 2. 无草稿但最近一次提交在冷却期内 -> 拒绝新建。
 * 3. 否则新建一份绑定到该客户账号的问卷。
 */
export async function resolveOrCreateCheckupForClient(clientId: string): Promise<CheckupAccessResult> {
  const { prisma } = await import("@/lib/prisma");

  const draft = await prisma.checkup.findFirst({
    where: { clientId, status: "draft" },
    orderBy: { updatedAt: "desc" },
  });
  if (draft) return { kind: "ok", token: draft.token };

  const lastSubmitted = await prisma.checkup.findFirst({
    where: { clientId, status: "submitted" },
    orderBy: { submittedAt: "desc" },
  });

  if (lastSubmitted?.submittedAt) {
    const { questionnaireCooldownHours } = await prisma.authSettings.findUniqueOrThrow({
      where: { id: "singleton" },
    });
    const elapsedHours = (Date.now() - lastSubmitted.submittedAt.getTime()) / (60 * 60 * 1000);
    if (elapsedHours < questionnaireCooldownHours) {
      return { kind: "cooldown", hoursRemaining: Math.ceil(questionnaireCooldownHours - elapsedHours) };
    }
  }

  const token = randomUUID().replace(/-/g, "").slice(0, 12);
  const created = await prisma.checkup.create({
    data: { token, status: "draft", companyName: "", answersJson: {}, clientId },
  });
  return { kind: "ok", token: created.token };
}
