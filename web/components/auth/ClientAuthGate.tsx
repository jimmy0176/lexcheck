"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EmailLoginForm } from "./EmailLoginForm";
import { PhoneCodeLoginForm } from "./PhoneCodeLoginForm";

export function ClientAuthGate({ message }: { message?: string }) {
  const router = useRouter();
  const [method, setMethod] = useState<"email" | "phone">("email");

  function onSuccess(user: { id: string; role: string; isAdmin: boolean; name: string | null; companyName: string | null }) {
    if (user.role === "lawyer") {
      router.push("/lawyer/checkups/lexcheck");
    }
    router.refresh();
  }

  return (
    <main className="min-h-dvh bg-background">
      <div className="mx-auto w-full max-w-lg px-6 py-16">
        <h1 className="text-2xl font-semibold tracking-tight">登录</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {message ?? "请登录客户账号后继续填写问卷。"}
        </p>

        <div className="mt-6 mb-4 flex gap-4 border-b border-border text-sm">
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
      </div>
    </main>
  );
}
