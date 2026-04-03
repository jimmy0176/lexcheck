import Link from "next/link";

export default function LawyerLoginPlaceholderPage() {
  return (
    <main className="min-h-dvh bg-background">
      <div className="mx-auto w-full max-w-lg px-6 py-16">
        <h1 className="text-2xl font-semibold tracking-tight">律师登录</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          登录功能开发中。未来将接入统一账号体系，与「用户登录」合并为单一入口，按账号自动跳转律师端或客户侧。
        </p>
        <Link
          href="/"
          className="mt-8 inline-block text-sm font-medium text-primary underline underline-offset-4"
        >
          返回首页
        </Link>
      </div>
    </main>
  );
}
