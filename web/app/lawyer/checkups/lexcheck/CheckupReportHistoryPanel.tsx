"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronRight, Download, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadQuickExamDocx } from "./export-quick-exam-report";

type HistoryJob = {
  id: string;
  createdAt: string;
  mode: string;
};

export function CheckupReportHistoryPanel({
  token,
  companyName,
}: {
  token: string;
  companyName: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<HistoryJob[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
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

  async function handlePreview(jobId: string) {
    setPreviewingId(jobId);
    setDownloadErr(null);
    try {
      const res = await fetch(
        `/api/lawyer/checkups/${encodeURIComponent(token)}/quick-exam-report/history/${encodeURIComponent(jobId)}`
      );
      if (!res.ok) throw new Error("获取报告失败");
      const json = (await res.json()) as { job?: { reportText?: string } };
      const text = json.job?.reportText?.trim();
      if (!text) throw new Error("报告内容为空");
      window.dispatchEvent(
        new CustomEvent("lexcheck:load-history-report", { detail: { token, jobId, reportText: text } })
      );
    } catch (e) {
      setDownloadErr(String(e));
    } finally {
      setPreviewingId(null);
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
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 text-base text-white/60"
      >
        <span>历史报告</span>
        <ChevronRight
          className={`h-4 w-4 shrink-0 text-white/50 transition-transform ${open ? "rotate-90" : ""}`}
        />
      </button>
      {open ? (
        <div className="mt-3 space-y-2 rounded-lg bg-sidebar-accent/40 p-2 text-sm">
          {historyLoading ? (
            <div className="flex items-center gap-1.5 px-1 py-1 text-white/50">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>加载中…</span>
            </div>
          ) : history.length === 0 ? (
            <div className="px-1 py-1 text-white/50">暂无历史记录，生成后将在此显示。</div>
          ) : (
            history.map((job) => (
              <div
                key={job.id}
                role="button"
                tabIndex={0}
                onClick={() => void handlePreview(job.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    void handlePreview(job.id);
                  }
                }}
                className="flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-2 hover:bg-white/10"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 truncate text-white">
                    {previewingId === job.id ? (
                      <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
                    ) : null}
                    <span className="truncate">{new Date(job.createdAt).toLocaleString()}</span>
                  </div>
                  <div className="text-white/50">
                    {job.mode === "assembled" ? "拼装" : job.mode === "sync_full" ? "同步" : "分块"}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-white/70 hover:bg-sidebar-accent hover:text-white"
                    disabled={downloadingId === job.id}
                    title="下载 Word"
                    aria-label="下载 Word"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDownloadWord(job.id);
                    }}
                  >
                    {downloadingId === job.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-white/50 hover:bg-sidebar-accent hover:text-destructive"
                    disabled={deletingId === job.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDelete(job.id);
                    }}
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
          {downloadErr && <div className="px-1 text-destructive">{downloadErr}</div>}
        </div>
      ) : null}
    </div>
  );
}
