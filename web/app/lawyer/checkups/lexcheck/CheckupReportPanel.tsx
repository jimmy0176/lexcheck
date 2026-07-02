"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Loader2, SlidersHorizontal, Sparkles, User } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  getDdSegmentDefaultTemplate,
  CHECKUP_REPORT_SECTION_KEY,
  CHECKUP_REPORT_TEMPLATE_VERSION,
} from "@/lib/dd-segment-default-templates";
import { getProviderById } from "@/lib/llm-providers";
import { DEFAULT_PRIORITY_THRESHOLDS, PRIORITY_THRESHOLDS_STORAGE_KEY } from "@/lib/checkup-report-assemble";
import type { Answers, QuestionnaireSection } from "@/lib/questionnaire-types";
import { QuestionnaireCompactText } from "./QuestionnaireCompactText";
import { SegmentTemplateSettingsDialog } from "./SegmentTemplateSettingsDialog";
import { downloadQuickExamDocx } from "./export-quick-exam-report";
import { QuickExamReportMarkdown } from "./QuickExamReportMarkdown";

function segmentPromptStorageKey(token: string, sectionKey: string) {
  return `lexcheck:dd-segment:${token}:${sectionKey}:prompt`;
}

function segmentOutputStorageKey(token: string, sectionKey: string) {
  return `lexcheck:dd-segment:${token}:${sectionKey}:output`;
}

function checkupReportStorageKey(t: string) {
  return `lexcheck:checkup-report:text:v1:${t}`;
}

function ensureCheckupReportTemplateSeeded(token: string) {
  if (typeof window === "undefined") return;
  const sectionKey = CHECKUP_REPORT_SECTION_KEY;
  const pk = segmentPromptStorageKey(token, sectionKey);
  const ok = segmentOutputStorageKey(token, sectionKey);
  const vk = `lexcheck:dd-segment:${token}:${sectionKey}:version`;
  const storedVersion = localStorage.getItem(vk) ?? "";
  const alreadySeeded =
    storedVersion === CHECKUP_REPORT_TEMPLATE_VERSION &&
    (localStorage.getItem(pk) ?? "").trim() !== "";
  if (alreadySeeded) return;
  const d = getDdSegmentDefaultTemplate(sectionKey);
  if (!d) return;
  localStorage.setItem(pk, d.prompt);
  localStorage.setItem(ok, d.outputFull);
  localStorage.setItem(vk, CHECKUP_REPORT_TEMPLATE_VERSION);
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

function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "00:00";
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function CheckupReportPanel({
  token,
  sections,
  answers,
  companyName,
  contactName,
  contactPhone,
  questionnaireStatus,
}: {
  token: string;
  sections: QuestionnaireSection[];
  answers: Answers;
  companyName: string | null;
  contactName: string | null;
  contactPhone: string | null;
  questionnaireStatus: "draft" | "submitted";
}) {
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [settingsOpenKey, setSettingsOpenKey] = useState<string | null>(null);
  const [segDialogPrompt, setSegDialogPrompt] = useState("");
  const [segDialogOutput, setSegDialogOutput] = useState("");
  const [activeTab, setActiveTab] = useState<"questionnaire" | "report">("report");
  const [qDetailMode, setQDetailMode] = useState<"risk-only" | "all">("risk-only");
  const [genBusy, setGenBusy] = useState(false);
  const [reportText, setReportText] = useState("");
  const [selectedHistoryJobId, setSelectedHistoryJobId] = useState<string | null>(null);
  const [runDetail, setRunDetail] = useState<{
    moduleCount: number | null;
    startedAt: number | null;
    endedAt: number | null;
  }>({ moduleCount: null, startedAt: null, endedAt: null });
  const [, setTick] = useState(0);
  const reportBodyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setReportText(localStorage.getItem(checkupReportStorageKey(token)) ?? "");
  }, [token]);

  useEffect(() => {
    const onEvt = (e: Event) => {
      const ce = e as CustomEvent<{ token?: string; jobId?: string; reportText?: string }>;
      if (ce.detail?.token !== token || !ce.detail.reportText) return;
      setReportText(ce.detail.reportText);
      setSelectedHistoryJobId(ce.detail.jobId ?? null);
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

  useEffect(() => {
    if (!settingsOpenKey) return;
    ensureCheckupReportTemplateSeeded(token);
    setSegDialogPrompt(localStorage.getItem(segmentPromptStorageKey(token, settingsOpenKey)) ?? "");
    setSegDialogOutput(localStorage.getItem(segmentOutputStorageKey(token, settingsOpenKey)) ?? "");
  }, [settingsOpenKey, token]);

  async function generateReport() {
    setErr(null);
    setMsg(null);
    const startedAt = Date.now();
    setRunDetail({ moduleCount: null, startedAt, endedAt: null });
    setGenBusy(true);
    try {
      ensureCheckupReportTemplateSeeded(token);
      const prompt =
        localStorage.getItem(segmentPromptStorageKey(token, CHECKUP_REPORT_SECTION_KEY)) ?? "";
      const outputFull =
        localStorage.getItem(segmentOutputStorageKey(token, CHECKUP_REPORT_SECTION_KEY)) ?? "";
      const providerId = (localStorage.getItem("lexcheck:model:providerId") ?? "dashscope").trim();
      const model = (localStorage.getItem("lexcheck:model:name") ?? "").trim();
      const apiKey = (localStorage.getItem("lexcheck:model:key") ?? "").trim();
      const customBaseUrl = (localStorage.getItem("lexcheck:model:customBaseUrl") ?? "").trim();
      const provider = getProviderById(providerId);
      if (!apiKey) throw new Error("请先在「配置中心 → 大模型设置」填写并保存 API Key");
      if (!model) throw new Error("请先在「配置中心 → 大模型设置」填写并保存模型名称");
      if (providerId === "custom" && !customBaseUrl) {
        throw new Error("当前供应商为自定义，请先填写并保存 Base URL");
      }

      const res = await fetch(`/api/lawyer/checkups/${encodeURIComponent(token)}/checkup-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          promptMd: prompt,
          outputMd: outputFull,
          providerId,
          model,
          apiKey,
          baseUrlOverride: providerId === "custom" ? customBaseUrl : provider?.baseUrl ?? "",
          thresholds: readPriorityThresholds(),
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        reportText?: string;
        moduleCount?: number;
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
      setSelectedHistoryJobId(null);
      setRunDetail((d) => ({ ...d, moduleCount: json.moduleCount ?? null }));
      if (typeof window !== "undefined") {
        localStorage.setItem(checkupReportStorageKey(token), json.reportText);
        window.dispatchEvent(
          new CustomEvent("lexcheck:quick-exam-history-updated", { detail: { token } })
        );
      }
      setMsg("体检报告已生成");
    } catch (e) {
      setErr(String(e));
    } finally {
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
    try {
      await downloadQuickExamDocx(text, base);
      setMsg("Word 已导出");
    } catch (e) {
      setErr(String(e));
    }
  }

  function backToLatestReport() {
    setSelectedHistoryJobId(null);
    if (typeof window !== "undefined") {
      setReportText(localStorage.getItem(checkupReportStorageKey(token)) ?? "");
    }
  }

  return (
    <div className="flex h-full flex-col rounded-lg rounded-l-none border bg-card shadow-sm">
      <div className="flex shrink-0 items-center justify-end border-b px-4 py-[15px]">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <User className="h-4 w-4" />
          <span>律师账号</span>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <div className="shrink-0 space-y-1.5">
            <div className="flex items-baseline gap-2 text-base">
              <span className="text-muted-foreground">企业名称</span>
              <span className="font-medium">{companyName?.trim() || "未填写"}</span>
            </div>
            <div className="flex items-baseline gap-2 text-base">
              <span className="text-muted-foreground">联系人</span>
              <span className="font-medium">{contactName?.trim() || "未填写"}</span>
            </div>
            <div className="flex items-baseline gap-2 text-base">
              <span className="text-muted-foreground">电话号码</span>
              <span className="font-medium">{contactPhone?.trim() || "未填写"}</span>
            </div>
            <div className="flex items-baseline gap-2 text-base">
              <span className="text-muted-foreground">问卷状态</span>
              <span>{questionnaireStatus === "submitted" ? "已提交" : "草稿"}</span>
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border/80 bg-background/40">
            <div className="flex shrink-0 items-stretch gap-1 border-b border-border/50 bg-muted/15 px-2 py-1.5 sm:px-3">
              <div className="flex min-w-0 flex-1 items-center gap-1">
                <button
                  type="button"
                  onClick={() => setActiveTab("questionnaire")}
                  className={`shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    activeTab === "questionnaire"
                      ? "bg-gradient-to-br from-primary/15 to-primary/5 text-primary"
                      : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                  }`}
                >
                  问卷详情
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("report")}
                  className={`shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    activeTab === "report"
                      ? "bg-gradient-to-br from-primary/15 to-primary/5 text-primary"
                      : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                  }`}
                >
                  体检报告
                </button>
              </div>
              <div className="flex shrink-0 items-center gap-1 border-l border-border/60 pl-1.5">
                {activeTab === "questionnaire" ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant={qDetailMode === "risk-only" ? "secondary" : "outline"}
                      className="h-8 text-xs"
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
                      variant={qDetailMode === "all" ? "secondary" : "outline"}
                      className="h-8 text-xs"
                      onClick={(e) => {
                        e.preventDefault();
                        setQDetailMode("all");
                      }}
                    >
                      全文
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      title="提示词和模板配置"
                      onClick={(e) => {
                        e.preventDefault();
                        setSettingsOpenKey(CHECKUP_REPORT_SECTION_KEY);
                      }}
                    >
                      <SlidersHorizontal className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      title="生成体检报告"
                      disabled={genBusy}
                      onClick={(e) => {
                        e.preventDefault();
                        void generateReport();
                      }}
                    >
                      {genBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      title="导出 Word"
                      disabled={!reportText.trim()}
                      onClick={(e) => {
                        e.preventDefault();
                        void exportReportDocx();
                      }}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>

            {activeTab === "questionnaire" ? (
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3 text-xs">
                <QuestionnaireCompactText sections={sections} answers={answers} mode={qDetailMode} />
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col px-3 py-3 text-xs">
                {selectedHistoryJobId ? (
                  <div className="mb-2 flex shrink-0 items-center justify-between gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-[11px] text-amber-900 dark:text-amber-100">
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
                {runDetail.startedAt != null ? (
                  <div className="mb-2 shrink-0 space-y-1 rounded-md border border-border/60 bg-muted/30 px-2.5 py-2 text-[11px] leading-snug text-muted-foreground">
                    <div>
                      <span className="text-muted-foreground">耗时：</span>
                      {formatDuration((runDetail.endedAt ?? Date.now()) - runDetail.startedAt)}
                      {genBusy ? " · 进行中" : " · 已结束"}
                      {runDetail.moduleCount != null ? ` · 命中 ${runDetail.moduleCount} 个风险模块` : null}
                    </div>
                  </div>
                ) : null}
                {reportText.trim() ? (
                  <div ref={reportBodyRef} className="min-h-0 flex-1 overflow-y-auto">
                    <QuickExamReportMarkdown markdown={reportText} />
                  </div>
                ) : (
                  <div className="flex min-h-0 flex-1 flex-col">
                    <p className="text-muted-foreground">
                      尚未生成。请点击「生成体检报告」：系统会按问卷答案逐条拼装风险与建议，并由大模型补充开头概述与结尾整改顺序建议。生成前可在「提示词和模板配置」中调整语气与格式指引。
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {(err || msg) && (
          <Card className="mt-4 shrink-0 p-3 text-sm">
            {err ? <div className="text-destructive">{err}</div> : null}
            {msg ? <div className="text-muted-foreground">{msg}</div> : null}
          </Card>
        )}
      </div>

      <SegmentTemplateSettingsDialog
        key={token}
        open={settingsOpenKey !== null}
        onOpenChange={(o) => {
          if (!o) setSettingsOpenKey(null);
        }}
        token={token}
        sectionKey={settingsOpenKey}
        sectionTitle="体检报告"
        prompt={segDialogPrompt}
        output={segDialogOutput}
        onPromptChange={setSegDialogPrompt}
        onOutputChange={setSegDialogOutput}
        onPersist={() => {
          if (!settingsOpenKey) return;
          localStorage.setItem(segmentPromptStorageKey(token, settingsOpenKey), segDialogPrompt);
          localStorage.setItem(segmentOutputStorageKey(token, settingsOpenKey), segDialogOutput);
          setSettingsOpenKey(null);
        }}
        variant="quickExam"
      />
    </div>
  );
}
