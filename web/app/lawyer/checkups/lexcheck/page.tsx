import path from "node:path";
import { readFile } from "node:fs/promises";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { requireLawyerPage } from "@/lib/auth";
import type { Answers, QuestionnaireConfig } from "@/lib/questionnaire-types";
import { WorkspaceSidePanel, WorkspaceSidePanelSection } from "@/components/workspace-side-panel";
import { CheckupReportPanel } from "./CheckupReportPanel";
import { WorkspaceSettingsButtons } from "./WorkspaceControls";
import { AccountTopBar } from "./AccountTopBar";
import { Dashboard, type DashboardRow, type DashboardStats } from "./Dashboard";

type View = "dashboard" | "report" | "questionnaire-config" | "client-config";

const NAV_ITEMS: Array<{ view: View; label: string }> = [
  { view: "dashboard", label: "仪表盘" },
  { view: "report", label: "报告制作" },
  { view: "questionnaire-config", label: "问卷配置" },
  { view: "client-config", label: "客户配置" },
];

async function readQuestionnaireConfig() {
  const filePath = path.join(process.cwd(), "public", "questionnaire.json");
  const raw = await readFile(filePath, "utf-8");
  return JSON.parse(raw) as QuestionnaireConfig;
}

export default async function LawyerLexcheckPage({
  searchParams,
}: {
  searchParams?: Promise<{ view?: string; token?: string }>;
}) {
  const lawyer = await requireLawyerPage();
  const resolved = searchParams ? await searchParams : undefined;
  const rawView = (resolved?.view ?? "report").trim();
  const view: View = (["dashboard", "report", "questionnaire-config", "client-config"] as const).includes(
    rawView as View
  )
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

  if (view === "report") {
    try {
      const { prisma } = await import("@/lib/prisma");
      const first = await prisma.checkup.findFirst({ orderBy: { updatedAt: "desc" } });
      fallbackToken = first?.token ?? "";
    } catch {
      dbError = true;
    }

    const activeToken = selectedToken || fallbackToken;

    if (!dbError && activeToken) {
      try {
        const { prisma } = await import("@/lib/prisma");
        const selectedBase = await prisma.checkup.findUnique({ where: { token: activeToken } });
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
          config = await readQuestionnaireConfig();
        }
      } catch {
        dbError = true;
      }
    }
  }

  const answers = selected ? ((selected.answersJson ?? {}) as Answers) : null;

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
              <WorkspaceSidePanel className="rounded-r-none">
                <WorkspaceSidePanelSection>
                  <Link
                    href="/"
                    className="font-heading text-3xl font-semibold leading-none tracking-[0.06em] text-white transition-opacity hover:opacity-80"
                  >
                    HE Partners
                  </Link>
                  <div className="mt-1 text-base text-white/60">法律体检</div>
                </WorkspaceSidePanelSection>

                <WorkspaceSidePanelSection className="min-h-0 flex-1 overflow-y-auto">
                  <nav className="space-y-1">
                    {NAV_ITEMS.map((item) => {
                      const isActive = item.view === view;
                      const href =
                        item.view === "report"
                          ? `/lawyer/checkups/lexcheck?view=report${
                              selected?.token ? `&token=${encodeURIComponent(selected.token)}` : ""
                            }`
                          : `/lawyer/checkups/lexcheck?view=${item.view}`;
                      return (
                        <Link
                          key={item.view}
                          href={href}
                          className={`block rounded-md px-3 py-2 text-base transition-colors ${
                            isActive
                              ? "bg-sidebar-accent text-white"
                              : "text-white/60 hover:bg-sidebar-accent hover:text-white"
                          }`}
                        >
                          {item.label}
                        </Link>
                      );
                    })}
                  </nav>
                </WorkspaceSidePanelSection>

                <WorkspaceSidePanelSection>
                  <WorkspaceSettingsButtons token={selected?.token} />
                </WorkspaceSidePanelSection>
              </WorkspaceSidePanel>
            </div>

            <div className="flex h-full min-h-0 min-w-0 flex-col rounded-lg rounded-l-none border bg-card shadow-sm">
              <AccountTopBar lawyerName={lawyer.name} isAdmin={lawyer.isAdmin} />
              <div className="min-h-0 flex-1">
                {view === "dashboard" ? (
                  dashboardStats ? (
                    <Dashboard stats={dashboardStats} rows={dashboardRows} />
                  ) : (
                    <div className="p-4 text-sm text-muted-foreground">暂无数据。</div>
                  )
                ) : view === "questionnaire-config" || view === "client-config" ? (
                  <div className="h-full" />
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
                    questionnaireVersion={config?.version ?? null}
                  />
                ) : (
                  <div className="p-4 text-sm text-muted-foreground">
                    暂无问卷数据，请先在企业端创建问卷，或前往仪表盘查看。
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
