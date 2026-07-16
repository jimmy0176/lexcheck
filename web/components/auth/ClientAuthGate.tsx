"use client";

import { useRouter } from "next/navigation";
import { LoginForm } from "./LoginForm";

export function ClientAuthGate({ message }: { message?: string }) {
  const router = useRouter();

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
        <div className="mt-6">
          <LoginForm onSuccess={onSuccess} />
        </div>
      </div>
    </main>
  );
}
