"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmailLoginForm } from "./EmailLoginForm";
import { PhoneCodeLoginForm } from "./PhoneCodeLoginForm";

type SuccessUser = { id: string; role: string; isAdmin: boolean; name: string | null; companyName: string | null };

export function LoginDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (user: SuccessUser) => void;
}) {
  const [method, setMethod] = useState<"email" | "phone">("email");

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
                推荐使用邮箱登录，新账号可直接注册；手机号验证码作为辅助登录方式仍可使用。
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

          <div className="mb-4 flex gap-4 border-b border-border text-sm">
            <button
              type="button"
              onClick={() => setMethod("email")}
              className={`-mb-px border-b-2 px-1 py-2 font-medium transition-colors ${
                method === "email" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              邮箱
            </button>
            <button
              type="button"
              onClick={() => setMethod("phone")}
              className={`-mb-px border-b-2 px-1 py-2 font-medium transition-colors ${
                method === "phone" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              手机号
            </button>
          </div>

          {method === "email" ? <EmailLoginForm onSuccess={onSuccess} /> : <PhoneCodeLoginForm onSuccess={onSuccess} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
