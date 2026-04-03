import Link from "next/link";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-6">
        <div className="flex min-w-0 items-center gap-4 sm:gap-6">
          <Link href="/" className="shrink-0 text-sm font-semibold tracking-tight">
            Lexcheck
          </Link>
          <nav className="hidden items-center gap-1 text-sm text-muted-foreground sm:flex">
            <span className="font-medium text-foreground">应用中心</span>
            <span className="text-muted-foreground/40">·</span>
            <Link href="/#apps" className="hover:text-foreground">
              应用列表
            </Link>
          </nav>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/login/user">用户登录</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/login/lawyer">律师登录</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
