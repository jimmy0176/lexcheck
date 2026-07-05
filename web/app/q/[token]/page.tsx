import { getSessionUser } from "@/lib/auth";
import { ClientAuthGate } from "@/components/auth/ClientAuthGate";
import { QuestionnaireClient } from "./QuestionnaireClient";

export default async function QuestionnairePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const user = await getSessionUser();
  if (!user || user.role !== "client") {
    return <ClientAuthGate message="请登录客户账号后继续填写问卷。" />;
  }

  const { prisma } = await import("@/lib/prisma");
  const checkup = await prisma.checkup.findUnique({ where: { token }, select: { clientId: true } });
  if (checkup && checkup.clientId !== user.id) {
    return (
      <main className="min-h-dvh bg-background">
        <div className="mx-auto w-full max-w-lg px-6 py-16">
          <h1 className="text-2xl font-semibold tracking-tight">无权访问</h1>
          <p className="mt-3 text-sm text-muted-foreground">该问卷不属于当前登录的客户账号。</p>
        </div>
      </main>
    );
  }

  return <QuestionnaireClient token={token} />;
}

