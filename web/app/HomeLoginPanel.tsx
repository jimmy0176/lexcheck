"use client";

import { useRouter } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";

export function HomeLoginPanel() {
  const router = useRouter();
  return (
    <LoginForm
      onSuccess={(user) => {
        router.push(user.role === "lawyer" ? "/lawyer/checkups/lexcheck" : "/q");
        router.refresh();
      }}
    />
  );
}
