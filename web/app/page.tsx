import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/** 原图来自 Unsplash，已下载到 public 避免外链不可用。 */
const heroImageSrc = "/hero-bg.jpg";

export default function Home() {
  return (
    <main className="bg-background">
      {/* Hero：全宽背景图 + 大标题 */}
      <section className="relative isolate min-h-[calc(100vh-4rem)] overflow-hidden border-b">
        <Image
          src={heroImageSrc}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
          aria-hidden
        />
        <div
          className="absolute inset-0 bg-gradient-to-r from-black/28 via-black/16 to-black/24 sm:via-black/12 sm:to-black/20"
          aria-hidden
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/24 via-transparent to-black/30 sm:to-black/24" aria-hidden />
        <div className="relative z-10 mx-auto flex max-w-6xl min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-6 pb-14 pt-24 text-center sm:pb-20 sm:pt-28">
          <h1 className="hero-cn-title max-w-3xl text-4xl font-semibold tracking-[0.12em] text-white sm:text-5xl md:text-6xl">
            专业的支持，随时都在
          </h1>
          <Link
            href="/q"
            className="mt-12 inline-flex items-center gap-2 text-base font-normal text-white/90 transition-colors hover:text-white sm:text-lg"
          >
            <span>即刻开始</span>
            <span aria-hidden>{">"}</span>
          </Link>
        </div>
      </section>

      {/* 关于 */}
      <section id="about" className="scroll-mt-20 border-b">
        <div className="mx-auto max-w-6xl px-6 py-14 sm:py-16">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            我们是谁
          </p>
          <h2 className="mt-2 max-w-2xl text-2xl font-semibold tracking-tight sm:text-3xl">
            把「问卷 + 协作 + 可读摘要」做成一套连贯体验
          </h2>
          <div className="mt-6 max-w-3xl space-y-4 text-sm text-muted-foreground sm:text-base">
            <p>
              Lexcheck
              面向企业与律师团队：前者用引导式问题完成信息采集，后者在同一套数据上继续审阅与沟通，减少来回邮件与版本混乱。
            </p>
            <p>
              我们不替代律师的专业判断；产品侧重点是流程、结构与可追溯——让体检材料更容易被理解、被跟进。
            </p>
          </div>
        </div>
      </section>

      {/* 使用方式 */}
      <section id="team" className="scroll-mt-20 border-b bg-muted/20">
        <div className="mx-auto max-w-6xl px-6 py-14 sm:py-16">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            使用方式
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">三步开始</h2>
          <ol className="mt-10 grid gap-6 sm:grid-cols-3">
            <li>
              <Card className="h-full p-6 shadow-sm">
                <div className="text-xs font-medium text-muted-foreground">步骤 1</div>
                <div className="mt-2 font-medium">企业侧填写问卷</div>
                <p className="mt-2 text-sm text-muted-foreground">
                  打开体检应用，按章节完成题目；进度自动保存，可分多次提交。
                </p>
              </Card>
            </li>
            <li>
              <Card className="h-full p-6 shadow-sm">
                <div className="text-xs font-medium text-muted-foreground">步骤 2</div>
                <div className="mt-2 font-medium">提交后同步至律师端</div>
                <p className="mt-2 text-sm text-muted-foreground">
                  律师在工作台查看结构化结果与附件，按需补充说明或安排下一步。
                </p>
              </Card>
            </li>
            <li>
              <Card className="h-full p-6 shadow-sm">
                <div className="text-xs font-medium text-muted-foreground">步骤 3</div>
                <div className="mt-2 font-medium">结合摘要推进沟通</div>
                <p className="mt-2 text-sm text-muted-foreground">
                  借助系统生成的要点摘要节省初读时间；重要结论仍以律师审阅为准。
                </p>
              </Card>
            </li>
          </ol>
        </div>
      </section>

      {/* 应用列表 */}
      <section id="apps" className="scroll-mt-20">
        <div className="mx-auto max-w-6xl px-6 py-14 sm:py-16">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            能力覆盖
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">应用与能力</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
            当前已上架 1 个应用；后续模块将按同一导航入口陆续开放。
          </p>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <li>
              <Card className="flex h-full flex-col p-6 shadow-sm">
                <div className="text-sm font-medium">企业法律体检</div>
                <p className="mt-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  已上线
                </p>
                <p className="mt-2 flex-1 text-sm text-muted-foreground">
                  多章节问卷、进度跟踪、服务端保存与提交；律师端可查看答卷与 AI 辅助摘要。
                </p>
                <Button className="mt-6 w-full sm:w-auto" asChild variant="secondary">
                  <Link href="/q">打开应用</Link>
                </Button>
              </Card>
            </li>
            <li>
              <Card className="flex h-full flex-col border-dashed p-6 shadow-sm">
                <div className="text-sm font-medium">更多合规应用</div>
                <p className="mt-1 text-xs font-medium text-muted-foreground">规划中</p>
                <p className="mt-2 flex-1 text-sm text-muted-foreground">
                  将在同一应用中心上架，便于企业统一入口、统一账号与使用习惯。
                </p>
                <Button className="mt-6 w-full sm:w-auto" variant="outline" disabled>
                  敬请期待
                </Button>
              </Card>
            </li>
          </ul>
        </div>
      </section>

      {/* 典型场景（匿名） */}
      <section id="scenarios" className="scroll-mt-16 border-t bg-muted/15">
        <div className="mx-auto max-w-6xl px-6 py-14 sm:py-16">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            典型场景
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            常见使用情境（示例）
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            以下为匿名化描述，不代表特定客户或案件结果。
          </p>
          <ul className="mt-10 grid gap-4 md:grid-cols-3">
            <li>
              <Card className="h-full p-6 shadow-sm">
                <div className="text-sm font-medium">融资前材料整理</div>
                <p className="mt-2 text-sm text-muted-foreground">
                  用问卷把公司治理、合同与知产等常见问题先行结构化，便于律师快速把握重点。
                </p>
              </Card>
            </li>
            <li>
              <Card className="h-full p-6 shadow-sm">
                <div className="text-sm font-medium">年度合规自查</div>
                <p className="mt-2 text-sm text-muted-foreground">
                  按年更新答卷，形成可对比的记录，减少「口头汇报、难以追溯」的成本。
                </p>
              </Card>
            </li>
            <li>
              <Card className="h-full p-6 shadow-sm">
                <div className="text-sm font-medium">多部门协同填报</div>
                <p className="mt-2 text-sm text-muted-foreground">
                  法务发起、业务与财务等角色分头补充，统一汇总到律师端审阅。
                </p>
              </Card>
            </li>
          </ul>
        </div>
      </section>

      {/* 底部 CTA */}
      <section className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-6 py-12 sm:flex-row sm:items-center sm:py-14">
          <div>
            <h2 className="text-lg font-semibold tracking-tight sm:text-xl">准备开始体检？</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              从问卷入口进入；律师请使用工作台。账户登录见页脚。
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/q">进入企业法律体检</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/lawyer/checkups">律师工作台</Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
