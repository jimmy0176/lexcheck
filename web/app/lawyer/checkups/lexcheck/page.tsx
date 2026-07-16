import { Card } from "@/components/ui/card";
import { requireLawyerPage } from "@/lib/auth";
import type { Answers, QuestionnaireConfig } from "@/lib/questionnaire-types";
import { readQuestionnaireConfigForCheckup } from "@/lib/questionnaire-templates";
import { LawyerWorkbenchSidebar } from "@/components/lawyer-workbench-sidebar";
import type { LawyerWorkbenchNavGroup } from "@/components/lawyer-workbench-nav";
import { LEXCHECK_NAV_ITEMS } from "@/lib/lawyer-nav-config";
import { CheckupReportPanel } from "./CheckupReportPanel";
import { LlmSettingsPanel } from "./LlmSettingsPanel";
import { HelpCenterPanel } from "./HelpCenterPanel";
import { AccountTopBar } from "./AccountTopBar";
import { Dashboard, type DashboardRow, type DashboardStats } from "./Dashboard";
import { QuestionnaireConfigPanel } from "./QuestionnaireConfigPanel";
import { PromptConfigPanel } from "./PromptConfigPanel";
import { ReportQuestionnairePicker } from "./ReportQuestionnairePicker";

type View = "dashboard" | "report" | "questionnaire-config" | "prompt-config" | "llm-settings" | "help";

const NAV_ITEMS = LEXCHECK_NAV_ITEMS as Array<{ view: View; label: string }>;

export default async function LawyerLexcheckPage({
  searchParams,
}: {
  searchParams?: Promise<{ view?: string; token?: string }>;
}) {
  const lawyer = await requireLawyerPage();
  const resolved = searchParams ? await searchParams : undefined;
  const rawView = (resolved?.view ?? "report").trim();
  const view: View = (
    ["dashboard", "report", "questionnaire-config", "prompt-config", "llm-settings", "help"] as const
  ).includes(rawView as View)
    ? (rawView as View)
    : "report";
  const selectedToken = (resolved?.token ?? "").trim();

  let dbError = false;
  let fallbackToken = "";

  let selected: {
    id: string;
    token: string;
    companyName: string | null;
    contactName: string | null;
    contactPhone: string | null;
    status: "draft" | "submitted";
    savedAt: Date;
    submittedAt: Date | null;
    answersJson: unknown;
    promptTemplate: string;
    reportTemplate: string;
  } | null = null;
  let config: QuestionnaireConfig | null = null;
  let templateName: string | null = null;

  let dashboardStats: DashboardStats | null = null;
  let dashboardRows: DashboardRow[] = [];

  if (view === "dashboard") {
    try {
      const { prisma } = await import("@/lib/prisma");
      const all = await prisma.checkup.findMany({
        orderBy: { updatedAt: "desc" },
        include: {
          quickExamJobs: { where: { status: "success" }, select: { id: true }, take: 1 },
        },
      });
      let notSubmitted = 0;
      let submittedNotMade = 0;
      let madeNotConfirmed = 0;
      const confirmed = 0; // 报告确认/反馈标记功能尚未实现，暂时恒为 0
      for (const c of all) {
        if (c.quickExamJobs.length > 0) madeNotConfirmed += 1;
        else if (c.status === "submitted") submittedNotMade += 1;
        else notSubmitted += 1;
      }
      dashboardStats = { total: all.length, notSubmitted, submittedNotMade, madeNotConfirmed, confirmed };
      dashboardRows = all.map((c) => ({
        token: c.token,
        companyName: c.companyName,
        contactName: c.contactName,
        contactPhone: c.contactPhone,
        status: c.status,
        savedAt: c.savedAt,
        submittedAt: c.submittedAt,
      }));
    } catch {
      dbError = true;
    }
  }

  if (view === "prompt-config") {
    try {
      const { prisma } = await import("@/lib/prisma");
      const first = await prisma.checkup.findFirst({ orderBy: { updatedAt: "desc" } });
      fallbackToken = first?.token ?? "";
    } catch {
      dbError = true;
    }
  }

  if (view === "report" || view === "prompt-config") {
    const activeToken = selectedToken || fallbackToken;

    if (!dbError && activeToken) {
      try {
        const { prisma } = await import("@/lib/prisma");
        const selectedBase = await prisma.checkup.findUnique({
          where: { token: activeToken },
          include: { template: { select: { name: true } } },
        });
        if (selectedBase) {
          const workspace = await prisma.checkupWorkspace.upsert({
            where: { checkupId: selectedBase.id },
            create: { checkupId: selectedBase.id, progressJson: {} },
            update: {},
          });
          selected = {
            ...selectedBase,
            promptTemplate: workspace.promptTemplate ?? "",
            reportTemplate: workspace.reportTemplate ?? "",
          };
          templateName = selectedBase.template?.name ?? null;
          config = await readQuestionnaireConfigForCheckup(prisma, selectedBase);
        }
      } catch {
        dbError = true;
      }
    }
  }

  const answers = selected ? ((selected.answersJson ?? {}) as Answers) : null;

  let reportPickerRows: DashboardRow[] = [];
  if (view === "report" && !selected && !dbError) {
    try {
      const { prisma } = await import("@/lib/prisma");
      const all = await prisma.checkup.findMany({ orderBy: { updatedAt: "desc" } });
      reportPickerRows = all.map((c) => ({
        token: c.token,
        companyName: c.companyName,
        contactName: c.contactName,
        contactPhone: c.contactPhone,
        status: c.status,
        savedAt: c.savedAt,
        submittedAt: c.submittedAt,
      }));
    } catch {
      dbError = true;
    }
  }

  const navGroups: LawyerWorkbenchNavGroup[] = [
    {
      key: "lexcheck",
      label: "法律体检",
      active: true,
      children: NAV_ITEMS.map((item) => ({
        key: item.view,
        label: item.label,
        active: item.view === view,
        href:
          item.view === "report" || item.view === "prompt-config"
            ? `/lawyer/checkups/lexcheck?view=${item.view}${
                selected?.token ? `&token=${encodeURIComponent(selected.token)}` : ""
              }`
            : `/lawyer/checkups/lexcheck?view=${item.view}`,
      })),
    },
    { key: "dd-report", label: "尽调报告", active: false, href: "/lawyer/checkups/dd-report", children: [] },
    { key: "clients", label: "客户管理", active: false, href: "/lawyer/clients", children: [] },
  ];

  return (
    <main className="h-dvh overflow-hidden bg-background">
      <div className="flex h-full w-full flex-col px-1 py-1">
        {dbError && (
          <Card className="p-4 text-sm text-muted-foreground">
            数据库暂不可用。请先启动 PostgreSQL 并执行 Prisma 迁移后再查看服务端数据。
          </Card>
        )}

        {!dbError && (
          <div className="grid min-h-0 flex-1 gap-0 xl:grid-cols-[333px_minmax(0,1fr)]">
            <div className="min-h-0">
              <LawyerWorkbenchSidebar
                groups={navGroups}
                isAdmin={lawyer.isAdmin}
                className="rounded-r-none"
                helpCenterActive={view === "help"}
                llmSettingsActive={view === "llm-settings"}
              />
            </div>

            <div className="flex h-full min-h-0 min-w-0 flex-col rounded-lg rounded-l-none border bg-card shadow-sm">
              <AccountTopBar lawyerName={lawyer.name} />
              <div className="min-h-0 flex-1">
                {view === "dashboard" ? (
                  dashboardStats ? (
                    <Dashboard stats={dashboardStats} rows={dashboardRows} />
                  ) : (
                    <div className="p-4 text-sm text-muted-foreground">暂无数据。</div>
                  )
                ) : view === "questionnaire-config" ? (
                  <QuestionnaireConfigPanel />
                ) : view === "llm-settings" ? (
                  <LlmSettingsPanel />
                ) : view === "help" ? (
                  <HelpCenterPanel />
                ) : view === "prompt-config" ? (
                  selected ? (
                    <PromptConfigPanel key={selected.token} token={selected.token} companyName={selected.companyName} />
                  ) : (
                    <div className="p-4 text-sm text-muted-foreground">
                      暂无问卷数据，请先在企业端创建问卷，或前往总览查看。
                    </div>
                  )
                ) : selected ? (
                  <CheckupReportPanel
                    key={selected.token}
                    token={selected.token}
                    sections={config?.sections ?? []}
                    answers={(answers ?? {}) as Answers}
                    companyName={selected.companyName}
                    contactName={selected.contactName}
                    contactPhone={selected.contactPhone}
                    questionnaireStatus={selected.status}
                    submittedAt={selected.submittedAt}
                    questionnaireVersion={templateName}
                  />
                ) : (
                  <ReportQuestionnairePicker rows={reportPickerRows} />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
