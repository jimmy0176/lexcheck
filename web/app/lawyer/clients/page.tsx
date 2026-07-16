import { requireLawyerPage } from "@/lib/auth";
import { LawyerWorkbenchSidebar } from "@/components/lawyer-workbench-sidebar";
import type { LawyerWorkbenchNavGroup } from "@/components/lawyer-workbench-nav";
import { LEXCHECK_NAV_ITEMS } from "@/lib/lawyer-nav-config";
import { AccountTopBar } from "../checkups/lexcheck/AccountTopBar";
import { ClientConfigPanel } from "./ClientConfigPanel";

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
  { key: "clients", label: "客户管理", active: true, href: "/lawyer/clients", children: [] },
];

export default async function LawyerClientsPage() {
  const lawyer = await requireLawyerPage();

  return (
    <main className="h-dvh overflow-hidden bg-background">
      <div className="flex h-full w-full flex-col px-1 py-1">
        <div className="grid min-h-0 flex-1 gap-0 xl:grid-cols-[333px_minmax(0,1fr)]">
          <div className="min-h-0">
            <LawyerWorkbenchSidebar groups={navGroups} isAdmin={lawyer.isAdmin} className="rounded-r-none" />
          </div>

          <div className="flex h-full min-h-0 min-w-0 flex-col rounded-lg rounded-l-none border bg-card shadow-sm">
            <AccountTopBar lawyerName={lawyer.name} />
            <div className="min-h-0 flex-1">
              <ClientConfigPanel />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
