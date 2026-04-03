"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  Answers,
  QuestionnaireConfig,
  QuestionnaireQuestion,
} from "@/lib/questionnaire-types";
import { loadDraft, saveDraft } from "@/lib/local-draft";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, ChevronUp } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; at: Date }
  | { kind: "error"; message: string };

function defaultAnswerFor(q: QuestionnaireQuestion): Answers[string] {
  switch (q.type) {
    case "single_choice":
      return { kind: "single_choice", value: null };
    case "textarea":
      return { kind: "textarea", value: "" };
    case "multi_choice_with_other":
      return { kind: "multi_choice_with_other", values: [], otherText: "" };
  }
}

function isAnswered(q: QuestionnaireQuestion, a: Answers[string] | undefined) {
  if (!a) return false;
  if (q.type === "single_choice" && a.kind === "single_choice") return !!a.value;
  if (q.type === "textarea" && a.kind === "textarea")
    return a.value.trim().length > 0;
  if (
    q.type === "multi_choice_with_other" &&
    a.kind === "multi_choice_with_other"
  ) {
    return a.values.length > 0 || (a.otherText ?? "").trim().length > 0;
  }
  return false;
}

export function QuestionnaireClient({ token }: { token: string }) {
  const [config, setConfig] = useState<QuestionnaireConfig | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [answers, setAnswers] = useState<Answers>({});
  const [saveState, setSaveState] = useState<SaveState>({ kind: "idle" });
  const [submittedAt, setSubmittedAt] = useState<Date | null>(null);
  const [saveMode, setSaveMode] = useState<"server" | "local">("server");
  const [mobileProgressOpen, setMobileProgressOpen] = useState(false);
  const [autofillOpen, setAutofillOpen] = useState(false);
  const debounceTimer = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/questionnaire.json", { cache: "no-store" });
      const json = (await res.json()) as QuestionnaireConfig;
      if (cancelled) return;
      setConfig(json);

      let draft: {
        companyName?: string;
        answers?: Answers;
        savedAt?: string | null;
        submittedAt?: string | null;
      } = {};

      try {
        const draftRes = await fetch(`/api/checkups/${token}`, { cache: "no-store" });
        if (!draftRes.ok) throw new Error("server unavailable");
        draft = (await draftRes.json()) as {
          companyName?: string;
          answers?: Answers;
          savedAt?: string | null;
          submittedAt?: string | null;
        };
        setSaveMode("server");
      } catch {
        const local = loadDraft(json, token);
        draft = {
          companyName: local?.companyName ?? "",
          answers: local?.answers,
          savedAt: local?.savedAt ?? null,
          submittedAt: local?.submittedAt ?? null,
        };
        setSaveMode("local");
      }

      const initialAnswers: Answers = {};
      for (const section of json.sections) {
        for (const q of section.questions) {
          initialAnswers[q.qid] = draft?.answers?.[q.qid] ?? defaultAnswerFor(q);
        }
      }
      setCompanyName(draft.companyName ?? "");
      setAnswers(initialAnswers);
      setSubmittedAt(draft?.submittedAt ? new Date(draft.submittedAt) : null);
      if (draft?.savedAt) {
        setSaveState({ kind: "saved", at: new Date(draft.savedAt) });
      }
    })().catch((e) => {
      console.error(e);
      setSaveState({ kind: "error", message: "加载问卷失败" });
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const computed = useMemo(() => {
    if (!config) return null;
    const total = config.sections.reduce((acc, s) => acc + s.questions.length, 0);
    const answered = config.sections.reduce(
      (acc, s) =>
        acc + s.questions.filter((q) => isAnswered(q, answers[q.qid])).length,
      0
    );
    const percent = total === 0 ? 0 : Math.round((answered / total) * 100);
    const perSection = config.sections.map((s) => {
      const t = s.questions.length;
      const a = s.questions.filter((q) => isAnswered(q, answers[q.qid])).length;
      return {
        sectionId: s.sectionId,
        title: s.title,
        total: t,
        answered: a,
        percent: t === 0 ? 0 : Math.round((a / t) * 100),
      };
    });
    return { total, answered, percent, perSection };
  }, [answers, config]);

  async function saveToServer(nextCompanyName: string, nextAnswers: Answers) {
    const res = await fetch(`/api/checkups/${token}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyName: nextCompanyName, answers: nextAnswers }),
    });
    if (!res.ok) throw new Error("保存失败");
    const data = (await res.json()) as { savedAt: string };
    return new Date(data.savedAt);
  }

  async function saveHybrid(nextCompanyName: string, nextAnswers: Answers) {
    if (saveMode === "local" && config) {
      const now = new Date();
      saveDraft(config, token, {
        companyName: nextCompanyName,
        answers: nextAnswers,
        savedAt: now.toISOString(),
        submittedAt: submittedAt ? submittedAt.toISOString() : undefined,
      });
      return now;
    }
    try {
      const now = await saveToServer(nextCompanyName, nextAnswers);
      setSaveMode("server");
      return now;
    } catch {
      if (!config) throw new Error("save failed");
      const now = new Date();
      saveDraft(config, token, {
        companyName: nextCompanyName,
        answers: nextAnswers,
        savedAt: now.toISOString(),
        submittedAt: submittedAt ? submittedAt.toISOString() : undefined,
      });
      setSaveMode("local");
      return now;
    }
  }

  function scheduleSave(nextCompanyName: string, nextAnswers: Answers) {
    if (debounceTimer.current) window.clearTimeout(debounceTimer.current);
    setSaveState({ kind: "saving" });
    debounceTimer.current = window.setTimeout(async () => {
      try {
        const now = await saveHybrid(nextCompanyName, nextAnswers);
        setSaveState({ kind: "saved", at: now });
      } catch (e) {
        console.error(e);
        setSaveState({ kind: "error", message: "保存失败" });
      }
    }, 900);
  }

  function setAnswer(qid: string, value: Answers[string]) {
    if (submittedAt) return;
    setAnswers((prev) => {
      const next = { ...prev, [qid]: value };
      scheduleSave(companyName, next);
      return next;
    });
  }

  function onCompanyNameChange(value: string) {
    if (submittedAt) return;
    setCompanyName(value);
    scheduleSave(value, answers);
  }

  function fillFirstUnansweredChoices(base: Answers): Answers {
    if (!config) return base;
    const next = { ...base };
    for (const section of config.sections) {
      for (const q of section.questions) {
        if (isAnswered(q, next[q.qid])) continue;
        if (q.type === "single_choice") {
          const first = q.options[0]?.value;
          if (first) next[q.qid] = { kind: "single_choice", value: first };
        } else if (q.type === "multi_choice_with_other") {
          const first = q.options[0]?.value;
          if (first) {
            next[q.qid] = {
              kind: "multi_choice_with_other",
              values: [first],
              otherText: "",
            };
          }
        }
      }
    }
    return next;
  }

  function applyAutofillFirstOptions() {
    const next = fillFirstUnansweredChoices(answers);
    setAnswers(next);
    scheduleSave(companyName, next);
    setAutofillOpen(false);
  }

  if (!config || !computed) {
    return (
      <main className="min-h-dvh bg-background">
        <div className="mx-auto w-full max-w-6xl px-6 py-10">
          <div className="text-sm text-muted-foreground">客户问卷</div>
          <div className="mt-4 text-sm text-muted-foreground">加载中…</div>
        </div>
      </main>
    );
  }

  const readonly = !!submittedAt;

  return (
    <main className="min-h-dvh bg-background">
      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        <div className="sticky top-14 z-40 -mx-6 border-b bg-background/95 px-6 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:hidden">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 text-left"
            onClick={() => setMobileProgressOpen((o) => !o)}
            aria-expanded={mobileProgressOpen}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>填写进度</span>
                <span className="tabular-nums">
                  {computed.answered}/{computed.total} · {computed.percent}%
                </span>
              </div>
              <Progress className="mt-1.5 h-1.5" value={computed.percent} />
            </div>
            {mobileProgressOpen ? (
              <ChevronUp className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            ) : (
              <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            )}
          </button>
          {mobileProgressOpen && (
            <div className="mt-3 max-h-48 space-y-2 overflow-y-auto border-t pt-3">
              {computed.perSection.map((s) => (
                <div key={s.sectionId}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="truncate text-muted-foreground">{s.title}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {s.answered}/{s.total}
                    </span>
                  </div>
                  <Progress className="mt-1 h-1" value={s.percent} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="text-sm text-muted-foreground">客户问卷</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              {config.title}
            </h1>
            <div className="mt-3 max-w-xl">
              <label className="mb-1 block text-sm text-muted-foreground">公司名称</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => onCompanyNameChange(e.target.value)}
                disabled={readonly}
                placeholder="请输入公司全称"
                className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>
                进度 {computed.answered}/{computed.total}
              </span>
              <span className="text-muted-foreground/50">·</span>
              {saveState.kind === "saving" && <span>保存中…</span>}
              {saveState.kind === "saved" && (
                <span>已保存 {saveState.at.toLocaleString()}</span>
              )}
              {saveState.kind === "error" && (
                <span className="text-destructive">{saveState.message}</span>
              )}
              {readonly && (
                <>
                  <span className="text-muted-foreground/50">·</span>
                  <Badge variant="secondary">已提交（只读）</Badge>
                </>
              )}
            </div>
          </div>

          <div className="hidden w-72 shrink-0 lg:block lg:sticky lg:top-16 lg:self-start">
            <Card className="p-4">
              <div className="text-sm font-medium">填写进度</div>
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>总体</span>
                  <span>{computed.percent}%</span>
                </div>
                <Progress className="mt-2" value={computed.percent} />
              </div>
              <Separator className="my-4" />
              <div className="space-y-3">
                {computed.perSection.map((s) => (
                  <div key={s.sectionId}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{s.title}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {s.answered}/{s.total}
                      </span>
                    </div>
                    <Progress className="mt-2" value={s.percent} />
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_18rem]">
          <div className="space-y-6">
            {config.sections.map((section) => (
              <Card key={section.sectionId} className="p-6">
                <div className="text-lg font-semibold tracking-tight">
                  {section.title}
                </div>
                <Separator className="my-4" />
                <div className="space-y-6">
                  {section.questions.map((q) => {
                    const currentAnswer = answers[q.qid];
                    return (
                      <div key={q.qid} className="space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="text-sm font-medium leading-6">
                            <span className="mr-2 text-muted-foreground">{q.qid}</span>
                            {q.question}
                          </div>
                          {isAnswered(q, currentAnswer) ? (
                            <Badge variant="secondary">已填</Badge>
                          ) : (
                            <Badge variant="outline">未填</Badge>
                          )}
                        </div>

                        {q.type === "single_choice" && currentAnswer?.kind === "single_choice" && (
                            <RadioGroup
                              value={currentAnswer.value ?? ""}
                              onValueChange={(v) =>
                                setAnswer(q.qid, { kind: "single_choice", value: v })
                              }
                              className="grid gap-2"
                            >
                              {q.options.map((opt) => (
                                <label
                                  key={opt.value}
                                  className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted/30"
                                >
                                  <RadioGroupItem value={opt.value} disabled={readonly} />
                                  <span className="select-none">{opt.label}</span>
                                </label>
                              ))}
                            </RadioGroup>
                          )}

                        {q.type === "textarea" && currentAnswer?.kind === "textarea" && (
                          <Textarea
                            value={currentAnswer.value}
                            onChange={(e) =>
                              setAnswer(q.qid, {
                                kind: "textarea",
                                value: e.target.value,
                              })
                            }
                            placeholder={q.placeholder ?? ""}
                            disabled={readonly}
                            className="min-h-24"
                          />
                        )}

                        {q.type === "multi_choice_with_other" &&
                          currentAnswer?.kind === "multi_choice_with_other" && (
                            <div className="space-y-3">
                              <div className="grid gap-2">
                                {q.options.map((opt) => {
                                  const checked = currentAnswer.values.includes(opt.value);
                                  return (
                                    <label
                                      key={opt.value}
                                      className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted/30"
                                    >
                                      <Checkbox
                                        checked={checked}
                                        disabled={readonly}
                                        onCheckedChange={(next) => {
                                          const values = new Set(currentAnswer.values);
                                          if (next) values.add(opt.value);
                                          else values.delete(opt.value);
                                          setAnswer(q.qid, {
                                            kind: "multi_choice_with_other",
                                            values: Array.from(values),
                                            otherText: currentAnswer.otherText ?? "",
                                          });
                                        }}
                                      />
                                      <span className="select-none">{opt.label}</span>
                                    </label>
                                  );
                                })}
                              </div>
                              {q.other?.enabled && (
                                <Textarea
                                  value={currentAnswer.otherText ?? ""}
                                  onChange={(e) =>
                                    setAnswer(q.qid, {
                                      kind: "multi_choice_with_other",
                                      values: currentAnswer.values,
                                      otherText: e.target.value,
                                    })
                                  }
                                  placeholder={q.other.placeholder ?? "其他"}
                                  disabled={readonly}
                                  className="min-h-20"
                                />
                              )}
                            </div>
                          )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            ))}
          </div>

          <div className="lg:sticky lg:top-16 lg:self-start">
            <Card className="p-4">
              <div className="text-sm font-medium">操作</div>
              <div className="mt-3 space-y-2">
                <Button
                  className="w-full"
                  variant="outline"
                  disabled={readonly}
                  onClick={() => setAutofillOpen(true)}
                >
                  测试：一键选首项
                </Button>
                <Button
                  className="w-full"
                  variant="secondary"
                  disabled={readonly}
                  onClick={async () => {
                    try {
                      setSaveState({ kind: "saving" });
                      const now = await saveHybrid(companyName, answers);
                      setSaveState({ kind: "saved", at: now });
                    } catch (e) {
                      console.error(e);
                      setSaveState({ kind: "error", message: "暂存失败" });
                    }
                  }}
                >
                  暂存
                </Button>
                <Button
                  className="w-full"
                  disabled={readonly}
                  onClick={async () => {
                    try {
                      const normalizedCompanyName = companyName.trim();
                      if (!normalizedCompanyName) {
                        setSaveState({ kind: "error", message: "提交前请先填写公司名称" });
                        return;
                      }
                      setSaveState({ kind: "saving" });
                      if (saveMode === "local" && config) {
                        const now = new Date();
                        saveDraft(config, token, {
                          companyName: normalizedCompanyName,
                          answers,
                          savedAt: now.toISOString(),
                          submittedAt: now.toISOString(),
                        });
                        setSubmittedAt(now);
                        setSaveState({ kind: "saved", at: now });
                      } else {
                        const res = await fetch(`/api/checkups/${token}/submit`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ companyName: normalizedCompanyName, answers }),
                        });
                        if (!res.ok) {
                          if (!config) throw new Error("submit failed");
                          const now = new Date();
                          saveDraft(config, token, {
                            companyName: normalizedCompanyName,
                            answers,
                            savedAt: now.toISOString(),
                            submittedAt: now.toISOString(),
                          });
                          setSaveMode("local");
                          setSubmittedAt(now);
                          setSaveState({ kind: "saved", at: now });
                        } else {
                          const data = (await res.json()) as {
                            submittedAt: string;
                            savedAt: string;
                          };
                          setSubmittedAt(new Date(data.submittedAt));
                          setSaveState({ kind: "saved", at: new Date(data.savedAt) });
                        }
                      }
                    } catch (e) {
                      console.error(e);
                      setSaveState({ kind: "error", message: "提交失败" });
                    }
                  }}
                >
                  提交
                </Button>
                {readonly && submittedAt && (
                  <div className="pt-2 text-xs text-muted-foreground">
                    提交时间：{submittedAt.toLocaleString()}
                  </div>
                )}
              </div>
              <Separator className="my-4" />
              <div className="text-xs text-muted-foreground">
                当前保存模式：{saveMode === "server" ? "服务端数据库" : "本地浏览器"}。
              </div>
            </Card>
          </div>
        </div>

        <AlertDialog open={autofillOpen} onOpenChange={setAutofillOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>一键选择每题首项？</AlertDialogTitle>
              <AlertDialogDescription>
                将为所有<strong>未填写</strong>的单选、多选题自动选择第一个选项；简答题不会自动填写。
                正式环境请谨慎使用，避免产生不真实数据。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction type="button" onClick={applyAutofillFirstOptions}>
                确认
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </main>
  );
}

