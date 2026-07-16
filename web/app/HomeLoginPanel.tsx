"use client";

import { useRouter } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";

export function HomeLoginPanel({ next }: { next?: string }) {
  const router = useRouter();
  return (
    <LoginForm
      onSuccess={(user) => {
        router.push(next ?? (user.role === "lawyer" ? "/lawyer/checkups/lexcheck" : "/q"));
        router.refresh();
      }}
    />
  );
}
