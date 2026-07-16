"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  Answers,
  QuestionnaireConfig,
  QuestionnaireQuestion,
} from "@/lib/questionnaire-types";
import { saveDraft } from "@/lib/local-draft";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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

/** 门槛题触发跳过时，对应子题不隐藏，但变为非必填（不计入进度、不显示"未填"标记）。 */
function computeSkippedQids(config: QuestionnaireConfig, answers: Answers): Set<string> {
  const skipped = new Set<string>();
  for (const section of config.sections) {
    for (const q of section.questions) {
      if (q.type !== "single_choice" || !q.skipGate) continue;
      const a = answers[q.qid];
      if (a?.kind === "single_choice" && a.value === q.skipGate.triggerValue) {
        for (const sq of q.skipGate.skipQids) skipped.add(sq);
      }
    }
  }
  return skipped;
}

export function QuestionnaireClient({
  token,
  defaultCompanyName = "",
  defaultContactName = "",
  defaultContactPhone = "",
}: {
  token: string;
  /** 客户账号资料里的公司名/姓名/电话，问卷草稿对应字段为空时用作默认值 */
  defaultCompanyName?: string;
  defaultContactName?: string;
  defaultContactPhone?: string;
}) {
  const [config, setConfig] = useState<QuestionnaireConfig | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
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
      const draftRes = await fetch(`/api/checkups/${token}`, { cache: "no-store" });
      if (!draftRes.ok) throw new Error("server unavailable");
      const draft = (await draftRes.json()) as {
        companyName?: string;
        contactName?: string;
        contactPhone?: string;
        answers?: Answers;
        savedAt?: string | null;
        submittedAt?: string | null;
        config?: QuestionnaireConfig | null;
        storageMode?: string;
      };
      if (cancelled) return;
      if (!draft.config) {
        setSaveState({ kind: "error", message: "找不到该问卷对应的模板，请返回问卷列表重新进入" });
        return;
      }
      setConfig(draft.config);
      setSaveMode(draft.storageMode === "local-fallback" ? "local" : "server");

      const initialAnswers: Answers = {};
      for (const section of draft.config.sections) {
        for (const q of section.questions) {
          initialAnswers[q.qid] = draft?.answers?.[q.qid] ?? defaultAnswerFor(q);
        }
      }
      setCompanyName(draft.companyName || defaultCompanyName);
      setContactName(draft.contactName || defaultContactName);
      setContactPhone(draft.contactPhone || defaultContactPhone);
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
  }, [token, defaultCompanyName, defaultContactName, defaultContactPhone]);

  const skippedQids = useMemo(
    () => (config ? computeSkippedQids(config, answers) : new Set<string>()),
    [config, answers]
  );

  const computed = useMemo(() => {
    if (!config) return null;
    const countableQuestions = (s: QuestionnaireConfig["sections"][number]) =>
      s.questions.filter((q) => !skippedQids.has(q.qid));
    const total = config.sections.reduce((acc, s) => acc + countableQuestions(s).length, 0);
    const answered = config.sections.reduce(
      (acc, s) =>
        acc + countableQuestions(s).filter((q) => isAnswered(q, answers[q.qid])).length,
      0
    );
    const percent = total === 0 ? 0 : Math.round((answered / total) * 100);
    const perSection = config.sections.map((s) => {
      const questions = countableQuestions(s);
      const t = questions.length;
      const a = questions.filter((q) => isAnswered(q, answers[q.qid])).length;
      return {
        sectionId: s.sectionId,
        title: s.title,
        total: t,
        answered: a,
        percent: t === 0 ? 0 : Math.round((a / t) * 100),
      };
    });
    return { total, answered, percent, perSection };
  }, [answers, config, skippedQids]);

  async function saveToServer(
    nextCompanyName: string,
    nextContactName: string,
    nextContactPhone: string,
    nextAnswers: Answers
  ) {
    const res = await fetch(`/api/checkups/${token}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyName: nextCompanyName,
        contactName: nextContactName,
        contactPhone: nextContactPhone,
        answers: nextAnswers,
      }),
    });
    if (!res.ok) throw new Error("保存失败");
    const data = (await res.json()) as { savedAt: string };
    return new Date(data.savedAt);
  }

  async function saveHybrid(
    nextCompanyName: string,
    nextContactName: string,
    nextContactPhone: string,
    nextAnswers: Answers
  ) {
    if (saveMode === "local" && config) {
      const now = new Date();
      saveDraft(config, token, {
        companyName: nextCompanyName,
        contactName: nextContactName,
        contactPhone: nextContactPhone,
        answers: nextAnswers,
        savedAt: now.toISOString(),
        submittedAt: submittedAt ? submittedAt.toISOString() : undefined,
      });
      return now;
    }
    try {
      const now = await saveToServer(nextCompanyName, nextContactName, nextContactPhone, nextAnswers);
      setSaveMode("server");
      return now;
    } catch {
      if (!config) throw new Error("save failed");
      const now = new Date();
      saveDraft(config, token, {
        companyName: nextCompanyName,
        contactName: nextContactName,
        contactPhone: nextContactPhone,
        answers: nextAnswers,
        savedAt: now.toISOString(),
        submittedAt: submittedAt ? submittedAt.toISOString() : undefined,
      });
      setSaveMode("local");
      return now;
    }
  }

  function scheduleSave(
    nextCompanyName: string,
    nextContactName: string,
    nextContactPhone: string,
    nextAnswers: Answers
  ) {
    if (debounceTimer.current) window.clearTimeout(debounceTimer.current);
    setSaveState({ kind: "saving" });
    debounceTimer.current = window.setTimeout(async () => {
      try {
        const now = await saveHybrid(nextCompanyName, nextContactName, nextContactPhone, nextAnswers);
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
      scheduleSave(companyName, contactName, contactPhone, next);
      return next;
    });
  }

  function onCompanyNameChange(value: string) {
    if (submittedAt) return;
    setCompanyName(value);
    scheduleSave(value, contactName, contactPhone, answers);
  }

  function onContactNameChange(value: string) {
    if (submittedAt) return;
    setContactName(value);
    scheduleSave(companyName, value, contactPhone, answers);
  }

  function onContactPhoneChange(value: string) {
    if (submittedAt) return;
    setContactPhone(value);
    scheduleSave(companyName, contactName, value, answers);
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
    scheduleSave(companyName, contactName, contactPhone, next);
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
  function scrollToSection(sectionId: string) {
    const target = document.getElementById(`section-${sectionId}`);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    setMobileProgressOpen(false);
  }

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
                <button
                  key={s.sectionId}
                  type="button"
                  onClick={() => scrollToSection(s.sectionId)}
                  className="w-full rounded-md px-2 py-1 text-left hover:bg-muted/40"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="truncate text-muted-foreground">{s.title}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {s.answered}/{s.total}
                    </span>
                  </div>
                  <Progress className="mt-1 h-1" value={s.percent} />
                </button>
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
            <div className="mt-3 grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-muted-foreground">联系人</label>
                <input
                  type="text"
                  value={contactName}
                  onChange={(e) => onContactNameChange(e.target.value)}
                  disabled={readonly}
                  placeholder="请输入联系人姓名"
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-muted-foreground">电话号码</label>
                <input
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => onContactPhoneChange(e.target.value)}
                  disabled={readonly}
                  placeholder="请输入联系电话"
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
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

        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_18rem]">
          <div className="space-y-6">
            {config.sections.map((section) => {
              return (
              <Card
                key={section.sectionId}
                id={`section-${section.sectionId}`}
                className="scroll-mt-28 p-5 lg:scroll-mt-20"
              >
                <div className="text-base font-semibold leading-6 tracking-tight">
                  {section.title}
                </div>
                <Separator className="my-2" />
                <div className="space-y-6">
                  {section.questions.map((q) => {
                    const currentAnswer = answers[q.qid];
                    const skipped = skippedQids.has(q.qid);
                    return (
                      <div key={q.qid} className="space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="text-base font-medium leading-7">
                            <span className="mr-2 text-muted-foreground">{q.qid}</span>
                            {q.question}
                            {skipped && (
                              <span className="ml-2 text-xs font-normal text-muted-foreground">
                                （前置题已跳转，可不填）
                              </span>
                            )}
                          </div>
                          {!skipped && !isAnswered(q, currentAnswer) && (
                            <Badge variant="outline">未填</Badge>
                          )}
                        </div>

                        {q.type === "single_choice" && currentAnswer?.kind === "single_choice" && (
                          <div className="grid grid-cols-2 gap-2">
                            {q.options.map((opt) => {
                              const checked = currentAnswer.value === opt.value;
                              return (
                                <button
                                  key={opt.value}
                                  type="button"
                                  disabled={readonly}
                                  onClick={() =>
                                    setAnswer(q.qid, {
                                      kind: "single_choice",
                                      value: checked ? null : opt.value,
                                    })
                                  }
                                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                                    checked
                                      ? "border-primary/40 bg-gradient-to-br from-primary/15 to-primary/5 shadow-sm"
                                      : "hover:bg-muted/30"
                                  }`}
                                >
                                  <span
                                    className={`size-4 rounded-full border ${
                                      checked
                                        ? "border-primary bg-primary"
                                        : "border-muted-foreground/60"
                                    }`}
                                    aria-hidden
                                  />
                                  <span className={`select-none ${checked ? "font-medium text-foreground" : ""}`}>
                                    {opt.label}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
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
                              <div className="grid grid-cols-2 gap-2">
                                {q.options.map((opt) => {
                                  const checked = currentAnswer.values.includes(opt.value);
                                  return (
                                    <label
                                      key={opt.value}
                                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                                        checked
                                          ? "border-primary/40 bg-gradient-to-br from-primary/15 to-primary/5 shadow-sm"
                                          : "hover:bg-muted/30"
                                      }`}
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
                                      <span className={`select-none ${checked ? "font-medium text-foreground" : ""}`}>
                                        {opt.label}
                                      </span>
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
              );
            })}
          </div>

          <div className="space-y-4 lg:sticky lg:top-16 lg:self-start">
            <Card className="hidden p-4 lg:block">
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
                  <button
                    key={s.sectionId}
                    type="button"
                    onClick={() => scrollToSection(s.sectionId)}
                    className="w-full rounded-md p-2 text-left hover:bg-muted/40"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{s.title}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {s.answered}/{s.total}
                      </span>
                    </div>
                    <Progress className="mt-2" value={s.percent} />
                  </button>
                ))}
              </div>
            </Card>
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
                      const now = await saveHybrid(companyName, contactName, contactPhone, answers);
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
                      const normalizedContactName = contactName.trim();
                      const normalizedContactPhone = contactPhone.trim();
                      if (!normalizedCompanyName) {
                        setSaveState({ kind: "error", message: "提交前请先填写公司名称" });
                        return;
                      }
                      setSaveState({ kind: "saving" });
                      if (saveMode === "local" && config) {
                        const now = new Date();
                        saveDraft(config, token, {
                          companyName: normalizedCompanyName,
                          contactName: normalizedContactName,
                          contactPhone: normalizedContactPhone,
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
                          body: JSON.stringify({
                            companyName: normalizedCompanyName,
                            contactName: normalizedContactName,
                            contactPhone: normalizedContactPhone,
                            answers,
                          }),
                        });
                        if (!res.ok) {
                          if (!config) throw new Error("submit failed");
                          const now = new Date();
                          saveDraft(config, token, {
                            companyName: normalizedCompanyName,
                            contactName: normalizedContactName,
                            contactPhone: normalizedContactPhone,
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

