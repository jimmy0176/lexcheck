import path from "node:path";
import { readFile } from "node:fs/promises";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { Answers, QuestionnaireConfig } from "@/lib/questionnaire-types";
import { normalizeProgress } from "@/lib/checkup-workflow";
import { LexcheckMiddleColumn } from "./LexcheckMiddleColumn";
import { LexcheckWorkspaceRightPanel } from "./LexcheckWorkspaceRightPanel";
import { ProjectProgressPanel } from "./ProjectProgressPanel";
import { QuestionnairePickerButton, WorkspaceSettingsButtons } from "./WorkspaceControls";

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
      kind: "preliminary" | "detailed";
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
          attachments: { orderBy: { createdAt: "desc" } },
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
    <main className="min-h-dvh bg-background">
      <div className="mx-auto w-full max-w-[1800px] px-6 py-4">
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

            <div className="grid gap-4 xl:grid-cols-[211px_275px_minmax(0,1fr)]">
              <div className="space-y-4">
                <div>
                  <Link
                    href="/"
                    className="font-heading text-2xl font-semibold leading-none tracking-[0.06em] transition-opacity hover:opacity-80"
                  >
                    HE Partners
                  </Link>
                  <div className="mt-1 text-sm text-muted-foreground">Lexcheck</div>
                </div>

                <Card className="p-4">
                  <div className="text-xs text-muted-foreground">Lexcheck 工作区</div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="truncate text-sm font-semibold">
                      {selected?.companyName?.trim() ? selected.companyName : "未选择问卷"}
                    </div>
                    <QuestionnairePickerButton
                      checkups={checkupOptions}
                      selectedToken={selected?.token}
                      buttonLabel="选择问卷"
                    />
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    token: {selected?.token ?? "—"}
                  </div>
                  <div className="mt-2">
                    {selected ? (
                      <Badge variant={selected.status === "submitted" ? "default" : "secondary"}>
                        {selected.status === "submitted" ? "已提交" : "草稿"}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">请先选择问卷</span>
                    )}
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="text-sm font-semibold">项目状态</div>
                  <div className="mt-3 space-y-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">补充材料</span>
                      <span>{selected ? `${attachmentStats?.total ?? 0} 份` : "—"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">分部草稿</span>
                      <span>
                        {selected?.workspace ? `${selected.workspace.sectionDrafts.length} 个` : "不可用"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">最终报告</span>
                      <span>{selected?.workspace?.finalReport ? "已生成" : "未生成"}</span>
                    </div>
                  </div>
                  {selected?.workspace ? (
                    <ProjectProgressPanel
                      token={selected.token}
                      initialProgress={normalizeProgress(selected.workspace.progressJson)}
                    />
                  ) : null}
                </Card>

                {selected ? (
                  <Card className="p-4">
                    <div className="text-sm font-semibold">配置中心</div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      模板与模型参数通过弹窗设置。
                    </p>
                    <div className="mt-3">
                      <WorkspaceSettingsButtons
                        token={selected.token}
                        initialPromptTemplate={selected.workspace?.promptTemplate ?? ""}
                        initialReportTemplate={selected.workspace?.reportTemplate ?? ""}
                      />
                    </div>
                  </Card>
                ) : null}
              </div>

              <div className="space-y-4" id="file-management">
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
                  />
                ) : (
                  <Card className="p-4 text-sm text-muted-foreground">请先选择问卷后上传文件。</Card>
                )}
              </div>

              <div className="min-w-0 space-y-4" id="workflow-detail">
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
