import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function Home() {
  return (
    <main className="bg-background">
      <section className="border-b bg-muted/30">
        <div className="mx-auto max-w-6xl px-6 py-14 sm:py-20">
          <p className="text-sm text-muted-foreground">Lexcheck 应用中心</p>
          <h1 className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
            用结构化问卷，快速完成企业法律合规体检
          </h1>
          <p className="mt-4 max-w-xl text-sm text-muted-foreground sm:text-base">
            客户在线填写、自动保存；律师端查看详情与风险摘要。更多应用将陆续上架。
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/q/demo">进入企业法律体检（Demo）</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/lawyer/checkups">律师工作台</Link>
            </Button>
          </div>
        </div>
      </section>

      <section id="apps" className="scroll-mt-14">
        <div className="mx-auto max-w-6xl px-6 py-12 sm:py-14">
          <h2 className="text-lg font-semibold tracking-tight">应用列表</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            当前已上架 1 个应用，后续可扩展更多合规与尽调工具。
          </p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <li>
              <Card className="flex h-full flex-col p-6 shadow-sm">
                <div className="text-sm font-medium">企业法律体检</div>
                <p className="mt-2 flex-1 text-sm text-muted-foreground">
                  多章节问卷、进度跟踪、服务端保存与提交；律师端可查看答卷与 AI 辅助意见。
                </p>
                <Button className="mt-6 w-full sm:w-auto" asChild variant="secondary">
                  <Link href="/q/demo">打开应用</Link>
                </Button>
              </Card>
            </li>
          </ul>
        </div>
      </section>
    </main>
  );
}
