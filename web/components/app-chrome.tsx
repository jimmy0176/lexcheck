"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export function AppChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const hideChrome = pathname.startsWith("/lawyer/checkups");

  return (
    <>
      {!hideChrome ? <SiteHeader /> : null}
      <div className="flex-1">{children}</div>
      {!hideChrome ? <SiteFooter /> : null}
    </>
  );
}
