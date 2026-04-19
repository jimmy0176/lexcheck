import Link from "next/link";
import { Card } from "@/components/ui/card";

export default function LawyerCheckupsPage() {
  return (
    <main className="min-h-dvh bg-background">
      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        <div className="text-sm text-muted-foreground">律师端</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">工作台应用中心</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          选择已上线应用进入处理流程，更多能力会陆续接入。
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card className="flex h-full flex-col p-6 shadow-sm">
            <div className="text-sm font-medium">Lexcheck 企业法律体检</div>
            <p className="mt-2 flex-1 text-sm text-muted-foreground">
              进入律师端问卷工作区，查看客户提交记录、检索 token 并打开详情页面。
            </p>
            <Link
              href="/lawyer/checkups/lexcheck"
              className="mt-6 text-sm font-medium text-primary underline underline-offset-4"
            >
              进入应用
            </Link>
          </Card>
          <Card className="flex h-full flex-col border-dashed p-6 shadow-sm">
            <div className="text-sm font-medium">更多功能待开发</div>
            <p className="mt-2 flex-1 text-sm text-muted-foreground">
              新的律师端工具正在规划中，后续将统一接入此应用中心。
            </p>
            <div className="mt-6 text-sm text-muted-foreground">敬请期待</div>
          </Card>
        </div>
      </div>
    </main>
  );
}

