import { getAuthSettings, requireAdminPage } from "@/lib/auth";
import { AdminAccountsClient } from "./AdminAccountsClient";

export default async function LawyerAdminPage() {
  await requireAdminPage();
  const settings = await getAuthSettings();

  const { prisma } = await import("@/lib/prisma");
  const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <main className="min-h-dvh bg-background">
      <div className="mx-auto w-full max-w-4xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">账号管理</h1>
        <p className="mt-1 text-sm text-muted-foreground">仅管理员可见：验证码与注册设置、账号列表。</p>
        <div className="mt-6">
          <AdminAccountsClient
            initialSettings={{
              tempCodeEnabled: settings.tempCodeEnabled,
              tempCode: settings.tempCode ?? "",
              registrationMode: settings.registrationMode,
              inviteCode: settings.inviteCode ?? "",
              questionnaireCooldownHours: settings.questionnaireCooldownHours,
              sharedLlmProviderId: settings.sharedLlmProviderId ?? "",
              sharedLlmModel: settings.sharedLlmModel ?? "",
              sharedLlmApiKey: settings.sharedLlmApiKey ?? "",
              sharedLlmBaseUrl: settings.sharedLlmBaseUrl ?? "",
              backupLlmProviderId: settings.backupLlmProviderId ?? "",
              backupLlmModel: settings.backupLlmModel ?? "",
              backupLlmApiKey: settings.backupLlmApiKey ?? "",
              backupLlmBaseUrl: settings.backupLlmBaseUrl ?? "",
            }}
            initialUsers={users.map((u) => ({
              id: u.id,
              phone: u.phone,
              role: u.role,
              isAdmin: u.isAdmin,
              name: u.name,
              companyName: u.companyName,
              createdAt: u.createdAt.toISOString(),
            }))}
          />
        </div>
      </div>
    </main>
  );
}
