import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { resolveOrCreateCheckupForClient } from "@/lib/questionnaire-access";
import { ClientAuthGate } from "@/components/auth/ClientAuthGate";

export default async function NewQuestionnairePage() {
  const user = await getSessionUser();
  if (!user || user.role !== "client") {
    return <ClientAuthGate message="请登录客户账号后新建问卷。" />;
  }

  const result = await resolveOrCreateCheckupForClient(user.id);
  if (result.kind === "cooldown") {
    return (
      <main className="min-h-dvh bg-background">
        <div className="mx-auto w-full max-w-lg px-6 py-16">
          <h1 className="text-2xl font-semibold tracking-tight">暂时无法新建问卷</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            距离上次提交时间较近，还需等待约 {result.hoursRemaining} 小时后才能再次填写。如需提前重新填写，请联系您的律师。
          </p>
        </div>
      </main>
    );
  }

  redirect(`/q/${result.token}`);
}
