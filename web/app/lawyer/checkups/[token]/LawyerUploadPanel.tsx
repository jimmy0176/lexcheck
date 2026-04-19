"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, FolderCog, Loader2, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type ExistingAttachment = {
  id: string;
  fileName: string;
  sizeBytes: number;
  extractError?: string | null;
  createdAt?: string;
};

function notifyLexcheckAttachmentsRefresh(t: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("lexcheck:attachments-refresh", { detail: { token: t } }));
}

export type LawyerUploadAttachmentKind = "preliminary" | "detailed";

export function LawyerUploadPanel({
  token,
  title,
  attachmentKind = "detailed",
}: {
  token: string;
  title: string;
  attachmentKind?: LawyerUploadAttachmentKind;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [existing, setExisting] = useState<ExistingAttachment[]>([]);
  const [manageOpen, setManageOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  function mergeFiles(base: File[], nextFiles: File[]) {
    const merged = [...base];
    for (const f of nextFiles) {
      const exists = merged.some((x) => x.name === f.name && x.size === f.size);
      if (!exists) merged.push(f);
    }
    return merged;
  }

  const kindQuery = `kind=${encodeURIComponent(attachmentKind)}`;

  const refreshList = useCallback(async () => {
    try {
      const res = await fetch(`/api/lawyer/checkups/${token}/attachments?${kindQuery}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const json = (await res.json()) as { attachments?: ExistingAttachment[] };
      setExisting(json.attachments ?? []);
      notifyLexcheckAttachmentsRefresh(token);
    } catch {
      // ignore
    }
  }, [token, kindQuery]);

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  async function uploadNow(sourceFiles?: File[]) {
    const actualFiles = sourceFiles ?? files;
    if (actualFiles.length === 0 || uploading) return;
    setUploading(true);
    setErr(null);
    try {
      const form = new FormData();
      for (const file of actualFiles) form.append("files", file);
      form.set("attachmentKind", attachmentKind);
      const res = await fetch(`/api/lawyer/checkups/${token}/attachments`, {
        method: "POST",
        body: form,
      });
      const contentType = res.headers.get("content-type") ?? "";
      let json: { message?: string } | null = null;
      let rawText = "";
      if (contentType.includes("application/json")) {
        json = (await res.json()) as { message?: string };
      } else {
        rawText = await res.text();
      }
      if (!res.ok) {
        if (res.status === 413) {
          setErr("上传失败：文件过大（网关限制）。请联系管理员将 Nginx 的 client_max_body_size 调大到 20m。");
          return;
        }
        setErr(
          json?.message ??
            `上传失败（${res.status}）${rawText ? `：${rawText.slice(0, 120)}` : ""}`
        );
        return;
      }
      setFiles((prev) =>
        prev.filter((old) => !actualFiles.some((f) => f.name === old.name && f.size === old.size))
      );
      await refreshList();
    } catch (e) {
      setErr(String(e));
    } finally {
      setUploading(false);
    }
  }

  async function deleteOne(id: string) {
    setDeletingId(id);
    setErr(null);
    try {
      const res = await fetch(`/api/lawyer/checkups/${token}/attachments/${id}`, {
        method: "DELETE",
      });
      const json = (await res.json()) as { message?: string; error?: string };
      if (!res.ok) {
        setErr(json.message ?? json.error ?? `删除失败（${res.status}）`);
        return;
      }
      await refreshList();
    } catch (e) {
      setErr(String(e));
    } finally {
      setDeletingId(null);
    }
  }

  async function clearAll() {
    if (existing.length === 0 || clearing) return;
    setClearing(true);
    setErr(null);
    try {
      const res = await fetch(`/api/lawyer/checkups/${token}/attachments?${kindQuery}`, {
        method: "DELETE",
      });
      const json = (await res.json()) as { message?: string };
      if (!res.ok) {
        setErr(json.message ?? `清空失败（${res.status}）`);
        return;
      }
      setExisting([]);
      setManageOpen(false);
      notifyLexcheckAttachmentsRefresh(token);
    } catch (e) {
      setErr(String(e));
    } finally {
      setClearing(false);
    }
  }

  const downloadUrl = (id: string) =>
    `/api/lawyer/checkups/${token}/attachments/${id}`;

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-semibold">{title}</div>
        <button
          type="button"
          title="已上传文件管理"
          onClick={() => setManageOpen(true)}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors hover:border-border hover:bg-muted/40 hover:text-foreground"
        >
          <FolderCog className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <div
        className={`mt-2 cursor-pointer rounded-lg border border-dashed px-3 py-3 text-center text-xs text-muted-foreground transition sm:text-sm ${
          dragActive ? "border-primary bg-primary/5" : "hover:bg-muted/30"
        }`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragActive(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          const dropped = Array.from(e.dataTransfer.files ?? []);
          if (dropped.length > 0) {
            setFiles((prev) => mergeFiles(prev, dropped));
            void uploadNow(dropped);
          }
        }}
      >
        {dragActive ? "松开以上传" : "点击或拖入文件"}
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            const selected = Array.from(e.target.files ?? []);
            if (selected.length === 0) return;
            setFiles((prev) => mergeFiles(prev, selected));
            void uploadNow(selected);
          }}
        />
      </div>

      <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto text-xs sm:text-sm">
        {uploading && (
          <li className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
            <span>正在上传…</span>
          </li>
        )}
        {files.map((file) => (
          <li key={`${file.name}-${file.size}`} className="truncate text-muted-foreground">
            {file.name}
          </li>
        ))}
        {existing.map((item) => (
          <li key={item.id} className="flex min-w-0 items-center gap-1">
            <span className="min-w-0 flex-1 truncate text-foreground">{item.fileName}</span>
            {item.extractError ? (
              <span className="shrink-0 text-[10px] text-amber-600">解析异常</span>
            ) : null}
          </li>
        ))}
        {!uploading && files.length === 0 && existing.length === 0 ? (
          <li className="text-muted-foreground/80">暂无文件</li>
        ) : null}
      </ul>

      {err && <div className="mt-2 text-xs text-destructive">{err}</div>}

      {manageOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onClick={() => setManageOpen(false)}
        >
          <Card
            className="max-h-[min(80vh,520px)] w-full max-w-md overflow-hidden p-0 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b px-4 py-3">
              <span className="text-sm font-semibold">已上传文件</span>
              <button
                type="button"
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => setManageOpen(false)}
                aria-label="关闭"
              >
                ×
              </button>
            </div>
            <ul className="max-h-[min(50vh,360px)] divide-y overflow-y-auto">
              {existing.length === 0 ? (
                <li className="px-4 py-8 text-center text-sm text-muted-foreground">暂无已上传文件</li>
              ) : null}
              {existing.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm"
                >
                  <span className="min-w-0 flex-1 truncate" title={item.fileName}>
                    {item.fileName}
                  </span>
                  <a
                    href={downloadUrl(item.id)}
                    download
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-transparent text-muted-foreground hover:border-border hover:bg-muted/50 hover:text-foreground"
                    title="下载"
                  >
                    <Download className="h-4 w-4" />
                  </a>
                  <button
                    type="button"
                    title="删除"
                    disabled={deletingId === item.id}
                    onClick={() => void deleteOne(item.id)}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-transparent text-muted-foreground hover:border-border hover:bg-destructive/10 hover:text-destructive"
                  >
                    {deletingId === item.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex justify-end gap-2 border-t px-4 py-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setManageOpen(false)}
              >
                关闭
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={existing.length === 0 || clearing}
                onClick={() => void clearAll()}
              >
                {clearing ? "清空中…" : "清空全部"}
              </Button>
            </div>
          </Card>
        </div>
      ) : null}
    </Card>
  );
}
