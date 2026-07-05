"use client";

import { useRouter } from "next/navigation";
import { PhoneCodeLoginForm } from "@/components/auth/PhoneCodeLoginForm";

export default function LoginPage() {
  const router = useRouter();
  return (
    <main className="min-h-dvh bg-background">
      <div className="mx-auto w-full max-w-lg px-6 py-16">
        <h1 className="text-2xl font-semibold tracking-tight">登录</h1>
        <div className="mt-6">
          <PhoneCodeLoginForm
            onSuccess={(user) => {
              router.push(user.role === "lawyer" ? "/lawyer/checkups/lexcheck" : "/q");
              router.refresh();
            }}
          />
        </div>
      </div>
    </main>
  );
}
