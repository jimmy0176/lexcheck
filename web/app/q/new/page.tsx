import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { resolveOrCreateCheckupForClient } from "@/lib/questionnaire-access";

export default async function NewQuestionnairePage({
  searchParams,
}: {
  searchParams?: Promise<{ templateId?: string }>;
}) {
  const params = await searchParams;
  const user = await getSessionUser();
  if (!user || user.role !== "client") {
    const returnTo = params?.templateId
      ? `/q/new?templateId=${encodeURIComponent(params.templateId)}`
      : "/q/new";
    redirect(`/?next=${encodeURIComponent(returnTo)}`);
  }

  const templateId = params?.templateId?.trim();
  if (!templateId) {
    return (
      <main className="min-h-dvh bg-background">
        <div className="mx-auto w-full max-w-lg px-6 py-16">
          <h1 className="text-2xl font-semibold tracking-tight">请先选择问卷</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            请返回<Link className="underline underline-offset-4" href="/q">问卷列表</Link>选择一份问卷再新建。
          </p>
        </div>
      </main>
    );
  }

  const result = await resolveOrCreateCheckupForClient(user.id, templateId);
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
