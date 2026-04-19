"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SiteHeader() {
  const pathname = usePathname();
  const hideMarketingNav = pathname.startsWith("/lawyer/checkups");

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
          <Link
            href="/lawyer/checkups"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            工作台
          </Link>
        </div>
      </div>
    </header>
  );
}
