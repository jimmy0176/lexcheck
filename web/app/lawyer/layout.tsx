import type { ReactNode } from "react";
import { requireLawyerPage } from "@/lib/auth";

export default async function LawyerLayout({ children }: { children: ReactNode }) {
  await requireLawyerPage();
  return <>{children}</>;
}
