import type { ReactNode } from "react";
import { HeroWaves } from "@/components/hero-waves";
import { cn } from "@/lib/utils";

/** 律师工作台左列的深色底板：深藏青底色 + 曲线装饰，内部内容用分隔线分段，不再套白色卡片。 */
export function WorkspaceSidePanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex h-full flex-col overflow-hidden rounded-xl bg-gradient-to-br from-sidebar to-sidebar-accent text-sidebar-foreground shadow-sm ring-1 ring-white/10",
        className
      )}
    >
      <HeroWaves className="pointer-events-none absolute inset-0 h-full w-full opacity-25" />
      <div className="relative flex min-h-0 flex-1 flex-col divide-y divide-white/10 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}

export function WorkspaceSidePanelSection({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`px-4 py-4 ${className ?? ""}`}>{children}</div>;
}
