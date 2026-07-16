"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronRight, Loader2, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LawyerUploadPanel } from "../[token]/LawyerUploadPanel";
import { downloadQuickExamDocx } from "./export-quick-exam-report";
import { QuestionnairePickerButton, WorkspaceSettingsButtons } from "./WorkspaceControls";
import { ProjectProgressPanel } from "./ProjectProgressPanel";
import type { WorkflowProgressMap } from "@/lib/checkup-workflow";

type SectionDraftSummary = {
  id: string;
  sectionName: string;
  updatedAt: Date | string;
};

type HistoryJob = {
  id: string;
  createdAt: string;
  mode: string;
};

type CheckupOption = {
  id: string;
  token: string;
  companyName: string | null;
  status: "draft" | "submitted";
  savedAtLabel: string;
};

export function LexcheckMiddleColumn({
  token,
  sectionDrafts,
  companyName,
  status,
  checkupOptions,
  attachmentsTotal,
  hasFinalReport,
  progressInitial,
  workspaceAvailable,
  initialPromptTemplate,
  initialReportTemplate,
}: {
  token: string;
  sectionDrafts: SectionDraftSummary[];
  companyName: string | null;
  status: "draft" | "submitted";
  checkupOptions: CheckupOption[];
  attachmentsTotal: number;
  hasFinalReport: boolean;
  progressInitial: WorkflowProgressMap;
  workspaceAvailable: boolean;
  initialPromptTemplate: string;
  initialReportTemplate: string;
}) {
  const [middleOpen, setMiddleOpen] = useState(false);
  const [history, setHistory] = useState<HistoryJob[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [downloadErr, setDownloadErr] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch(
        `/api/lawyer/checkups/${encodeURIComponent(token)}/quick-exam-report/history`,
        { cache: "no-store" }
      );
      if (!res.ok) return;
      const json = (await res.json()) as { jobs?: HistoryJob[] };
      setHistory(json.jobs ?? []);
    } catch {
      // ignore
    } finally {
      setHistoryLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void fetchHistory();
  }, [fetchHistory]);

  useEffect(() => {
    const onEvt = (e: Event) => {
      const ce = e as CustomEvent<{ token?: string }>;
      if (ce.detail?.token === token) void fetchHistory();
    };
    window.addEventListener("lexcheck:quick-exam-history-updated", onEvt as EventListener);
    return () =>
      window.removeEventListener("lexcheck:quick-exam-history-updated", onEvt as EventListener);
  }, [token, fetchHistory]);

  async function handleDownloadWord(jobId: string) {
    setDownloadingId(jobId);
    setDownloadErr(null);
    try {
      const res = await fetch(
        `/api/lawyer/checkups/${encodeURIComponent(token)}/quick-exam-report/history/${encodeURIComponent(jobId)}`
      );
      if (!res.ok) throw new Error("获取报告失败");
      const json = (await res.json()) as { job?: { reportText?: string } };
      const text = json.job?.reportText?.trim();
      if (!text) throw new Error("报告内容为空");
      const base = companyName?.trim() || `体检报告-${token.slice(0, 8)}`;
      await downloadQuickExamDocx(text, base);
    } catch (e) {
      setDownloadErr(String(e));
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleDelete(jobId: string) {
    if (!window.confirm("确认删除该历史记录？此操作不可恢复。")) return;
    setDeletingId(jobId);
    setDownloadErr(null);
    try {
      const res = await fetch(
        `/api/lawyer/checkups/${encodeURIComponent(token)}/quick-exam-report/history/${encodeURIComponent(jobId)}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("删除失败");
      setHistory((prev) => prev.filter((j) => j.id !== jobId));
    } catch (e) {
      setDownloadErr(String(e));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="text-sm font-semibold">工作区（暂不可用）</div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
            {companyName?.trim() ? companyName : "未选择问卷"}
          </div>
          <QuestionnairePickerButton checkups={checkupOptions} selectedToken={token} buttonLabel="选择问卷" />
        </div>
        <div className="mt-2 text-xs text-muted-foreground">token: {token}</div>
        <div className="mt-2">
          <Badge variant={status === "submitted" ? "default" : "secondary"}>
            {status === "submitted" ? "已提交" : "草稿"}
          </Badge>
        </div>
      </Card>

      <Card className="p-4">
        <div className="text-sm font-semibold">项目状态</div>
        <div className="mt-3 space-y-2 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">补充材料</span>
            <span className="text-foreground">{attachmentsTotal} 份</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">分部草稿</span>
            <span className="text-foreground">{workspaceAvailable ? `${sectionDrafts.length} 个` : "不可用"}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">最终报告</span>
            <span className="text-foreground">{hasFinalReport ? "已生成" : "未生成"}</span>
          </div>
        </div>
        {workspaceAvailable ? <ProjectProgressPanel token={token} initialProgress={progressInitial} /> : null}
      </Card>

      <Card className="p-4">
        <div className="text-sm font-semibold">配置中心</div>
        <p className="mt-1 text-xs text-muted-foreground">模板与模型参数通过弹窗设置。</p>
        <div className="mt-3">
          <WorkspaceSettingsButtons
            token={token}
            initialPromptTemplate={initialPromptTemplate}
            initialReportTemplate={initialReportTemplate}
          />
        </div>
      </Card>

      {/* 三方速查 — always visible */}
      <LawyerUploadPanel token={token} title="三方速查" attachmentKind="preliminary" />

      {/* 体检报告历史 */}
      <Card className="p-4">
        <div className="text-sm font-semibold">体检报告历史</div>
        <div className="mt-3 space-y-2 text-xs">
          {historyLoading ? (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>加载中…</span>
            </div>
          ) : history.length === 0 ? (
            <div className="rounded-md border px-3 py-2 text-muted-foreground">
              暂无历史记录，生成后将在此显示。
            </div>
          ) : (
            history.map((job) => (
              <div
                key={job.id}
                className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-foreground">
                    {new Date(job.createdAt).toLocaleString()}
                  </div>
                  <div className="text-muted-foreground">
                    {job.mode === "sync_full" ? "同步" : "分块"}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    disabled={downloadingId === job.id}
                    onClick={() => void handleDownloadWord(job.id)}
                  >
                    {downloadingId === job.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      "Word"
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    disabled={deletingId === job.id}
                    onClick={() => void handleDelete(job.id)}
                  >
                    {deletingId === job.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            ))
          )}
          {downloadErr && <div className="text-destructive">{downloadErr}</div>}
        </div>
      </Card>

      {/* 详细资料 — collapsible, default collapsed */}
      <LawyerUploadPanel
        token={token}
        title="详细资料"
        attachmentKind="detailed"
        collapsible
        defaultOpen={false}
      />

      {/* 中间文件管理 — collapsible, default collapsed */}
      <Card className="overflow-hidden p-0">
        <button
          type="button"
          className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold"
          onClick={() => setMiddleOpen((o) => !o)}
        >
          <span>中间文件管理</span>
          <ChevronRight
            className={`h-4 w-4 text-muted-foreground transition-transform ${middleOpen ? "rotate-90" : ""}`}
          />
        </button>
        {middleOpen && (
          <div className="border-t px-4 py-3">
            <div className="space-y-2 text-xs text-muted-foreground">
              {sectionDrafts.length ? (
                sectionDrafts.slice(0, 8).map((draft) => (
                  <div key={draft.id} className="rounded-md border px-3 py-2">
                    <div className="font-medium text-foreground">{draft.sectionName}</div>
                    <div className="mt-1">更新：{new Date(draft.updatedAt).toLocaleString()}</div>
                  </div>
                ))
              ) : (
                <div className="rounded-md border px-3 py-2">
                  暂无分部草稿，先在右侧生成。
                </div>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
