import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-dvh bg-background">
      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-muted-foreground">Lexcheck</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              企业法律顾问体检问卷
            </h1>
          </div>
          <Link
            href="/q/demo"
            className="text-sm font-medium text-primary underline underline-offset-4"
          >
            进入问卷（Demo）
          </Link>
        </div>
        <div className="mt-3 text-sm">
          <Link
            href="/lawyer/checkups"
            className="font-medium text-primary underline underline-offset-4"
          >
            律师端查看入口
          </Link>
        </div>

        <div className="mt-10 rounded-2xl border bg-card p-6 text-card-foreground shadow-sm">
          <div className="text-base font-medium">接下来</div>
          <ul className="mt-3 list-disc pl-5 text-sm text-muted-foreground space-y-1">
            <li>实现客户问卷页：自动保存、进度侧栏、暂存/提交。</li>
            <li>接入数据库与 token 访问控制。</li>
            <li>律师工作台与多公司看板后续迭代。</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
