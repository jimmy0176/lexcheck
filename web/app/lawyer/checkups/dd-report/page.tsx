import path from "node:path";
import { readFile } from "node:fs/promises";
import { Card } from "@/components/ui/card";
import { requireLawyerPage } from "@/lib/auth";
import type { Answers, QuestionnaireConfig } from "@/lib/questionnaire-types";
import { normalizeProgress } from "@/lib/checkup-workflow";
import { LawyerWorkbenchSidebar } from "@/components/lawyer-workbench-sidebar";
import type { LawyerWorkbenchNavGroup } from "@/components/lawyer-workbench-nav";
import { LEXCHECK_NAV_ITEMS } from "@/lib/lawyer-nav-config";
import { LexcheckMiddleColumn } from "./LexcheckMiddleColumn";
import { LexcheckWorkspaceRightPanel } from "./LexcheckWorkspaceRightPanel";
import { QuestionnairePickerButton } from "./WorkspaceControls";

const ddReportNavGroups: LawyerWorkbenchNavGroup[] = [
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
  { key: "dd-report", label: "尽调报告", active: true, href: "/lawyer/checkups/dd-report", children: [] },
  { key: "clients", label: "客户管理", active: false, href: "/lawyer/clients", children: [] },
];

type CheckupListItem = {
  id: string;
  token: string;
  companyName: string | null;
  status: "draft" | "submitted";
  savedAt: Date;
};

async function readQuestionnaireConfig() {
  const filePath = path.join(process.cwd(), "public", "questionnaire.json");
  const raw = await readFile(filePath, "utf-8");
  return JSON.parse(raw) as QuestionnaireConfig;
}

export default async function LawyerLexcheckPage({
  searchParams,
}: {
  searchParams?: Promise<{ token?: string }>;
}) {
  const lawyer = await requireLawyerPage();
  const resolved = searchParams ? await searchParams : undefined;
  const selectedToken = (resolved?.token ?? "").trim();
  let checkups: CheckupListItem[] = [];
  let selected: {
    id: string;
    token: string;
    companyName: string | null;
    status: "draft" | "submitted";
    savedAt: Date;
    submittedAt: Date | null;
    answersJson: unknown;
    attachments: Array<{
      id: string;
      kind: "preliminary" | "detailed" | "thirdParty";
      fileName: string;
      extractedText: string | null;
      extractError: string | null;
      createdAt: Date;
    }>;
    workspace: {
      id: string;
      projectStatus: string;
      ownerName: string | null;
      promptTemplate: string | null;
      reportTemplate: string | null;
      progressJson: unknown;
      sectionDrafts: Array<{
        id: string;
        sectionKey: string;
        sectionName: string;
        draftText: string;
        reviewedText: string | null;
        included: boolean;
        updatedAt: Date;
      }>;
      finalReport: {
        id: string;
        reportText: string;
        notesText: string | null;
        updatedAt: Date;
      } | null;
    } | null;
  } | null = null;
  let config: QuestionnaireConfig | null = null;
  let dbError = false;
  let workflowUnavailable = false;
  try {
    const { prisma } = await import("@/lib/prisma");
    checkups = await prisma.checkup.findMany({
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
  } catch {
    dbError = true;
  }

  const fallbackToken = checkups[0]?.token ?? "";
  const activeToken = selectedToken || fallbackToken;

  if (!dbError && activeToken) {
    try {
      const { prisma } = await import("@/lib/prisma");
      const selectedBase = await prisma.checkup.findUnique({
        where: { token: activeToken },
        include: {
          // 排除 thirdParty：那是法律体检应用专属的三方报告附件桶，与本应用的 preliminary/detailed 无关。
          attachments: { where: { kind: { in: ["preliminary", "detailed"] } }, orderBy: { createdAt: "desc" } },
        },
      });
      selected = selectedBase ? { ...selectedBase, workspace: null } : null;
      if (selected) {
        config = await readQuestionnaireConfig();
      }
    } catch {
      dbError = true;
    }
  }

  if (!dbError && selected) {
    try {
      const { prisma } = await import("@/lib/prisma");
      selected.workspace = await prisma.checkupWorkspace.upsert({
        where: { checkupId: selected.id },
        create: { checkupId: selected.id, progressJson: {} },
        update: {},
        include: {
          sectionDrafts: { orderBy: { updatedAt: "desc" } },
          finalReport: true,
        },
      });
    } catch {
      workflowUnavailable = true;
      selected.workspace = null;
    }
  }

  const answers = selected ? ((selected.answersJson ?? {}) as Answers) : null;
  const attachmentStats = selected
    ? {
        total: selected.attachments.length,
        parsed: selected.attachments.filter((a) => Boolean(a.extractedText?.trim())).length,
        failed: selected.attachments.filter((a) => Boolean(a.extractError)).length,
      }
    : null;
  const checkupOptions = checkups.map((item) => ({
    id: item.id,
    token: item.token,
    companyName: item.companyName,
    status: item.status,
    savedAtLabel: item.savedAt.toLocaleString(),
  }));

  return (
    <main className="h-dvh overflow-hidden bg-background">
      <div className="flex h-full w-full flex-col px-1 py-1">
        {dbError && (
          <Card className="p-4 text-sm text-muted-foreground">
            数据库暂不可用。请先启动 PostgreSQL 并执行 Prisma 迁移后再查看服务端数据。
          </Card>
        )}

        {!dbError && (
          <>
            {workflowUnavailable && (
              <Card className="mt-4 p-4 text-sm text-amber-700 dark:text-amber-400">
                工作流模块暂不可用：工作流数据表未就绪。请执行 `npx prisma db push` 后刷新页面。
              </Card>
            )}

            <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[333px_275px_minmax(0,1fr)]">
              <div className="min-h-0">
                <LawyerWorkbenchSidebar groups={ddReportNavGroups} isAdmin={lawyer.isAdmin} className="rounded-xl" />
              </div>

              <div className="min-h-0 space-y-4 overflow-y-auto pr-1" id="file-management">
                {selected ? (
                  <LexcheckMiddleColumn
                    token={selected.token}
                    sectionDrafts={
                      selected.workspace?.sectionDrafts.map((d) => ({
                        id: d.id,
                        sectionName: d.sectionName,
                        updatedAt: d.updatedAt.toISOString(),
                      })) ?? []
                    }
                    companyName={selected.companyName}
                    status={selected.status}
                    checkupOptions={checkupOptions}
                    attachmentsTotal={attachmentStats?.total ?? 0}
                    hasFinalReport={Boolean(selected.workspace?.finalReport)}
                    progressInitial={normalizeProgress(selected.workspace?.progressJson)}
                    workspaceAvailable={Boolean(selected.workspace)}
                    initialPromptTemplate={selected.workspace?.promptTemplate ?? ""}
                    initialReportTemplate={selected.workspace?.reportTemplate ?? ""}
                  />
                ) : (
                  <Card className="p-4">
                    <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
                      <span>请先选择问卷</span>
                      <QuestionnairePickerButton checkups={checkupOptions} buttonLabel="选择问卷" />
                    </div>
                  </Card>
                )}
              </div>

              <div className="min-h-0 min-w-0 space-y-4 overflow-y-auto pr-1" id="workflow-detail">
                {selected?.workspace ? (
                  <LexcheckWorkspaceRightPanel
                    key={selected.token}
                    token={selected.token}
                    initialFinalReport={
                      selected.workspace.finalReport
                        ? {
                            id: selected.workspace.finalReport.id,
                            reportText: selected.workspace.finalReport.reportText,
                            notesText: selected.workspace.finalReport.notesText ?? "",
                            updatedAt: selected.workspace.finalReport.updatedAt,
                          }
                        : null
                    }
                    initialSectionDrafts={selected.workspace.sectionDrafts}
                    sections={config?.sections ?? []}
                    answers={(answers ?? {}) as Answers}
                    attachments={selected.attachments.filter((a) => a.kind === "detailed")}
                    companyName={selected.companyName}
                    questionnaireStatus={selected.status}
                  />
                ) : (
                  <Card className="p-4 text-sm text-muted-foreground">
                    {selected ? "工作流暂不可用。" : "请先选择问卷以查看工作区。"}
                  </Card>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
