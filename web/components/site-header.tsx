"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type SessionUser = {
  id: string;
  role: string;
  isAdmin: boolean;
  name: string | null;
  companyName: string | null;
};

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const hideMarketingNav = pathname.startsWith("/lawyer/checkups");
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((json: { user: SessionUser | null }) => {
        if (!cancelled) setUser(json.user);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-50 bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/55">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-6">
        <div className="flex min-w-0 items-center gap-6 sm:gap-10">
          <Link
            href="/"
            className="shrink-0 font-heading text-xl font-semibold leading-none tracking-[0.06em] text-foreground sm:text-2xl"
          >
            HE Partners
          </Link>
          {!hideMarketingNav ? (
            <nav className="hidden items-center gap-5 sm:flex">
              <Link
                href="/#about"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                关于
              </Link>
              <Link
                href="/#team"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                团队
              </Link>
              <Link
                href="/#apps"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                应用
              </Link>
              <Link
                href="/#scenarios"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                资源
              </Link>
              <Link
                href="/#contact"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                联系我们
              </Link>
            </nav>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-4 sm:gap-5">
          {user === undefined ? null : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="text-sm text-foreground/90 transition-colors hover:text-foreground"
                >
                  {user.name?.trim() || (user.role === "lawyer" ? "律师账号" : "客户账号")}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>{user.role === "lawyer" ? "律师账号" : "客户账号"}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {user.role === "lawyer" ? (
                  <DropdownMenuItem asChild>
                    <Link href="/lawyer/checkups/lexcheck">工作台</Link>
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem asChild>
                    <Link href="/q">我的问卷</Link>
                  </DropdownMenuItem>
                )}
                {user.isAdmin ? (
                  <DropdownMenuItem asChild>
                    <Link href="/lawyer/admin">账号管理</Link>
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => void handleLogout()}>退出登录</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link
              href="/login"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              登录
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
