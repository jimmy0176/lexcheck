import path from "node:path";
import { readFile } from "node:fs/promises";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import type { Answers, QuestionnaireConfig } from "@/lib/questionnaire-types";
import { WorkspaceSidePanel, WorkspaceSidePanelSection } from "@/components/workspace-side-panel";
import { CheckupReportHistoryPanel } from "./CheckupReportHistoryPanel";
import { CheckupReportPanel } from "./CheckupReportPanel";
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
  let dbError = false;
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

  const answers = selected ? ((selected.answersJson ?? {}) as Answers) : null;
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

                <WorkspaceSidePanelSection>
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate text-base font-semibold text-white">
                      {selected?.companyName?.trim() ? selected.companyName : "未选择问卷"}
                    </div>
                    <QuestionnairePickerButton
                      checkups={checkupOptions}
                      selectedToken={selected?.token}
                      iconOnly
                    />
                  </div>
                </WorkspaceSidePanelSection>

                {selected ? (
                  <WorkspaceSidePanelSection className="min-h-0 flex-1 overflow-y-auto">
                    <CheckupReportHistoryPanel token={selected.token} companyName={selected.companyName} />
                  </WorkspaceSidePanelSection>
                ) : null}

                <WorkspaceSidePanelSection>
                  <WorkspaceSettingsButtons />
                </WorkspaceSidePanelSection>
              </WorkspaceSidePanel>
            </div>

            <div className="flex h-full min-h-0 min-w-0 flex-col">
              {selected ? (
                <CheckupReportPanel
                  key={selected.token}
                  token={selected.token}
                  sections={config?.sections ?? []}
                  answers={(answers ?? {}) as Answers}
                  companyName={selected.companyName}
                  contactName={selected.contactName}
                  contactPhone={selected.contactPhone}
                  questionnaireStatus={selected.status}
                />
              ) : (
                <Card className="h-full rounded-l-none p-4 text-sm text-muted-foreground">
                  请先选择问卷以查看体检报告。
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
