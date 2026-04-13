"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type ExistingAttachment = {
  id: string;
  fileName: string;
  sizeBytes: number;
  extractError?: string | null;
  createdAt?: string;
};

export function LawyerUploadPanel({ token }: { token: string }) {
  const [files, setFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [existing, setExisting] = useState<ExistingAttachment[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  function mergeFiles(base: File[], nextFiles: File[]) {
    const merged = [...base];
    for (const f of nextFiles) {
      const exists = merged.some((x) => x.name === f.name && x.size === f.size);
      if (!exists) merged.push(f);
    }
    return merged;
  }

  const totalSizeText = useMemo(() => {
    const totalBytes = files.reduce((acc, file) => acc + file.size, 0);
    const sizeInMb = totalBytes / 1024 / 1024;
    return `${sizeInMb.toFixed(2)} MB`;
  }, [files]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/lawyer/checkups/${token}/attachments`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const json = (await res.json()) as { attachments?: ExistingAttachment[] };
        if (!cancelled) setExisting(json.attachments ?? []);
      } catch {
        // ignore list failure
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function uploadNow(sourceFiles?: File[]) {
    const actualFiles = sourceFiles ?? files;
    if (actualFiles.length === 0 || uploading) return;
    setUploading(true);
    setErr(null);
    try {
      const form = new FormData();
      for (const file of actualFiles) form.append("files", file);
      const res = await fetch(`/api/lawyer/checkups/${token}/attachments`, {
        method: "POST",
        body: form,
      });
      const contentType = res.headers.get("content-type") ?? "";
      let json: { message?: string; attachments?: ExistingAttachment[] } | null = null;
      let rawText = "";
      if (contentType.includes("application/json")) {
        json = (await res.json()) as {
          message?: string;
          attachments?: ExistingAttachment[];
        };
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
        prev.filter(
          (old) =>
            !actualFiles.some((f) => f.name === old.name && f.size === old.size)
        )
      );
      const listRes = await fetch(`/api/lawyer/checkups/${token}/attachments`, {
        cache: "no-store",
      });
      if (listRes.ok) {
        const listJson = (await listRes.json()) as { attachments?: ExistingAttachment[] };
        setExisting(listJson.attachments ?? []);
      }
    } catch (e) {
      setErr(String(e));
    } finally {
      setUploading(false);
    }
  }

  async function clearAll() {
    if (uploading) return;
    setErr(null);
    setFiles([]);
    if (existing.length === 0) return;
    try {
      const res = await fetch(`/api/lawyer/checkups/${token}/attachments`, {
        method: "DELETE",
      });
      const json = (await res.json()) as { message?: string };
      if (!res.ok) {
        setErr(json.message ?? `清空失败（${res.status}）`);
        return;
      }
      setExisting([]);
    } catch (e) {
      setErr(String(e));
    }
  }

  return (
    <Card className="p-4">
      <div className="text-base font-semibold">补充材料上传</div>
      <p className="mt-1 text-sm text-muted-foreground">
        律师可上传公司补充报告（如尽调、审计、合规报告等），后续将用于 AI 分析。
      </p>

      <div
        className={`mt-3 cursor-pointer rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground transition ${
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
            setFiles((prev) => {
              const merged = mergeFiles(prev, dropped);
              return merged;
            });
            void uploadNow(dropped);
          }
        }}
      >
        <div>{dragActive ? "松开以上传文件" : "点击或拖入文件到此处（支持多文件）"}</div>
        <div className="mt-1 text-xs">建议格式：PDF / DOC / DOCX / XLS / XLSX</div>
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

      <div className="mt-3">
        <div className="text-sm font-medium">待上传文件（将自动上传）</div>
        {files.length === 0 ? (
          <div className="mt-1 text-sm text-muted-foreground">暂未选择文件</div>
        ) : (
          <>
            <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-sm">
              {files.map((file) => (
                <li key={`${file.name}-${file.size}`} className="truncate text-muted-foreground">
                  {file.name}
                </li>
              ))}
            </ul>
            <div className="mt-2 text-xs text-muted-foreground">
              共 {files.length} 个文件，约 {totalSizeText}
            </div>
          </>
        )}
      </div>
      {err && <div className="mt-2 text-sm text-destructive">{err}</div>}

      <div className="mt-3">
        <div className="text-sm font-medium">已上传文件</div>
        {existing.length === 0 ? (
          <div className="mt-1 text-sm text-muted-foreground">暂无已上传文件</div>
        ) : (
          <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-sm">
            {existing.map((item) => (
              <li key={item.id} className="text-muted-foreground">
                <span className="truncate">{item.fileName}</span>
                {item.extractError && (
                  <span className="ml-1 text-xs text-amber-600">（解析异常）</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={files.length === 0 || uploading}
          onClick={() => void uploadNow()}
        >
          {uploading ? "上传中…" : "立即重试上传"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => void clearAll()}
          disabled={uploading || (files.length === 0 && existing.length === 0)}
        >
          清空
        </Button>
      </div>
    </Card>
  );
}
