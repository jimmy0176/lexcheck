"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadQuickExamDocx } from "./export-quick-exam-report";

type HistoryJob = {
  id: string;
  createdAt: string;
  mode: string;
  version: number;
};

const CN_DIGITS = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九"];

/** 生成版本号的中文序数（1-99），超出范围回退为阿拉伯数字，报告标题风格与正文的中文序号章节标题保持一致。 */
function toChineseOrdinal(n: number): string {
  if (n <= 0 || n > 99) return String(n);
  if (n < 10) return CN_DIGITS[n]!;
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  const tensPart = tens === 1 ? "十" : `${CN_DIGITS[tens]}十`;
  return ones === 0 ? tensPart : `${tensPart}${CN_DIGITS[ones]}`;
}

export function CheckupReportHistoryPanel({
  token,
  companyName,
}: {
  token: string;
  companyName: string | null;
}) {
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

  async function handleDownloadWord(job: HistoryJob) {
    setDownloadingId(job.id);
    setDownloadErr(null);
    try {
      const res = await fetch(
        `/api/lawyer/checkups/${encodeURIComponent(token)}/quick-exam-report/history/${encodeURIComponent(job.id)}`
      );
      if (!res.ok) throw new Error("获取报告失败");
      const json = (await res.json()) as { job?: { reportText?: string } };
      const text = json.job?.reportText?.trim();
      if (!text) throw new Error("报告内容为空");
      const base = companyName?.trim() || `体检报告-${token.slice(0, 8)}`;
      await downloadQuickExamDocx(text, base, new Date(job.createdAt));
    } catch (e) {
      setDownloadErr(String(e));
    } finally {
      setDownloadingId(null);
    }
  }

  async function handlePreview(job: HistoryJob) {
    setPreviewingId(job.id);
    setDownloadErr(null);
    try {
      const res = await fetch(
        `/api/lawyer/checkups/${encodeURIComponent(token)}/quick-exam-report/history/${encodeURIComponent(job.id)}`
      );
      if (!res.ok) throw new Error("获取报告失败");
      const json = (await res.json()) as { job?: { reportText?: string } };
      const text = json.job?.reportText?.trim();
      if (!text) throw new Error("报告内容为空");
      window.dispatchEvent(
        new CustomEvent("lexcheck:load-history-report", {
          detail: { token, jobId: job.id, reportText: text, createdAt: job.createdAt },
        })
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
    <div className="space-y-2 text-sm">
      {historyLoading ? (
        <div className="flex items-center gap-1.5 px-1 py-1 text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>加载中…</span>
        </div>
      ) : history.length === 0 ? (
        <div className="px-1 py-1 text-muted-foreground">暂无历史记录，生成后将在此显示。</div>
      ) : (
        history.map((job) => (
          <div
            key={job.id}
            role="button"
            tabIndex={0}
            onClick={() => void handlePreview(job)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                void handlePreview(job);
              }
            }}
            className="flex cursor-pointer items-center justify-between gap-2 rounded-md border border-border/60 px-2.5 py-2 hover:bg-muted/40"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 truncate text-foreground">
                {previewingId === job.id ? (
                  <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
                ) : null}
                <span className="truncate">
                  {companyName?.trim() || "未填写公司名称"}法律体检报告第{toChineseOrdinal(job.version)}版
                </span>
              </div>
              <div className="truncate text-muted-foreground">
                {new Date(job.createdAt).toLocaleString()} ·{" "}
                {job.mode === "assembled_fusion"
                  ? "融合"
                  : job.mode === "assembled_concat" || job.mode === "assembled"
                    ? "拼装"
                    : job.mode === "assembled_advanced"
                      ? "高级"
                      : job.mode === "assembled_no_ai"
                        ? "无 AI"
                        : job.mode === "sync_full"
                          ? "同步"
                          : "分块"}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                disabled={downloadingId === job.id}
                title="下载 Word"
                aria-label="下载 Word"
                onClick={(e) => {
                  e.stopPropagation();
                  void handleDownloadWord(job);
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
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
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
  );
}
