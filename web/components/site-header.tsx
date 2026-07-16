"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LoginDialog } from "@/components/auth/LoginDialog";

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
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);
  const [loginOpen, setLoginOpen] = useState(false);

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
      <div className="flex h-16 w-full items-center justify-between gap-3 px-5">
        <div className="flex min-w-0 items-center gap-6 sm:gap-10">
          <Link
            href="/"
            className="shrink-0 font-heading text-xl font-semibold leading-none tracking-[0.06em] text-foreground sm:text-2xl"
          >
            HE Partners
          </Link>
        </div>
        <div className="flex shrink-0 items-center gap-4 sm:gap-5">
          {user === undefined ? null : user ? (
            <>
              <Link
                href={user.role === "lawyer" ? "/lawyer/checkups/lexcheck" : "/q"}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {user.role === "lawyer" ? "工作台" : "我的问卷"}
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <User className="h-4 w-4" />
                    <span>{user.name?.trim() || (user.role === "lawyer" ? "律师账号" : "客户账号")}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuLabel>{user.role === "lawyer" ? "律师账号" : "客户账号"}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/profile">个人资料</Link>
                  </DropdownMenuItem>
                  {user.isAdmin ? (
                    <DropdownMenuItem asChild>
                      <Link href="/lawyer/admin">后台管理</Link>
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => void handleLogout()}>退出登录</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setLoginOpen(true)}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              注册/登录
            </button>
          )}
        </div>
      </div>
      <LoginDialog
        open={loginOpen}
        onOpenChange={setLoginOpen}
        onSuccess={(nextUser) => {
          setUser(nextUser);
          setLoginOpen(false);
          router.refresh();
        }}
      />
    </header>
  );
}
