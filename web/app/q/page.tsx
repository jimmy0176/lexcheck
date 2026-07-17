import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { getSessionUser } from "@/lib/auth";
import { ensureDefaultQuestionnaireTemplate } from "@/lib/questionnaire-templates";

export default async function QuestionnaireEntryPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/?next=%2Fq");
  }
  if (user.role !== "client") {
    // 已登录但不是客户账号（例如律师账号误入这个客户专用地址）：直接送回该角色自己的主页，
    // 不能再走 /?next=... 那一套，否则会跟首页"已登录则按 next 跳转"的逻辑来回反弹。
    redirect("/lawyer/checkups/lexcheck");
  }

  let templates: Array<{
    id: string;
    name: string;
    note: string | null;
    status: "none" | "draft" | "submitted";
    token: string | null;
  }> = [];
  let dbError = false;

  try {
    const { prisma } = await import("@/lib/prisma");
    await ensureDefaultQuestionnaireTemplate(prisma);

    const assignments = await prisma.questionnaireAssignment.findMany({
      where: { OR: [{ clientId: null }, { clientId: user.id }] },
      include: { template: true },
    });
    const templateMap = new Map(assignments.map((a) => [a.templateId, a.template]));

    const checkups = await prisma.checkup.findMany({
      where: { clientId: user.id, templateId: { in: [...templateMap.keys()] } },
      orderBy: { updatedAt: "desc" },
    });

    templates = [...templateMap.values()].map((t) => {
      const draft = checkups.find((c) => c.templateId === t.id && c.status === "draft");
      const lastSubmitted = checkups
        .filter((c) => c.templateId === t.id && c.status === "submitted")
        .sort((a, b) => (b.submittedAt?.getTime() ?? 0) - (a.submittedAt?.getTime() ?? 0))[0];
      return {
        id: t.id,
        name: t.name,
        note: t.note,
        status: draft ? "draft" : lastSubmitted ? "submitted" : "none",
        token: draft?.token ?? lastSubmitted?.token ?? null,
      };
    });
  } catch {
    dbError = true;
  }

  return (
    <main className="min-h-dvh bg-background">
      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        <div className="text-sm text-muted-foreground">客户问卷</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">选择填写的问卷</h1>

        {dbError && (
          <Card className="mt-4 p-4 text-sm text-muted-foreground">数据库暂不可用，请稍后重试。</Card>
        )}

        <div className="mt-6 space-y-3">
          {!dbError && templates.length === 0 ? (
            <Card className="p-6 text-sm text-muted-foreground">
              暂无可填写的问卷，请联系您的律师推送问卷。
            </Card>
          ) : (
            templates.map((t) => (
              <Card key={t.id} className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-sm font-medium">{t.name}</div>
                    {t.note ? <div className="text-xs text-muted-foreground">{t.note}</div> : null}
                    <div className="text-xs text-muted-foreground">
                      状态：{t.status === "draft" ? "草稿未提交" : t.status === "submitted" ? "已提交" : "尚未开始"}
                    </div>
                  </div>
                  {t.status === "draft" && t.token ? (
                    <Link
                      href={`/q/${t.token}`}
                      className="text-sm font-medium text-primary underline underline-offset-4"
                    >
                      继续填写
                    </Link>
                  ) : t.status === "submitted" && t.token ? (
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/q/${t.token}`}
                        className="text-sm font-medium text-muted-foreground underline underline-offset-4"
                      >
                        查看
                      </Link>
                      <Link
                        href={`/q/new?templateId=${encodeURIComponent(t.id)}`}
                        className="text-sm font-medium text-primary underline underline-offset-4"
                      >
                        重新填写
                      </Link>
                    </div>
                  ) : (
                    <Link
                      href={`/q/new?templateId=${encodeURIComponent(t.id)}`}
                      className="inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium hover:bg-muted/30"
                    >
                      开始填写
                    </Link>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
