"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CHECKUP_REPORT_CONCAT_SECTION_KEY,
  CHECKUP_REPORT_FUSION_SECTION_KEY,
  CHECKUP_REPORT_ADVANCED_SECTION_KEY,
  CHECKUP_REPORT_THIRDPARTY_SECTION_KEY,
  CHECKUP_REPORT_DISCLAIMER_SECTION_KEY,
  CHECKUP_REPORT_PROMPT_DEFAULTS,
  CHECKUP_REPORT_PROMPT_VERSION,
} from "@/lib/dd-segment-default-templates";
import { DEFAULT_PRIORITY_THRESHOLDS, PRIORITY_THRESHOLDS_STORAGE_KEY } from "@/lib/checkup-report-assemble";
import type { Answers, QuestionnaireSection } from "@/lib/questionnaire-types";
import { QuestionnaireCompactText } from "./QuestionnaireCompactText";
import { CheckupReportHistoryPanel } from "./CheckupReportHistoryPanel";
import { downloadQuickExamDocx } from "./export-quick-exam-report";
import { QuickExamReportMarkdown } from "./QuickExamReportMarkdown";
import { ThirdPartyReportBox } from "./ThirdPartyReportBox";

function checkupReportStorageKey(t: string) {
  return `lexcheck:checkup-report:text:v1:${t}`;
}

function checkupPromptStorageKey(token: string, sectionKey: string) {
  return `lexcheck:dd-segment:${token}:${sectionKey}:prompt`;
}

function checkupPromptVersionStorageKey(token: string, sectionKey: string) {
  return `lexcheck:dd-segment:${token}:${sectionKey}:version`;
}

/** 读取律师在"AI配置"页面为该模式启用的效果文案；从未打开过该标签页时，用内置默认兜底并顺手写入本地存储。 */
function readOrSeedCheckupPrompt(token: string, sectionKey: string): string {
  if (typeof window === "undefined") return "";
  const pk = checkupPromptStorageKey(token, sectionKey);
  const vk = checkupPromptVersionStorageKey(token, sectionKey);
  const storedVersion = localStorage.getItem(vk) ?? "";
  const stored = localStorage.getItem(pk) ?? "";
  if (storedVersion === CHECKUP_REPORT_PROMPT_VERSION && stored.trim()) return stored;
  const fallback = CHECKUP_REPORT_PROMPT_DEFAULTS[sectionKey] ?? "";
  localStorage.setItem(pk, fallback);
  localStorage.setItem(vk, CHECKUP_REPORT_PROMPT_VERSION);
  return fallback;
}

function reportModeSectionKey(mode: "concat" | "fusion" | "advanced"): string {
  if (mode === "concat") return CHECKUP_REPORT_CONCAT_SECTION_KEY;
  if (mode === "advanced") return CHECKUP_REPORT_ADVANCED_SECTION_KEY;
  return CHECKUP_REPORT_FUSION_SECTION_KEY;
}

function readPriorityThresholds() {
  if (typeof window === "undefined") return DEFAULT_PRIORITY_THRESHOLDS;
  try {
    const raw = localStorage.getItem(PRIORITY_THRESHOLDS_STORAGE_KEY);
    if (!raw) return DEFAULT_PRIORITY_THRESHOLDS;
    const parsed = JSON.parse(raw) as Partial<typeof DEFAULT_PRIORITY_THRESHOLDS>;
    return {
      low: typeof parsed.low === "number" ? parsed.low : DEFAULT_PRIORITY_THRESHOLDS.low,
      mid: typeof parsed.mid === "number" ? parsed.mid : DEFAULT_PRIORITY_THRESHOLDS.mid,
      midHigh: typeof parsed.midHigh === "number" ? parsed.midHigh : DEFAULT_PRIORITY_THRESHOLDS.midHigh,
    };
  } catch {
    return DEFAULT_PRIORITY_THRESHOLDS;
  }
}

function isQuestionAnswered(a: Answers[string] | undefined): boolean {
  if (!a) return false;
  if (a.kind === "single_choice") return !!a.value;
  if (a.kind === "textarea") return a.value.trim().length > 0;
  if (a.kind === "multi_choice_with_other") {
    return a.values.length > 0 || (a.otherText ?? "").trim().length > 0;
  }
  return false;
}

function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "00:00";
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

type FinalReportState = {
  reportText: string;
  updatedAt: string;
  finalizedAt: string | null;
  emailSentAt: string | null;
  emailSentTo: string | null;
};

export function CheckupReportPanel({
  token,
  sections,
  answers,
  companyName,
  contactName,
  contactPhone,
  questionnaireStatus,
  submittedAt,
  questionnaireVersion,
  initialFinalReport,
  clientEmail,
}: {
  token: string;
  sections: QuestionnaireSection[];
  answers: Answers;
  companyName: string | null;
  contactName: string | null;
  contactPhone: string | null;
  questionnaireStatus: "draft" | "submitted";
  submittedAt: Date | null;
  questionnaireVersion: string | null;
  initialFinalReport: FinalReportState | null;
  clientEmail: string | null;
}) {
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"questionnaire" | "report" | "history">("report");
  const [qDetailMode, setQDetailMode] = useState<"risk-only" | "all">("risk-only");
  const [reportMode, setReportMode] = useState<"concat" | "fusion" | "advanced">("fusion");
  const [genBusy, setGenBusy] = useState(false);
  const [reportText, setReportText] = useState(initialFinalReport?.reportText ?? "");
  const [editMode, setEditMode] = useState(false);
  const [savedReportText, setSavedReportText] = useState(initialFinalReport?.reportText ?? "");
  const [savingReport, setSavingReport] = useState(false);
  const [finalizedAt, setFinalizedAt] = useState<string | null>(initialFinalReport?.finalizedAt ?? null);
  const [finalizing, setFinalizing] = useState(false);
  const [emailSentAt, setEmailSentAt] = useState<string | null>(initialFinalReport?.emailSentAt ?? null);
  const [emailSentTo, setEmailSentTo] = useState<string | null>(initialFinalReport?.emailSentTo ?? null);
  const [showSendPanel, setShowSendPanel] = useState(false);
  const [sendTo, setSendTo] = useState(clientEmail ?? "");
  const [sendSubject, setSendSubject] = useState("");
  const [sendMessage, setSendMessage] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [selectedHistoryJobId, setSelectedHistoryJobId] = useState<string | null>(null);
  const [selectedHistoryCreatedAt, setSelectedHistoryCreatedAt] = useState<string | null>(null);
  const [runDetail, setRunDetail] = useState<{
    moduleCount: number | null;
    startedAt: number | null;
    endedAt: number | null;
  }>({ moduleCount: null, startedAt: null, endedAt: null });
  const [genStage, setGenStage] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const reportBodyRef = useRef<HTMLDivElement | null>(null);
  const stageTimersRef = useRef<number[]>([]);

  const { answeredQuestions, totalQuestions } = useMemo(() => {
    let total = 0;
    let answered = 0;
    for (const section of sections) {
      for (const q of section.questions) {
        total += 1;
        if (isQuestionAnswered(answers[q.qid])) answered += 1;
      }
    }
    return { answeredQuestions: answered, totalQuestions: total };
  }, [sections, answers]);

  function clearStageTimers() {
    stageTimersRef.current.forEach((id) => window.clearTimeout(id));
    stageTimersRef.current = [];
  }

  useEffect(() => () => clearStageTimers(), []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (initialFinalReport?.reportText) return; // 已有保存到数据库的报告，以它为准，不用本地缓存的最近一次生成结果覆盖
    setReportText(localStorage.getItem(checkupReportStorageKey(token)) ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    const onEvt = (e: Event) => {
      const ce = e as CustomEvent<{ token?: string; jobId?: string; reportText?: string; createdAt?: string }>;
      if (ce.detail?.token !== token || !ce.detail.reportText) return;
      setReportText(ce.detail.reportText);
      setSelectedHistoryJobId(ce.detail.jobId ?? null);
      setSelectedHistoryCreatedAt(ce.detail.createdAt ?? null);
      setActiveTab("report");
      setErr(null);
    };
    window.addEventListener("lexcheck:load-history-report", onEvt as EventListener);
    return () => window.removeEventListener("lexcheck:load-history-report", onEvt as EventListener);
  }, [token]);

  useEffect(() => {
    if (!genBusy || runDetail.endedAt != null) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 250);
    return () => window.clearInterval(id);
  }, [genBusy, runDetail.endedAt]);

  async function generateReport() {
    setErr(null);
    setMsg(null);
    clearStageTimers();
    const startedAt = Date.now();
    setRunDetail({ moduleCount: null, startedAt, endedAt: null });
    setGenBusy(true);
    setGenStage("正在校验模型与模板配置…");
    stageTimersRef.current = [
      window.setTimeout(
        () =>
          setGenStage(
            `正在按问卷作答内容（已作答 ${answeredQuestions}/${totalQuestions} 题）拼装风险与建议…`
          ),
        500
      ),
      window.setTimeout(() => setGenStage("正在调用大模型生成开头概述与整改顺序建议…"), 1800),
    ];
    try {
      const promptMd = readOrSeedCheckupPrompt(token, reportModeSectionKey(reportMode));
      const thirdPartyPromptMd = readOrSeedCheckupPrompt(token, CHECKUP_REPORT_THIRDPARTY_SECTION_KEY);
      const disclaimerText = readOrSeedCheckupPrompt(token, CHECKUP_REPORT_DISCLAIMER_SECTION_KEY);

      const res = await fetch(`/api/lawyer/checkups/${encodeURIComponent(token)}/checkup-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          promptMd,
          thirdPartyPromptMd,
          disclaimerText,
          thresholds: readPriorityThresholds(),
          mode: reportMode,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        reportText?: string;
        moduleCount?: number;
        usedAi?: boolean;
        degraded?: boolean;
        message?: string;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(json.message ?? json.error ?? `生成失败 ${res.status}`);
      }
      if (!json.reportText?.trim()) {
        throw new Error(json.message ?? json.error ?? "未返回报告正文");
      }

      setReportText(json.reportText);
      setEditMode(false);
      setSelectedHistoryJobId(null);
      setSelectedHistoryCreatedAt(null);
      setRunDetail((d) => ({ ...d, moduleCount: json.moduleCount ?? null }));
      if (typeof window !== "undefined") {
        localStorage.setItem(checkupReportStorageKey(token), json.reportText);
        window.dispatchEvent(
          new CustomEvent("lexcheck:quick-exam-history-updated", { detail: { token } })
        );
      }
      if (json.usedAi === false) {
        setMsg("体检报告已生成（未使用大模型，仅拼接预设文案）");
      } else if (json.degraded) {
        setMsg("体检报告已生成（部分内容未完全生成，已用预设内容兜底，建议人工核对）");
      } else {
        setMsg("体检报告已生成");
      }
      setGenStage(null);
    } catch (e) {
      setErr(String(e));
      // 保留最后一次进度提示，便于判断卡在哪一步
    } finally {
      clearStageTimers();
      setGenBusy(false);
      setRunDetail((d) => (d.startedAt == null || d.endedAt != null ? d : { ...d, endedAt: Date.now() }));
    }
  }

  async function exportReportDocx() {
    const text = reportText.trim();
    if (!text) {
      setErr("请先生成报告内容");
      return;
    }
    setErr(null);
    const base = companyName?.trim() || `体检报告-${token.slice(0, 8)}`;
    const generatedAt = selectedHistoryCreatedAt
      ? new Date(selectedHistoryCreatedAt)
      : runDetail.endedAt != null
        ? new Date(runDetail.endedAt)
        : new Date();
    try {
      await downloadQuickExamDocx(text, base, generatedAt);
      setMsg("Word 已导出");
    } catch (e) {
      setErr(String(e));
    }
  }

  async function saveReport() {
    const text = reportText.trim();
    if (!text) {
      setErr("没有可保存的内容");
      return;
    }
    setSavingReport(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/lawyer/checkups/${encodeURIComponent(token)}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportText: text }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        finalReport?: { reportText: string; finalizedAt: string | null };
        message?: string;
      };
      if (!res.ok || !json.ok || !json.finalReport) throw new Error(json.message ?? "保存失败");
      setSavedReportText(json.finalReport.reportText);
      setFinalizedAt(json.finalReport.finalizedAt ?? null);
      setEditMode(false);
      setMsg("已保存");
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e));
    } finally {
      setSavingReport(false);
    }
  }

  async function toggleFinalize(next: boolean) {
    setFinalizing(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/lawyer/checkups/${encodeURIComponent(token)}/report`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ finalize: next }),
      });
      const json = (await res.json()) as { ok?: boolean; finalizedAt?: string | null; message?: string };
      if (!res.ok || !json.ok) throw new Error(json.message ?? "操作失败");
      setFinalizedAt(json.finalizedAt ?? null);
      setMsg(next ? "已定稿" : "已取消定稿");
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e));
    } finally {
      setFinalizing(false);
    }
  }

  async function sendReportEmail() {
    setSendingEmail(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/lawyer/checkups/${encodeURIComponent(token)}/report/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: sendTo, subject: sendSubject, message: sendMessage }),
      });
      const json = (await res.json()) as { ok?: boolean; sentTo?: string; message?: string };
      if (!res.ok || !json.ok) throw new Error(json.message ?? "发送失败");
      setEmailSentAt(new Date().toISOString());
      setEmailSentTo(json.sentTo ?? sendTo);
      setShowSendPanel(false);
      setMsg(`已发送至 ${json.sentTo ?? sendTo}`);
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e));
    } finally {
      setSendingEmail(false);
    }
  }

  function backToLatestReport() {
    setSelectedHistoryJobId(null);
    setSelectedHistoryCreatedAt(null);
    if (typeof window !== "undefined") {
      setReportText(localStorage.getItem(checkupReportStorageKey(token)) ?? "");
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-8 py-4">
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <div className="shrink-0 space-y-3">
            <div className="flex items-center gap-2">
              <Link
                href="/lawyer/checkups/lexcheck?view=report"
                className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="返回选择问卷"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground">
                {companyName?.trim() || "未填写公司名称"}
              </h1>
            </div>
            <div className="grid grid-cols-3 gap-x-8 gap-y-2">
              {[
                { label: "联系人", value: contactName?.trim() || "未填写" },
                { label: "电话号码", value: contactPhone?.trim() || "未填写" },
                { label: "问卷状态", value: questionnaireStatus === "submitted" ? "已提交" : "草稿" },
                { label: "提交时间", value: submittedAt ? submittedAt.toLocaleString() : "未提交" },
                { label: "问卷版本", value: questionnaireVersion?.trim() || "未知" },
              ].map((f) => (
                <div key={f.label} className="flex items-baseline gap-1 text-base">
                  <span className="w-24 shrink-0 text-muted-foreground">{f.label}:</span>
                  <span className="min-w-0 truncate text-foreground">{f.value}</span>
                </div>
              ))}
            </div>
          </div>
          <ThirdPartyReportBox token={token} />
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="flex shrink-0 items-stretch gap-4 border-b border-border">
              <button
                type="button"
                onClick={() => setActiveTab("questionnaire")}
                className={`-mb-px shrink-0 border-b-2 px-1 py-2 text-base font-medium transition-colors ${
                  activeTab === "questionnaire"
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                问卷详情
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("report")}
                className={`-mb-px shrink-0 border-b-2 px-1 py-2 text-base font-medium transition-colors ${
                  activeTab === "report"
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                报告制作
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("history")}
                className={`-mb-px shrink-0 border-b-2 px-1 py-2 text-base font-medium transition-colors ${
                  activeTab === "history"
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                历史报告
              </button>
            </div>

            {activeTab === "questionnaire" ? (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="flex shrink-0 items-center justify-end gap-1 py-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className={`h-8 border-0 text-xs ${
                      qDetailMode === "risk-only" ? "text-primary" : "text-muted-foreground"
                    }`}
                    onClick={(e) => {
                      e.preventDefault();
                      setQDetailMode("risk-only");
                    }}
                  >
                    仅风险项
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className={`h-8 border-0 text-xs ${
                      qDetailMode === "all" ? "text-primary" : "text-muted-foreground"
                    }`}
                    onClick={(e) => {
                      e.preventDefault();
                      setQDetailMode("all");
                    }}
                  >
                    全文
                  </Button>
                </div>
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto text-xs">
                  <QuestionnaireCompactText sections={sections} answers={answers} mode={qDetailMode} />
                </div>
              </div>
            ) : activeTab === "history" ? (
              <div className="min-h-0 flex-1 overflow-y-auto py-3">
                <CheckupReportHistoryPanel token={token} companyName={companyName} />
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col">
                {selectedHistoryJobId ? (
                  <div className="mb-2 mt-3 flex shrink-0 items-center justify-between gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-[11px] text-amber-900 dark:text-amber-100">
                    <span>正在查看历史版本</span>
                    <button
                      type="button"
                      className="font-medium underline underline-offset-2"
                      onClick={backToLatestReport}
                    >
                      返回最新
                    </button>
                  </div>
                ) : null}

                {finalizedAt ? (
                  <div className="mb-2 mt-3 flex shrink-0 items-center justify-between gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-2 text-[11px] text-emerald-900 dark:text-emerald-100">
                    <span>
                      已定稿于 {new Date(finalizedAt).toLocaleString()}
                      {emailSentAt ? ` · 已发送至 ${emailSentTo}（${new Date(emailSentAt).toLocaleString()}）` : null}
                    </span>
                    <button
                      type="button"
                      className="font-medium underline underline-offset-2 disabled:opacity-50"
                      disabled={finalizing}
                      onClick={() => void toggleFinalize(false)}
                    >
                      取消定稿
                    </button>
                  </div>
                ) : null}

                {editMode ? (
                  <textarea
                    value={reportText}
                    onChange={(e) => setReportText(e.target.value)}
                    className="min-h-0 flex-1 resize-none overflow-y-auto rounded-md border bg-background px-3 py-2 font-mono text-xs leading-relaxed"
                  />
                ) : reportText.trim() ? (
                  <div ref={reportBodyRef} className="min-h-0 flex-1 overflow-y-auto py-3 text-xs">
                    <QuickExamReportMarkdown markdown={reportText} />
                  </div>
                ) : (
                  <div className="min-h-0 flex-1" />
                )}

                {showSendPanel ? (
                  <div className="mt-2 shrink-0 space-y-2 rounded-md border border-border/60 px-3 py-2.5">
                    <div className="text-xs font-medium text-foreground">发送报告到客户邮箱</div>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block space-y-1">
                        <span className="text-[11px] text-muted-foreground">收件邮箱</span>
                        <input
                          value={sendTo}
                          onChange={(e) => setSendTo(e.target.value)}
                          placeholder="name@example.com"
                          className="h-8 w-full rounded-sm border bg-background px-2 text-xs"
                        />
                      </label>
                      <label className="block space-y-1">
                        <span className="text-[11px] text-muted-foreground">邮件主题（留空则自动生成）</span>
                        <input
                          value={sendSubject}
                          onChange={(e) => setSendSubject(e.target.value)}
                          className="h-8 w-full rounded-sm border bg-background px-2 text-xs"
                        />
                      </label>
                    </div>
                    <label className="block space-y-1">
                      <span className="text-[11px] text-muted-foreground">邮件正文（留空则自动生成，报告以 Word 附件发送）</span>
                      <textarea
                        value={sendMessage}
                        onChange={(e) => setSendMessage(e.target.value)}
                        rows={3}
                        className="w-full resize-none rounded-sm border bg-background px-2 py-1.5 text-xs"
                      />
                    </label>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={sendingEmail || !sendTo.trim()}
                        onClick={() => void sendReportEmail()}
                      >
                        {sendingEmail ? "发送中…" : "发送"}
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => setShowSendPanel(false)}>
                        取消
                      </Button>
                    </div>
                  </div>
                ) : null}

                {runDetail.startedAt != null ? (
                  <div className="mt-2 shrink-0 space-y-1 rounded-sm border border-border/60 px-2.5 py-2 text-[11px] leading-snug text-muted-foreground">
                    <div>
                      <span className="text-muted-foreground">耗时：</span>
                      {formatDuration((runDetail.endedAt ?? Date.now()) - runDetail.startedAt)}
                      {genBusy ? " · 进行中" : " · 已结束"}
                      {runDetail.moduleCount != null ? ` · 命中 ${runDetail.moduleCount} 个风险模块` : null}
                    </div>
                    {genStage ? <div>{genStage}</div> : null}
                  </div>
                ) : null}

                <div className="mt-2 flex shrink-0 flex-wrap items-center justify-between gap-2 py-1.5 text-base">
                  <div className="min-w-0 flex-1 truncate">
                    {err ? (
                      <span className="text-destructive">{err}</span>
                    ) : msg ? (
                      <span className="text-muted-foreground">{msg}</span>
                    ) : (
                      <span className="text-muted-foreground">
                        {!reportText.trim()
                          ? "尚未生成体检报告"
                          : reportText !== savedReportText
                            ? "有未保存的修改"
                            : "体检报告已生成"}
                      </span>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-9 text-sm"
                      disabled={!reportText.trim() || Boolean(finalizedAt)}
                      onClick={() => setEditMode((v) => !v)}
                    >
                      {editMode ? "预览" : "编辑"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-9 text-sm"
                      disabled={savingReport || !reportText.trim() || Boolean(finalizedAt) || reportText === savedReportText}
                      onClick={() => void saveReport()}
                    >
                      {savingReport ? "保存中…" : "保存"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-9 text-sm"
                      disabled={finalizing || !savedReportText.trim() || Boolean(finalizedAt)}
                      onClick={() => void toggleFinalize(true)}
                    >
                      {finalizing ? "处理中…" : "定稿"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-9 text-sm"
                      disabled={!savedReportText.trim()}
                      onClick={() => setShowSendPanel((v) => !v)}
                    >
                      发送客户邮箱
                    </Button>
                    <select
                      value={reportMode}
                      disabled={genBusy || Boolean(finalizedAt)}
                      onChange={(e) =>
                        setReportMode(
                          e.target.value === "concat"
                            ? "concat"
                            : e.target.value === "advanced"
                              ? "advanced"
                              : "fusion"
                        )
                      }
                      className="h-9 rounded-sm border border-border/60 bg-transparent px-2 text-sm text-muted-foreground"
                    >
                      <option value="fusion">融合模式</option>
                      <option value="concat">拼装模式</option>
                      <option value="advanced">高级模式</option>
                    </select>
                    <Button
                      type="button"
                      size="default"
                      className="h-9 rounded-lg border border-primary/30 bg-gradient-to-b from-primary to-primary/85 px-4 text-sm font-medium text-primary-foreground shadow-sm shadow-primary/30 transition-all hover:from-primary/95 hover:to-primary/80 hover:shadow-md"
                      disabled={genBusy || Boolean(finalizedAt)}
                      onClick={(e) => {
                        e.preventDefault();
                        void generateReport();
                      }}
                    >
                      {genBusy ? "生成中…" : "生成报告"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="link"
                      className="h-9 text-sm"
                      disabled={!reportText.trim()}
                      onClick={(e) => {
                        e.preventDefault();
                        void exportReportDocx();
                      }}
                    >
                      导出 Word
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
