"use client";

import { useEffect, useRef, useState } from "react";

type AttachmentInfo = {
  id: string;
  fileName: string;
  sizeBytes: number;
  createdAt: string;
  hasExtractedText: boolean;
  extractError: string | null;
  extractedTextTruncated: boolean;
  extractedTextOriginalLength: number | null;
  /** 提取的原文超过高级模式的详细摘要触发门槛（见 ADVANCED_THIRDPARTY_DETAIL_TRIGGER_CHARS），生成报告时会改用预提取摘要而不是原文 */
  willUseDetailedExtract: boolean;
  /** 摘要是否已经预处理生成好（上传时尝试过一次；未就绪时会在首次生成报告时按需补一次） */
  hasDetailedExtract: boolean;
};

export function ThirdPartyReportBox({ token }: { token: string }) {
  const [attachment, setAttachment] = useState<AttachmentInfo | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function load() {
    try {
      const res = await fetch(`/api/lawyer/checkups/${encodeURIComponent(token)}/third-party-report`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`加载失败 ${res.status}`);
      const json = (await res.json()) as { attachment: AttachmentInfo | null; enabled: boolean };
      setAttachment(json.attachment);
      setEnabled(json.enabled);
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function onFileChosen(file: File) {
    setBusy(true);
    setErr(null);
    try {
      const form = new FormData();
      form.set("file", file);
      const res = await fetch(`/api/lawyer/checkups/${encodeURIComponent(token)}/third-party-report`, {
        method: "POST",
        body: form,
      });
      const json = (await res.json()) as { ok?: boolean; message?: string };
      if (!res.ok || !json.ok) throw new Error(json.message ?? "上传失败");
      await load();
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function toggleEnabled(next: boolean) {
    setEnabled(next);
    try {
      const res = await fetch(`/api/lawyer/checkups/${encodeURIComponent(token)}/third-party-report`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      if (!res.ok) throw new Error("保存失败");
    } catch (e) {
      setErr(String(e));
      setEnabled(!next);
    }
  }

  async function removeAttachment() {
    if (!window.confirm("确认删除已上传的三方报告？")) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/lawyer/checkups/${encodeURIComponent(token)}/third-party-report`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("删除失败");
      await load();
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shrink-0 rounded-xl bg-card px-4 py-3.5 shadow-sm ring-1 ring-foreground/10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 text-base">
          <span className="shrink-0 text-muted-foreground">三方报告：</span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onFileChosen(file);
            }}
          />
          <button
            type="button"
            disabled={busy}
            className="shrink-0 text-sm text-primary underline underline-offset-2 disabled:opacity-50"
            onClick={() => fileInputRef.current?.click()}
          >
            {busy ? "处理中…" : attachment ? "重新上传" : "上传"}
          </button>
          {loading ? (
            <span className="text-muted-foreground">加载中…</span>
          ) : attachment ? (
            <>
              <span className="min-w-0 truncate">{attachment.fileName}</span>
              {attachment.extractError ? (
                <span className="shrink-0 text-sm text-destructive">解析失败：{attachment.extractError}</span>
              ) : attachment.hasExtractedText ? (
                <>
                  {attachment.extractedTextTruncated ? (
                    <span className="shrink-0 text-sm text-amber-700 dark:text-amber-400">
                      已提取内容，但原文约 {attachment.extractedTextOriginalLength?.toLocaleString() ?? "?"} 字，超出部分未纳入分析
                    </span>
                  ) : (
                    <span className="shrink-0 text-sm text-emerald-700 dark:text-emerald-400">已提取内容</span>
                  )}
                  {attachment.willUseDetailedExtract ? (
                    <span className="shrink-0 text-sm text-amber-700 dark:text-amber-400">
                      {attachment.hasDetailedExtract
                        ? "字数超长，已自动预提取摘要，高级模式将使用摘要生成报告"
                        : "字数超长，正在预提取摘要，首次生成报告时会自动补齐"}
                    </span>
                  ) : null}
                </>
              ) : (
                <span className="shrink-0 text-sm text-muted-foreground">未提取到文字内容</span>
              )}
            </>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {attachment ? (
            <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <input type="checkbox" checked={enabled} onChange={(e) => void toggleEnabled(e.target.checked)} />
              参与本次报告生成
            </label>
          ) : null}
          {attachment ? (
            <button
              type="button"
              disabled={busy}
              className="text-sm text-destructive underline underline-offset-2 disabled:opacity-50"
              onClick={() => void removeAttachment()}
            >
              删除
            </button>
          ) : null}
        </div>
      </div>
      {err ? <div className="mt-1 text-sm text-destructive">{err}</div> : null}
    </div>
  );
}
