import Link from "next/link";
import { Card } from "@/components/ui/card";

export default async function QuestionnaireEntryPage() {
  let drafts: Array<{
    id: string;
    token: string;
    companyName: string | null;
    savedAt: Date;
  }> = [];
  let dbError = false;

  try {
    const { prisma } = await import("@/lib/prisma");
    drafts = await prisma.checkup.findMany({
      where: { status: "draft" },
      orderBy: { updatedAt: "desc" },
      take: 30,
    });
  } catch {
    dbError = true;
  }

  return (
    <main className="min-h-dvh bg-background">
      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        <div className="text-sm text-muted-foreground">客户问卷</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">选择继续填写或新建问卷</h1>
        <div className="mt-4">
          <Link
            href="/q/new"
            className="inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium hover:bg-muted/30"
          >
            新建问卷
          </Link>
        </div>

        {dbError && (
          <Card className="mt-4 p-4 text-sm text-muted-foreground">
            数据库暂不可用。你仍可点击“新建问卷”继续本地填写，后续恢复数据库后可再同步。
          </Card>
        )}

        <div className="mt-6 space-y-3">
          {drafts.length === 0 ? (
            <Card className="p-6 text-sm text-muted-foreground">
              暂无未提交问卷，可直接新建一份开始填写。
            </Card>
          ) : (
            drafts.map((item) => (
              <Card key={item.id} className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-sm font-medium">
                      公司：{item.companyName?.trim() ? item.companyName : "未填写公司名称"}
                    </div>
                    <div className="text-sm text-muted-foreground">token: {item.token}</div>
                    <div className="text-xs text-muted-foreground">
                      最近保存：{item.savedAt.toLocaleString()}
                    </div>
                  </div>
                  <Link
                    href={`/q/${item.token}`}
                    className="text-sm font-medium text-primary underline underline-offset-4"
                  >
                    继续填写
                  </Link>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
