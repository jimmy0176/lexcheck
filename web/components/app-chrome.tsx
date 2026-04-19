"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export function AppChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const hideHeader = pathname.startsWith("/lawyer/checkups");

  return (
    <>
      {!hideHeader ? <SiteHeader /> : null}
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </>
  );
}
