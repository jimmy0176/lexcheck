import { getAuthSettings, requireAdminPage } from "@/lib/auth";
import { LawyerWorkbenchSidebar } from "@/components/lawyer-workbench-sidebar";
import type { LawyerWorkbenchNavGroup } from "@/components/lawyer-workbench-nav";
import { LEXCHECK_NAV_ITEMS } from "@/lib/lawyer-nav-config";
import { AccountTopBar } from "../checkups/lexcheck/AccountTopBar";
import { AdminAccountsClient } from "./AdminAccountsClient";

const navGroups: LawyerWorkbenchNavGroup[] = [
  {
    key: "lexcheck",
    label: "法律体检",
    active: false,
    children: LEXCHECK_NAV_ITEMS.map((item) => ({
      key: item.view,
      label: item.label,
      active: false,
      href: `/lawyer/checkups/lexcheck?view=${item.view}`,
    })),
  },
  { key: "dd-report", label: "尽调报告", active: false, href: "/lawyer/checkups/dd-report", children: [] },
  { key: "clients", label: "客户管理", active: false, href: "/lawyer/clients", children: [] },
];

export default async function LawyerAdminPage() {
  const lawyer = await requireAdminPage();
  const settings = await getAuthSettings();

  const { prisma } = await import("@/lib/prisma");
  const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <main className="h-dvh overflow-hidden bg-background">
      <div className="flex h-full w-full flex-col px-1 py-1">
        <div className="grid min-h-0 flex-1 gap-0 xl:grid-cols-[333px_minmax(0,1fr)]">
          <div className="min-h-0">
            <LawyerWorkbenchSidebar groups={navGroups} isAdmin={lawyer.isAdmin} className="rounded-r-none" />
          </div>

          <div className="flex h-full min-h-0 min-w-0 flex-col rounded-lg rounded-l-none border bg-card shadow-sm">
            <AccountTopBar lawyerName={lawyer.name} />
            <div className="min-h-0 flex-1 overflow-y-auto px-8 py-4">
              <h1 className="text-2xl font-semibold tracking-tight">后台管理</h1>
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
                    smtpHost: settings.smtpHost ?? "",
                    smtpPort: settings.smtpPort,
                    smtpSecure: settings.smtpSecure,
                    smtpUser: settings.smtpUser ?? "",
                    smtpPass: settings.smtpPass ?? "",
                    smtpFromName: settings.smtpFromName ?? "",
                  }}
                  initialUsers={users.map((u) => ({
                    id: u.id,
                    email: u.email,
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
          </div>
        </div>
      </div>
    </main>
  );
}
