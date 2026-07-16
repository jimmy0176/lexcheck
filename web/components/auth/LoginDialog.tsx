"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PhoneCodeLoginForm } from "./PhoneCodeLoginForm";

export function LoginDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (user: { id: string; role: string; isAdmin: boolean; name: string | null; companyName: string | null }) => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-40 bg-black/50"
          )}
        />
        <Dialog.Content
          className={cn(
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "fixed top-1/2 left-1/2 z-[60] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-6 shadow-lg duration-200"
          )}
        >
          <div className="mb-4 flex items-start justify-between">
            <div className="space-y-1">
              <Dialog.Title className="text-lg font-semibold">注册 / 登录</Dialog.Title>
              <Dialog.Description className="text-sm text-muted-foreground">
                使用手机号验证码登录，新账号可直接注册。
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="关闭"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>
          <PhoneCodeLoginForm onSuccess={onSuccess} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
