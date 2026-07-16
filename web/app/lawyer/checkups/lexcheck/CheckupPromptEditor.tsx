"use client";

import { useMemo, useState } from "react";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const CUSTOM_LS = "lexcheck:checkup-report:saved-prompts:v1";

type SavedPrompt = {
  id: string;
  name: string;
  sectionKey: string;
  text: string;
  updatedAt: number;
};

function loadSaved(): SavedPrompt[] {
  if (typeof window === "undefined") return [];
  try {
    const j = localStorage.getItem(CUSTOM_LS);
    if (!j) return [];
    const arr = JSON.parse(j) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (x): x is SavedPrompt =>
        Boolean(x) &&
        typeof (x as SavedPrompt).id === "string" &&
        typeof (x as SavedPrompt).sectionKey === "string" &&
        typeof (x as SavedPrompt).name === "string" &&
        typeof (x as SavedPrompt).text === "string"
    );
  } catch {
    return [];
  }
}

function saveSaved(list: SavedPrompt[]) {
  localStorage.setItem(CUSTOM_LS, JSON.stringify(list));
}

function newId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `t_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function promptStorageKey(token: string, sectionKey: string) {
  return `lexcheck:dd-segment:${token}:${sectionKey}:prompt`;
}

function versionStorageKey(token: string, sectionKey: string) {
  return `lexcheck:dd-segment:${token}:${sectionKey}:version`;
}

function readPersisted(token: string, sectionKey: string): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(promptStorageKey(token, sectionKey)) ?? "";
}

type ListRow = { id: string; title: string; text: string };

/**
 * "AI配置"页单栏内容编辑器：内置默认（只读）+ 律师自建模版（可编辑）。
 * `guardrail` 非空时在编辑区上方固定展示不可修改的护栏文本（无护栏的场景，如免责声明，传空字符串即可不显示）。
 * 调用方需以 `key={token}` 渲染，切换问卷时整体重挂载以重新读取该 token 下的已启用内容。
 */
export function CheckupPromptEditor({
  token,
  sectionKey,
  guardrail,
  defaultText,
  version,
  contentLabel = "提示词内容",
  placeholder = "语气、结构、分段等与生成效果相关的说明",
}: {
  token: string;
  sectionKey: string;
  guardrail: string;
  defaultText: string;
  version: string;
  contentLabel?: string;
  placeholder?: string;
}) {
  const [savedList, setSavedList] = useState<SavedPrompt[]>(() => loadSaved());
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState<string | null>(null);

  const [text, setText] = useState(() => {
    if (typeof window === "undefined") return "";
    const vk = versionStorageKey(token, sectionKey);
    const pk = promptStorageKey(token, sectionKey);
    const storedVersion = localStorage.getItem(vk) ?? "";
    const alreadySeeded = storedVersion === version && (localStorage.getItem(pk) ?? "").trim() !== "";
    if (!alreadySeeded) {
      localStorage.setItem(pk, defaultText);
      localStorage.setItem(vk, version);
      return defaultText;
    }
    return localStorage.getItem(pk) ?? "";
  });

  const persisted = useMemo(() => readPersisted(token, sectionKey), [token, sectionKey]);

  const allRows = useMemo((): ListRow[] => {
    const rows: ListRow[] = [{ id: "builtin:default", title: "内置默认", text: defaultText.trim() }];
    for (const s of savedList) {
      if (s.sectionKey !== sectionKey) continue;
      rows.push({ id: `custom:${s.id}`, title: s.name, text: s.text });
    }
    return rows;
  }, [savedList, sectionKey, defaultText]);

  const activeId = useMemo(() => {
    const pt = persisted.trim();
    if (!pt) return null;
    if (pt === defaultText.trim()) return "builtin:default";
    const row = savedList.find((s) => s.sectionKey === sectionKey && s.text.trim() === pt);
    return row ? `custom:${row.id}` : null;
  }, [persisted, defaultText, savedList, sectionKey]);

  const autoPickId = activeId ?? allRows[0]?.id ?? null;
  const effectivePick = pickedId && allRows.some((r) => r.id === pickedId) ? pickedId : autoPickId;

  const customRow = useMemo(() => {
    if (!effectivePick?.startsWith("custom:")) return null;
    const sid = effectivePick.slice("custom:".length);
    return savedList.find((s) => s.id === sid) ?? null;
  }, [effectivePick, savedList]);

  const isBuiltinSelected = effectivePick === "builtin:default";
  const isCustomSelected = Boolean(effectivePick?.startsWith("custom:"));
  const nameValue = isCustomSelected ? (nameDraft ?? customRow?.name ?? "") : "内置默认";

  function handleSelectRow(row: ListRow) {
    setPickedId(row.id);
    setNameDraft(row.id.startsWith("custom:") ? (savedList.find((s) => `custom:${s.id}` === row.id)?.name ?? "") : null);
    setText(row.text);
  }

  function handleDuplicate(row: ListRow) {
    const id = newId();
    const name = `副本 · ${row.title}`.slice(0, 80);
    setSavedList((prev) => {
      const next: SavedPrompt[] = [{ id, name, sectionKey, text: row.text, updatedAt: Date.now() }, ...prev];
      saveSaved(next);
      return next;
    });
    setPickedId(`custom:${id}`);
    setNameDraft(name);
    setText(row.text);
  }

  function persistCustomName(name: string) {
    if (!customRow) return;
    setSavedList((prev) => {
      const next = prev.map((s) => (s.id === customRow.id ? { ...s, name } : s));
      saveSaved(next);
      return next;
    });
  }

  function handleSaveLibraryEntry() {
    if (!customRow) return;
    const name = (nameDraft ?? customRow.name).trim() || "未命名模版";
    setSavedList((prev) => {
      const next = prev.map((s) => (s.id === customRow.id ? { ...s, name, text, updatedAt: Date.now() } : s));
      saveSaved(next);
      return next;
    });
    setNameDraft(name);
  }

  function handleEnable() {
    localStorage.setItem(promptStorageKey(token, sectionKey), text);
  }

  function confirmDelete() {
    if (!customRow) return;
    if (!window.confirm(`确认删除模版「${customRow.name}」？此操作不可撤销。`)) return;
    const id = customRow.id;
    setSavedList((prev) => {
      const next = prev.filter((s) => s.id !== id);
      saveSaved(next);
      return next;
    });
    if (effectivePick === `custom:${id}`) {
      handleSelectRow(allRows.find((r) => r.id === "builtin:default")!);
    }
  }

  const dirty = text.trim() !== persisted.trim();

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-lg border bg-background">
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside className="flex min-h-0 w-full shrink-0 flex-col border-b lg:w-[min(30%,280px)] lg:border-b-0 lg:border-r">
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-3 py-3 sm:px-4">
            {allRows.map((row) => {
              const isSel = effectivePick === row.id;
              const isUse = activeId === row.id;
              return (
                <div
                  key={row.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSelectRow(row)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleSelectRow(row);
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
                      {isUse ? (
                        <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:text-emerald-200">
                          <span aria-hidden>✓</span> 已启用
                        </div>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      title="复制为可编辑模版"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDuplicate(row);
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 sm:px-5">
            {guardrail ? (
              <div className="rounded-md border border-border/80 bg-muted/30 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground">系统固定要求（不可修改）：</span>
                <div className="mt-1 whitespace-pre-wrap">{guardrail}</div>
              </div>
            ) : null}

            <label className={cn("space-y-1", guardrail && "mt-3")}>
              <span className="text-xs text-muted-foreground">模版名称</span>
              <input
                value={nameValue}
                onChange={(e) => {
                  if (!isCustomSelected) return;
                  setNameDraft(e.target.value);
                  persistCustomName(e.target.value);
                }}
                readOnly={!isCustomSelected}
                className={cn(
                  "h-9 w-full rounded-md border bg-background px-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring",
                  !isCustomSelected && "cursor-not-allowed bg-muted/50 text-muted-foreground"
                )}
              />
            </label>

            <label className="mt-3 flex min-h-0 flex-1 flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                {contentLabel}{isBuiltinSelected ? "（内置，只读）" : ""}
              </span>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                readOnly={isBuiltinSelected}
                className={cn(
                  "min-h-[360px] flex-1 resize-y text-sm leading-relaxed",
                  isBuiltinSelected && "cursor-not-allowed bg-muted/30"
                )}
                placeholder={placeholder}
              />
            </label>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t bg-background px-4 py-3 sm:px-5">
            <div>
              {isCustomSelected ? (
                <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={confirmDelete}>
                  删除
                </Button>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {isCustomSelected ? (
                <Button type="button" variant="outline" size="sm" onClick={handleSaveLibraryEntry}>
                  保存
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                className={cn(
                  "bg-primary text-primary-foreground hover:bg-primary/90",
                  !dirty && "opacity-60"
                )}
                onClick={handleEnable}
              >
                启用
              </Button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
