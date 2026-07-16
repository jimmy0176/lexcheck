"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function AccountTopBar({
  lawyerName,
}: {
  lawyerName?: string | null;
}) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex shrink-0 items-center justify-end gap-3 border-b px-4 py-[15px]">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <User className="h-4 w-4" />
            <span>{lawyerName?.trim() || "律师账号"}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem asChild>
            <Link href="/profile">个人资料</Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void handleLogout()}>退出登录</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
