"use client";

import { useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Copy, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  getDdSegmentDefaultTemplate,
  LEXCHECK_QUICK_EXAM_SECTION_KEY,
  type DdSegmentDefaultBlock,
} from "@/lib/dd-segment-default-templates";

const CUSTOM_LS = "lexcheck:segment-saved-templates:v1";

type SavedSegTemplate = {
  id: string;
  name: string;
  description?: string;
  sectionKey: string;
  prompt: string;
  output: string;
  updatedAt: number;
};

type TemplateKind =
  | "empty"
  | "builtin-full"
  | "builtin-part"
  | "custom"
  | "unknown";

function loadSaved(): SavedSegTemplate[] {
  if (typeof window === "undefined") return [];
  try {
    const j = localStorage.getItem(CUSTOM_LS);
    if (!j) return [];
    const arr = JSON.parse(j) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (x): x is SavedSegTemplate =>
        Boolean(x) &&
        typeof (x as SavedSegTemplate).id === "string" &&
        typeof (x as SavedSegTemplate).sectionKey === "string" &&
        typeof (x as SavedSegTemplate).name === "string"
    );
  } catch {
    return [];
  }
}

function saveSaved(list: SavedSegTemplate[]) {
  localStorage.setItem(CUSTOM_LS, JSON.stringify(list));
}

function outputForChoice(block: DdSegmentDefaultBlock, choice: "full" | number): string {
  const subs = block.outputSubsections ?? [];
  if (choice === "full") return block.outputFull;
  const sub = subs[choice as number];
  if (!sub) return block.outputFull;
  return `## ${sub.title}\n\n${sub.body}`.trim();
}

function promptForChoice(
  block: DdSegmentDefaultBlock,
  choice: "full" | number,
  sectionKey: string | null
): string {
  const base = block.prompt.trim();
  const subs = block.outputSubsections ?? [];
  if (choice === "full") return base;
  const sub = subs[choice as number];
  if (!sub) return base;
  if (sectionKey === LEXCHECK_QUICK_EXAM_SECTION_KEY) {
    return `${base}\n\n【生成范围】请围绕「${sub.title}」要点撰写，并与 output 模版一致。`.trim();
  }
  return `${base}\n\n【生成范围】请围绕输出模版中的「${sub.title}」小节生成对应正文，并与「输出结构/要点」字段中的模版保持一致。`.trim();
}

function readPersistedFromLs(token: string, sectionKey: string) {
  if (typeof window === "undefined") return { prompt: "", output: "" };
  return {
    prompt: localStorage.getItem(`lexcheck:dd-segment:${token}:${sectionKey}:prompt`) ?? "",
    output: localStorage.getItem(`lexcheck:dd-segment:${token}:${sectionKey}:output`) ?? "",
  };
}

function classifyPersisted(
  p: string,
  o: string,
  sectionKey: string,
  defaults: DdSegmentDefaultBlock | null,
  savedAll: SavedSegTemplate[]
): { kind: TemplateKind; detail?: string } {
  const pt = p.trim();
  const ot = o.trim();
  if (!pt && !ot) return { kind: "empty" };
  if (defaults) {
    const subsections = defaults.outputSubsections ?? [];
    if (pt === defaults.prompt.trim() && ot === defaults.outputFull.trim()) {
      return { kind: "builtin-full" };
    }
    for (let i = 0; i < subsections.length; i++) {
      const pi = promptForChoice(defaults, i, sectionKey).trim();
      const oi = outputForChoice(defaults, i).trim();
      if (pt === pi && ot === oi) {
        return { kind: "builtin-part", detail: subsections[i].title };
      }
    }
  }
  for (const row of savedAll) {
    if (row.sectionKey !== sectionKey) continue;
    if (pt === row.prompt.trim() && ot === row.output.trim()) {
      return { kind: "custom", detail: row.name };
    }
  }
  return { kind: "unknown" };
}

function activeListItemId(
  pc: { kind: TemplateKind; detail?: string },
  defaults: DdSegmentDefaultBlock | null,
  sectionKey: string,
  savedAll: SavedSegTemplate[]
): string | null {
  if (pc.kind === "builtin-full") return "builtin:full";
  if (pc.kind === "builtin-part" && defaults && pc.detail) {
    const idx = (defaults.outputSubsections ?? []).findIndex((s) => s.title === pc.detail);
    if (idx >= 0) return `builtin:part:${idx}`;
  }
  if (pc.kind === "custom" && pc.detail) {
    const row = savedAll.find((s) => s.sectionKey === sectionKey && s.name === pc.detail);
    if (row) return `custom:${row.id}`;
  }
  return null;
}

function newTemplateId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `t_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

type ListRow = {
  id: string;
  title: string;
  subtitle: string;
  prompt: string;
  output: string;
};

export function SegmentTemplateSettingsDialog({
  open,
  onOpenChange,
  token,
  sectionKey,
  sectionTitle,
  prompt,
  output,
  onPromptChange,
  onOutputChange,
  onPersist,
  variant = "segment",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: string;
  sectionKey: string | null;
  sectionTitle: string;
  prompt: string;
  output: string;
  onPromptChange: (v: string) => void;
  onOutputChange: (v: string) => void;
  onPersist: () => void;
  /** 快速体检：独立文案与预览逻辑，不与尽调分部混用 */
  variant?: "segment" | "quickExam";
}) {
  const isQuickExam = variant === "quickExam";
  const [savedList, setSavedList] = useState<SavedSegTemplate[]>(() => loadSaved());
  const [search, setSearch] = useState("");
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [customDraft, setCustomDraft] = useState<{ name: string; desc: string } | null>(null);

  const persisted = useMemo(() => {
    if (!open || !sectionKey || typeof window === "undefined") return { prompt: "", output: "" };
    return readPersistedFromLs(token, sectionKey);
  }, [open, sectionKey, token]);

  const defaults = useMemo(
    () => (sectionKey ? getDdSegmentDefaultTemplate(sectionKey) : null),
    [sectionKey]
  );

  const persistedClass = useMemo(() => {
    if (!open || !sectionKey) return { kind: "empty" as const };
    return classifyPersisted(persisted.prompt, persisted.output, sectionKey, defaults, savedList);
  }, [open, persisted.prompt, persisted.output, sectionKey, defaults, savedList]);

  const activeId = useMemo(
    () => activeListItemId(persistedClass, defaults, sectionKey ?? "", savedList),
    [persistedClass, defaults, sectionKey, savedList]
  );

  const dirty = Boolean(
    sectionKey &&
      (prompt.trim() !== persisted.prompt.trim() || output.trim() !== persisted.output.trim())
  );

  const allRows = useMemo((): ListRow[] => {
    const rows: ListRow[] = [];
    const isQuickList =
      isQuickExam || sectionKey === LEXCHECK_QUICK_EXAM_SECTION_KEY;
    if (defaults) {
      const subsections = defaults.outputSubsections ?? [];
      rows.push({
        id: "builtin:full",
        title: isQuickList ? "内置默认（全文）" : "内置默认（整段）",
        subtitle: isQuickList
          ? "完整内置模版"
          : "全部「##」小节合并 · 与模版包一致",
        prompt: defaults.prompt.trim(),
        output: defaults.outputFull.trim(),
      });
      subsections.forEach((sub, idx) => {
        rows.push({
          id: `builtin:part:${idx}`,
          title: `内置默认 · ${sub.title}`,
          subtitle: isQuickList ? `「${sub.title}」要点范围` : "仅本小节范围",
          prompt: promptForChoice(defaults, idx, sectionKey).trim(),
          output: outputForChoice(defaults, idx).trim(),
        });
      });
    }
    for (const s of savedList) {
      if (s.sectionKey !== sectionKey) continue;
      rows.push({
        id: `custom:${s.id}`,
        title: s.name,
        subtitle: s.description?.trim() || "我的模版库",
        prompt: s.prompt,
        output: s.output,
      });
    }
    return rows;
  }, [defaults, savedList, sectionKey, isQuickExam]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allRows;
    return allRows.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.subtitle.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q)
    );
  }, [allRows, search]);

  const autoPickId = useMemo(() => {
    if (!open || !sectionKey) return null;
    if (persistedClass.kind === "unknown") return null;
    return activeId ?? allRows[0]?.id ?? null;
  }, [open, sectionKey, persistedClass.kind, activeId, allRows]);

  const effectivePick = useMemo(() => {
    if (pickedId && allRows.some((r) => r.id === pickedId)) return pickedId;
    return autoPickId;
  }, [pickedId, autoPickId, allRows]);

  const customRow = useMemo(() => {
    if (!effectivePick?.startsWith("custom:")) return null;
    const sid = effectivePick.slice("custom:".length);
    return savedList.find((s) => s.id === sid) ?? null;
  }, [effectivePick, savedList]);

  function applyRow(row: ListRow) {
    onPromptChange(row.prompt);
    onOutputChange(row.output);
  }

  function handleSelectRow(id: string) {
    const row = allRows.find((r) => r.id === id);
    if (!row) return;
    setPickedId(id);
    if (id.startsWith("custom:")) {
      const sid = id.slice("custom:".length);
      const s = savedList.find((x) => x.id === sid);
      setCustomDraft(s ? { name: s.name, desc: s.description?.trim() ?? "" } : null);
    } else {
      setCustomDraft(null);
    }
    applyRow(row);
  }

  function handleNewTemplate() {
    if (!sectionKey) return;
    const id = newTemplateId();
    const p = prompt.trim();
    const o = output.trim();
    setSavedList((prev) => {
      const updatedAt = Date.now();
      const row: SavedSegTemplate = {
        id,
        name: "未命名模版",
        description: "",
        sectionKey,
        prompt: p,
        output: o,
        updatedAt,
      };
      const next = [row, ...prev];
      saveSaved(next);
      return next;
    });
    setPickedId(`custom:${id}`);
    setCustomDraft({ name: "未命名模版", desc: "" });
    onPromptChange(p);
    onOutputChange(o);
  }

  function handleDuplicateRow(source: ListRow) {
    if (!sectionKey) return;
    const id = newTemplateId();
    const name = `副本 · ${source.title}`.slice(0, 80);
    const description = source.subtitle === "我的模版库" ? "" : source.subtitle;
    setSavedList((prev) => {
      const updatedAt = Date.now();
      const row: SavedSegTemplate = {
        id,
        name,
        description,
        sectionKey,
        prompt: source.prompt,
        output: source.output,
        updatedAt,
      };
      const next = [row, ...prev];
      saveSaved(next);
      return next;
    });
    setPickedId(`custom:${id}`);
    setCustomDraft({ name, desc: description });
    applyRow(source);
  }

  function handleDeleteCustom(id: string) {
    setSavedList((prev) => {
      const next = prev.filter((s) => s.id !== id);
      saveSaved(next);
      return next;
    });
    if (effectivePick === `custom:${id}`) {
      const fb = allRows.find((r) => r.id === "builtin:full") ?? allRows[0];
      if (fb) handleSelectRow(fb.id);
      else {
        setPickedId(null);
        setCustomDraft(null);
      }
    }
  }

  function handleSaveLibraryEntry() {
    if (!sectionKey || !effectivePick?.startsWith("custom:")) return;
    const sid = effectivePick.slice("custom:".length);
    const name = (customDraft?.name ?? customRow?.name ?? "").trim() || "未命名模版";
    const desc = (customDraft?.desc ?? customRow?.description ?? "").trim();
    const p = prompt.trim();
    const o = output.trim();
    setSavedList((prev) => {
      const updatedAt = Date.now();
      const next = prev.map((s) =>
        s.id === sid
          ? {
              ...s,
              name,
              description: desc,
              prompt: p,
              output: o,
              updatedAt,
            }
          : s
      );
      saveSaved(next);
      return next;
    });
    setCustomDraft({ name, desc });
  }

  function handleRestore() {
    setPickedId(null);
    setCustomDraft(null);
    onPromptChange(persisted.prompt);
    onOutputChange(persisted.output);
  }

  const selectedRow = effectivePick ? allRows.find((r) => r.id === effectivePick) : null;
  const isBuiltinSelected = Boolean(effectivePick?.startsWith("builtin:"));
  const isCustomSelected = Boolean(effectivePick?.startsWith("custom:"));

  const metaTitle = isBuiltinSelected
    ? selectedRow?.title ?? "内置默认"
    : isCustomSelected
      ? (customDraft?.name ?? customRow?.name ?? "")
      : selectedRow
        ? selectedRow.title
        : "（请在左侧选择模版）";
  const metaDesc = isBuiltinSelected
    ? selectedRow?.subtitle ?? ""
    : isCustomSelected
      ? (customDraft?.desc ?? customRow?.description ?? "")
      : selectedRow
        ? selectedRow.subtitle
        : isQuickExam
          ? "左侧选择模版后在此编辑。"
          : "选择列表中的内置默认或「我的模版」以载入到右侧编辑区。";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-40 bg-black/50"
          )}
        />
        <Dialog.Content
          className={cn(
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "fixed top-1/2 left-1/2 z-[60] flex h-[min(90vh,52rem)] max-h-[92vh] min-h-0 w-[calc(100%-1rem)] max-w-5xl -translate-x-1/2 -translate-y-1/2 flex-col gap-0 overflow-hidden rounded-lg border bg-background p-0 shadow-lg duration-200 sm:max-w-5xl"
          )}
        >
        <div className="flex shrink-0 flex-col border-b px-5 pb-3 pt-4 sm:px-6">
          <div className="flex items-start justify-between gap-3 pr-8">
            <div className="space-y-1.5 text-left">
              <Dialog.Title className="text-base font-semibold sm:text-lg">
                {isQuickExam ? "快速体检 · 提示词与模版" : "本段提示词与输出模版"}
              </Dialog.Title>
              <Dialog.Description className="sr-only">
                {isQuickExam
                  ? "编辑 prompt 与 output 两份 Markdown，保存后用于快速体检报告。"
                  : "编辑尽调分部的补充指令与输出结构，可保存为当前应用模版或模版库。"}
              </Dialog.Description>
              {!isQuickExam ? (
                <p className="text-xs text-muted-foreground sm:text-sm">
                  {sectionTitle}
                  {sectionKey ? (
                    <span className="text-muted-foreground">（{sectionKey}）</span>
                  ) : null}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground sm:text-sm">{sectionTitle}</p>
              )}
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="关闭"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>
          {!isQuickExam ? (
            <div
              className={cn(
                "mt-3 rounded-md border px-3 py-2 text-xs leading-relaxed sm:text-sm",
                dirty
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100"
                  : "border-border/80 bg-muted/30 text-muted-foreground"
              )}
            >
              {dirty ? (
                <>
                  <span className="font-medium text-foreground">未保存</span>
                  ：与已存模版不一致，保存后才会用于生成。
                </>
              ) : (
                <>
                  <span className="font-medium text-foreground">已同步</span>
                  ：与已保存模版一致。
                </>
              )}
            </div>
          ) : (
            <div
              className={cn(
                "mt-3 rounded-md border px-3 py-2 text-xs leading-relaxed sm:text-sm",
                dirty
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100"
                  : "border-border/80 bg-muted/30 text-muted-foreground"
              )}
            >
              {dirty ? (
                <span>
                  <span className="font-medium text-foreground">未保存</span>
                  ，保存后用于快速体检报告生成。
                </span>
              ) : (
                <span>
                  <span className="font-medium text-foreground">已同步</span>
                  已存模版。
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <aside className="flex min-h-0 w-full shrink-0 flex-col border-b lg:w-[min(30%,280px)] lg:border-b-0 lg:border-r">
            <div className="flex shrink-0 gap-2 border-b px-3 py-2.5 sm:px-4">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="搜索模版…"
                  className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-2 text-xs outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring sm:text-sm"
                />
              </div>
              <Button
                type="button"
                size="sm"
                className="h-9 shrink-0 gap-1 px-2.5 text-xs"
                onClick={handleNewTemplate}
                disabled={!sectionKey}
              >
                <Plus className="h-3.5 w-3.5" />
                新建
              </Button>
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-3 py-3 sm:px-4">
              {!defaults && sectionKey?.startsWith("dd_") ? (
                <p className="text-xs text-muted-foreground">
                  当前分段暂无内置默认。可在仓库执行{" "}
                  <code className="rounded bg-muted px-1 py-0.5 text-[10px]">npm run build:dd-templates</code>{" "}
                  后重新构建。
                </p>
              ) : null}
              {filteredRows.length === 0 ? (
                <p className="text-xs text-muted-foreground">无匹配模版，请调整搜索词。</p>
              ) : (
                filteredRows.map((row) => {
                  const isSel = effectivePick === row.id;
                  const isUse = activeId === row.id;
                  return (
                    <div
                      key={row.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleSelectRow(row.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleSelectRow(row.id);
                        }
                      }}
                      className={cn(
                        "relative cursor-pointer rounded-lg border px-3 py-2.5 text-left transition-colors",
                        isSel
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border/80 bg-card hover:border-primary/40 hover:bg-muted/40"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium leading-snug text-foreground">{row.title}</div>
                          <div className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{row.subtitle}</div>
                          {isUse ? (
                            <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:text-emerald-200">
                              <span aria-hidden>✓</span> 当前使用
                            </div>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                          title="复制到模版库"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDuplicateRow(row);
                          }}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </aside>

          <main className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 sm:px-5">
              <span className="text-xs font-medium text-muted-foreground sm:text-sm">
                {isQuickExam ? "双栏编辑（prompt.md / output.md）" : "模版内容（提示词 + 输出结构）"}
              </span>
              <Button
                type="button"
                size="sm"
                className="h-8 gap-1 bg-emerald-600 text-white hover:bg-emerald-600/90 dark:bg-emerald-600 dark:hover:bg-emerald-600/90"
                disabled={!sectionKey}
                onClick={() => onPersist()}
              >
                <span aria-hidden>✓</span> {isQuickExam ? "保存" : "保存为当前应用模版"}
              </Button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 sm:px-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-xs text-muted-foreground">模版名称</span>
                  <input
                    value={isBuiltinSelected ? metaTitle : isCustomSelected ? metaTitle : metaTitle}
                    onChange={(e) => {
                      if (!isCustomSelected || !customRow) return;
                      setCustomDraft({
                        name: e.target.value,
                        desc: customDraft?.desc ?? customRow.description?.trim() ?? "",
                      });
                    }}
                    readOnly={!isCustomSelected}
                    className={cn(
                      "h-9 w-full rounded-md border bg-background px-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring",
                      !isCustomSelected && "cursor-not-allowed bg-muted/50 text-muted-foreground"
                    )}
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-muted-foreground">模版描述</span>
                  <input
                    value={isBuiltinSelected ? metaDesc : isCustomSelected ? metaDesc : metaDesc}
                    onChange={(e) => {
                      if (!isCustomSelected || !customRow) return;
                      setCustomDraft({
                        name: customDraft?.name ?? customRow.name,
                        desc: e.target.value,
                      });
                    }}
                    readOnly={!isCustomSelected}
                    className={cn(
                      "h-9 w-full rounded-md border bg-background px-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring",
                      !isCustomSelected && "cursor-not-allowed bg-muted/50 text-muted-foreground"
                    )}
                  />
                </label>
              </div>

              {!isQuickExam ? (
                <div className="mt-3 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-950 dark:text-emerald-100">
                  <span className="font-medium">生效范围</span>
                  <span className="text-emerald-900/80 dark:text-emerald-100/90">
                    ：「{sectionTitle}」分部生成与修订。
                  </span>
                </div>
              ) : (
                <p className="mt-3 text-xs text-muted-foreground">
                  用于简要版快速体检报告；接口按 prompt.md、output.md 分别提交。
                </p>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                {!isQuickExam ? (
                  <span className="rounded-full bg-primary/12 px-2.5 py-0.5 text-[11px] font-medium text-primary">
                    Lexcheck · 尽调分部
                  </span>
                ) : null}
                {isCustomSelected && effectivePick ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-destructive hover:text-destructive"
                    onClick={() => handleDeleteCustom(effectivePick.slice("custom:".length))}
                  >
                    删除此模版库条目
                  </Button>
                ) : null}
              </div>

              <div className="mt-3 grid min-h-0 flex-1 gap-3 lg:grid-cols-2">
                <label className="flex min-h-0 flex-col gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    {isQuickExam ? "prompt.md（提示词）" : "补充指令（提示词）"}
                  </span>
                  <Textarea
                    value={prompt}
                    onChange={(e) => onPromptChange(e.target.value)}
                    className="min-h-[220px] flex-1 resize-y font-mono text-xs leading-relaxed sm:min-h-[260px] sm:text-sm"
                    placeholder={
                      isQuickExam
                        ? "角色、约束、引用范围等"
                        : "例如：角色、引用材料范围、禁止编造等"
                    }
                  />
                </label>
                <label className="flex min-h-0 flex-col gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    {isQuickExam ? "output.md（输出结构）" : "输出结构 / 要点"}
                  </span>
                  <Textarea
                    value={output}
                    onChange={(e) => onOutputChange(e.target.value)}
                    className="min-h-[220px] flex-1 resize-y font-mono text-xs leading-relaxed sm:min-h-[260px] sm:text-sm"
                    placeholder={
                      isQuickExam
                        ? "标题层级、章节骨架、必填要点"
                        : "例如：小标题层级、表格字段、必须覆盖的要点等"
                    }
                  />
                </label>
              </div>

              {!isQuickExam ? (
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                  保存后按 token 与段键存于本机；生成时合并注入请求。
                </p>
              ) : null}
            </div>
          </main>
        </div>

        <div className="flex shrink-0 flex-col gap-2 border-t bg-background px-4 py-3 sm:flex-row sm:items-center sm:justify-end sm:gap-3 sm:px-6">
          <div className="flex w-full flex-wrap items-center justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setPreviewOpen(true)}>
              {isQuickExam ? "预览 prompt / output" : "预览合并稿"}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={handleRestore}>
              还原
            </Button>
            {isCustomSelected ? (
              <Button type="button" variant="secondary" size="sm" onClick={handleSaveLibraryEntry}>
                保存模版库条目
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={!sectionKey}
              onClick={() => onPersist()}
            >
              {isQuickExam ? "保存" : "保存为当前应用模版"}
            </Button>
            <Dialog.Close asChild>
              <Button type="button" variant="outline" className="mt-0 sm:mt-0">
                关闭
              </Button>
            </Dialog.Close>
          </div>
        </div>

        {previewOpen ? (
          <div
            className="absolute inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
            role="presentation"
            onClick={() => setPreviewOpen(false)}
          >
            <div
              role="dialog"
              aria-modal
              className="flex max-h-[85vh] w-full max-w-4xl flex-col rounded-lg border bg-background shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b px-4 py-3">
                <span className="text-sm font-medium">
                  {isQuickExam
                    ? "预览（与接口一致：两份独立 Markdown）"
                    : "预览（合并注入用稿）"}
                </span>
                <button
                  type="button"
                  className="rounded-md p-1 text-muted-foreground hover:bg-muted"
                  aria-label="关闭预览"
                  onClick={() => setPreviewOpen(false)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                {isQuickExam ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex min-h-0 flex-col gap-1.5">
                      <div className="text-xs font-medium text-muted-foreground">prompt.md</div>
                      <pre className="max-h-[55vh] overflow-y-auto whitespace-pre-wrap break-words rounded-md border bg-muted/20 p-3 font-mono text-[11px] leading-relaxed sm:text-xs">
                        {prompt.trim() || "（空）"}
                      </pre>
                    </div>
                    <div className="flex min-h-0 flex-col gap-1.5">
                      <div className="text-xs font-medium text-muted-foreground">output.md</div>
                      <pre className="max-h-[55vh] overflow-y-auto whitespace-pre-wrap break-words rounded-md border bg-muted/20 p-3 font-mono text-[11px] leading-relaxed sm:text-xs">
                        {output.trim() || "（空）"}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed sm:text-sm">
                    {[
                      output.trim() ? `【输出结构/要点】\n${output.trim()}` : "",
                      prompt.trim() ? `【补充指令】\n${prompt.trim()}` : "",
                    ]
                      .filter(Boolean)
                      .join("\n\n") || "（当前两栏均为空）"}
                  </pre>
                )}
              </div>
            </div>
          </div>
        ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
