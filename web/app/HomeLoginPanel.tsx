"use client";

import { useRouter } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";

/** next 必须和登录成功后的角色匹配才采用，避免把律师账号送进客户专用地址（反之亦然），见 app/page.tsx 里同名逻辑。 */
function nextPathForRole(next: string | undefined, role: string): string | null {
  if (!next) return null;
  const isLawyerPath = next.startsWith("/lawyer");
  return role === "lawyer" ? (isLawyerPath ? next : null) : isLawyerPath ? null : next;
}

export function HomeLoginPanel({ next }: { next?: string }) {
  const router = useRouter();
  return (
    <LoginForm
      onSuccess={(user) => {
        router.push(nextPathForRole(next, user.role) ?? (user.role === "lawyer" ? "/lawyer/checkups/lexcheck" : "/q"));
        router.refresh();
      }}
    />
  );
}
