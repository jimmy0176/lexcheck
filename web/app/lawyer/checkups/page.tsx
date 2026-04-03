import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function LawyerCheckupsPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string }>;
}) {
  const resolved = searchParams ? await searchParams : undefined;
  const keyword = (resolved?.q ?? "").trim();
  let checkups: Array<{
    id: string;
    token: string;
    companyName: string | null;
    status: "draft" | "submitted";
    savedAt: Date;
  }> = [];
  let dbError = false;
  try {
    const { prisma } = await import("@/lib/prisma");
    checkups = await prisma.checkup.findMany({
      where: keyword
        ? {
            OR: [
              { token: { contains: keyword, mode: "insensitive" } },
              { companyName: { contains: keyword, mode: "insensitive" } },
            ],
          }
        : undefined,
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
  } catch {
    dbError = true;
  }

  return (
    <main className="min-h-dvh bg-background">
      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        <div className="text-sm text-muted-foreground">律师端</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">体检单列表</h1>
        <form className="mt-4 flex gap-2">
          <input
            name="q"
            defaultValue={keyword}
            placeholder="搜索 token 或公司名称"
            className="h-10 w-full max-w-md rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <button
            type="submit"
            className="h-10 rounded-md border px-4 text-sm font-medium hover:bg-muted/30"
          >
            搜索
          </button>
        </form>
        {dbError && (
          <Card className="mt-4 p-4 text-sm text-muted-foreground">
            数据库暂不可用。请先启动 PostgreSQL 并执行 Prisma 迁移后再查看服务端数据。
          </Card>
        )}
        <div className="mt-6 space-y-3">
          {checkups.length === 0 && (
            <Card className="p-6 text-sm text-muted-foreground">
              {keyword ? "未找到匹配的体检单。" : "暂无数据，请先打开客户问卷链接填写并暂存/提交。"}
            </Card>
          )}
          {checkups.map((item) => (
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
                <div className="flex items-center gap-3">
                  <Badge variant={item.status === "submitted" ? "default" : "secondary"}>
                    {item.status === "submitted" ? "已提交" : "草稿"}
                  </Badge>
                  <Link
                    className="text-sm font-medium text-primary underline underline-offset-4"
                    href={`/lawyer/checkups/${item.token}`}
                  >
                    查看详情
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
}

