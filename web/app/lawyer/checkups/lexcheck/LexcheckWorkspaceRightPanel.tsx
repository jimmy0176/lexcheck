"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Loader2, SlidersHorizontal, Sparkles } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { DD_REPORT_SECTIONS } from "@/lib/dd-report-toc";
import {
  getDdSegmentDefaultTemplate,
  LEXCHECK_QUICK_EXAM_SECTION_KEY,
  QUICK_EXAM_TEMPLATE_VERSION,
} from "@/lib/dd-segment-default-templates";
import { getProviderById } from "@/lib/llm-providers";
import type { QuickExamRunStats } from "@/lib/quick-exam-pipeline";
import type { Answers, QuestionnaireSection } from "@/lib/questionnaire-types";
import { LawyerAiPanel } from "../[token]/LawyerAiPanel";
import { QuestionnaireCompactText } from "./QuestionnaireCompactText";
import { SegmentTemplateSettingsDialog } from "./SegmentTemplateSettingsDialog";
import { downloadQuickExamDocx } from "./export-quick-exam-report";
import { QuickExamReportMarkdown } from "./QuickExamReportMarkdown";

type SectionDraftRow = {
  id: string;
  sectionKey: string;
  sectionName: string;
  draftText: string;
  reviewedText: string;
  included: boolean;
  updatedAt: string;
};

function segmentPromptStorageKey(token: string, sectionKey: string) {
  return `lexcheck:dd-segment:${token}:${sectionKey}:prompt`;
}

function segmentOutputStorageKey(token: string, sectionKey: string) {
  return `lexcheck:dd-segment:${token}:${sectionKey}:output`;
}

function attachmentExtractRuleStorageKey(token: string, attachmentId: string) {
  return `lexcheck:attachment-extract-rule:${token}:${attachmentId}`;
}

function readAttachmentExtractRule(token: string, attachmentId: string): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(attachmentExtractRuleStorageKey(token, attachmentId)) ?? "";
}

const AI_EXTRACT_RESULT_LS = "lexcheck:attachment-ai-extract:v1";

function attachmentAiExtractStorageKey(token: string, attachmentId: string) {
  return `${AI_EXTRACT_RESULT_LS}:${token}:${attachmentId}`;
}

function loadAiExtractMap(token: string, ids: string[]): Record<string, string> {
  const m: Record<string, string> = {};
  if (typeof window === "undefined") return m;
  for (const id of ids) {
    const v = (localStorage.getItem(attachmentAiExtractStorageKey(token, id)) ?? "").trim();
    if (v) m[id] = v;
  }
  return m;
}

function saveAiExtractToLs(token: string, attachmentId: string, text: string) {
  const t = text.trim();
  if (t) localStorage.setItem(attachmentAiExtractStorageKey(token, attachmentId), t);
  else localStorage.removeItem(attachmentAiExtractStorageKey(token, attachmentId));
}

function pruneAttachmentSideCaches(token: string, keepIds: Set<string>) {
  if (typeof window === "undefined") return;
  const bases = [`${AI_EXTRACT_RESULT_LS}:${token}:`, `lexcheck:attachment-extract-rule:${token}:`];
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k) continue;
    for (const base of bases) {
      if (!k.startsWith(base)) continue;
      const id = k.slice(base.length);
      if (!keepIds.has(id)) keysToRemove.push(k);
      break;
    }
  }
  for (const k of keysToRemove) localStorage.removeItem(k);
}

/** 若本段尚无保存的模版且存在内置默认，则写入 localStorage 作为当前应用模版 */
function ensureDdSegmentTemplateSeeded(token: string, sectionKey: string) {
  if (typeof window === "undefined") return;
  if (!sectionKey.startsWith("dd_")) return;
  const pk = segmentPromptStorageKey(token, sectionKey);
  const ok = segmentOutputStorageKey(token, sectionKey);
  if ((localStorage.getItem(pk) ?? "").trim() || (localStorage.getItem(ok) ?? "").trim()) return;
  const d = getDdSegmentDefaultTemplate(sectionKey);
  if (!d) return;
  localStorage.setItem(pk, d.prompt);
  localStorage.setItem(ok, d.outputFull);
}

function quickExamReportStorageKey(t: string) {
  return `lexcheck:quick-exam-report:text:v1:${t}`;
}

function ensureQuickExamTemplateSeeded(token: string) {
  if (typeof window === "undefined") return;
  const sectionKey = LEXCHECK_QUICK_EXAM_SECTION_KEY;
  const pk = segmentPromptStorageKey(token, sectionKey);
  const ok = segmentOutputStorageKey(token, sectionKey);
  const vk = `lexcheck:dd-segment:${token}:${sectionKey}:version`;
  const storedVersion = localStorage.getItem(vk) ?? "";
  const alreadySeeded =
    storedVersion === QUICK_EXAM_TEMPLATE_VERSION &&
    (localStorage.getItem(pk) ?? "").trim() !== "";
  if (alreadySeeded) return;
  const d = getDdSegmentDefaultTemplate(sectionKey);
  if (!d) return;
  localStorage.setItem(pk, d.prompt);
  localStorage.setItem(ok, d.outputFull);
  localStorage.setItem(vk, QUICK_EXAM_TEMPLATE_VERSION);
}

function readSegmentCustomRequirement(token: string, sectionKey: string): string {
  if (typeof window === "undefined") return "";
  ensureDdSegmentTemplateSeeded(token, sectionKey);
  const output = (localStorage.getItem(segmentOutputStorageKey(token, sectionKey)) ?? "").trim();
  const prompt = (localStorage.getItem(segmentPromptStorageKey(token, sectionKey)) ?? "").trim();
  const parts: string[] = [];
  if (output) parts.push(`【本段输出结构/要点】\n${output}`);
  if (prompt) parts.push(`【本段补充指令】\n${prompt}`);
  return parts.join("\n\n").slice(0, 1200);
}

function buildDdDraftMap(
  drafts: Array<{
    id: string;
    sectionKey: string;
    sectionName: string;
    draftText: string;
    reviewedText: string | null;
    included: boolean;
    updatedAt: Date | string;
  }>
): Record<string, SectionDraftRow> {
  const m: Record<string, SectionDraftRow> = {};
  for (const d of drafts) {
    if (!d.sectionKey.startsWith("dd_")) continue;
    m[d.sectionKey] = {
      id: d.id,
      sectionKey: d.sectionKey,
      sectionName: d.sectionName,
      draftText: d.draftText,
      reviewedText: (d.reviewedText ?? "").trim(),
      included: d.included,
      updatedAt:
        typeof d.updatedAt === "string"
          ? d.updatedAt
          : d.updatedAt instanceof Date
            ? d.updatedAt.toISOString()
            : String(d.updatedAt),
    };
  }
  return m;
}

function formatQuickExamDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "00:00";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function quickExamPhaseLabel(phase: QuickExamRunStats["phase"]): string {
  switch (phase) {
    case "chunk_summaries":
      return "分块摘要";
    case "final_report":
      return "生成终稿";
    case "completed":
      return "已完成";
    case "failed":
      return "失败";
    default:
      return phase;
  }
}

const TABS = [
  { id: "overview", label: "快速体检" },
  { id: "extract", label: "内容提取" },
  { id: "segments", label: "分段调整" },
  { id: "summary", label: "总结建议" },
  { id: "report", label: "尽调报告" },
] as const;

type TabId = (typeof TABS)[number]["id"];

type FinalReport = {
  id: string;
  reportText: string;
  notesText: string;
  updatedAt: string | Date;
} | null;

type AttachmentRow = {
  id: string;
  fileName: string;
  extractedText: string | null;
  extractError: string | null;
  createdAt: Date;
  updatedAt?: string | Date;
};

type InitialSectionDraft = {
  id: string;
  sectionKey: string;
  sectionName: string;
  draftText: string;
  reviewedText: string | null;
  included: boolean;
  updatedAt: Date | string;
};

export function LexcheckWorkspaceRightPanel({
  token,
  initialFinalReport,
  initialSectionDrafts,
  sections,
  answers,
  attachments,
  companyName,
  questionnaireStatus,
}: {
  token: string;
  initialFinalReport: FinalReport;
  initialSectionDrafts: InitialSectionDraft[];
  sections: QuestionnaireSection[];
  answers: Answers;
  attachments: AttachmentRow[];
  companyName: string | null;
  questionnaireStatus: "draft" | "submitted";
}) {
  const [tab, setTab] = useState<TabId>("overview");
  const [finalReport, setFinalReport] = useState(initialFinalReport);
  const [finalizing, setFinalizing] = useState(false);
  const [noteInstruction, setNoteInstruction] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [openSectionIndices, setOpenSectionIndices] = useState<Set<number>>(() => new Set());
  const [autoGenBusy, setAutoGenBusy] = useState(false);
  const [draftByKey, setDraftByKey] = useState<Record<string, SectionDraftRow>>(() =>
    buildDdDraftMap(initialSectionDrafts)
  );
  const [reviewEdits, setReviewEdits] = useState<Record<string, string>>({});
  const [generatingKeys, setGeneratingKeys] = useState<Set<string>>(() => new Set());
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [settingsOpenKey, setSettingsOpenKey] = useState<string | null>(null);
  const [segDialogPrompt, setSegDialogPrompt] = useState("");
  const [segDialogOutput, setSegDialogOutput] = useState("");
  const [attachmentRows, setAttachmentRows] = useState<AttachmentRow[]>(() => attachments);
  const [openExtractIndices, setOpenExtractIndices] = useState<Set<number>>(() => new Set());
  const [extractingIds, setExtractingIds] = useState<Set<string>>(() => new Set());
  const [extractAllBusy, setExtractAllBusy] = useState(false);
  const [extractRuleOpenId, setExtractRuleOpenId] = useState<string | null>(null);
  const [extractRuleDraft, setExtractRuleDraft] = useState("");
  const [aiExtractById, setAiExtractById] = useState<Record<string, string>>({});
  const [qDetailOpen, setQDetailOpen] = useState(false);
  const [qDetailMode, setQDetailMode] = useState<"risk-only" | "all">("risk-only");
  const [quickExamGenBusy, setQuickExamGenBusy] = useState(false);
  const [quickExamReportText, setQuickExamReportText] = useState("");
  const [quickExamHistory, setQuickExamHistory] = useState<
    Array<{ id: string; createdAt: string; mode: string }>
  >([]);
  const [selectedHistoryJobId, setSelectedHistoryJobId] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  /** 最近一次生成的阶段、切块、API 次数与计时（结束后仍保留展示） */
  const [quickExamRunDetail, setQuickExamRunDetail] = useState<{
    stats: QuickExamRunStats | null;
    startedAt: number | null;
    endedAt: number | null;
  }>({ stats: null, startedAt: null, endedAt: null });
  const [, setQuickExamTick] = useState(0);
  const quickExamReportBodyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setQuickExamReportText(localStorage.getItem(quickExamReportStorageKey(token)) ?? "");
  }, [token]);

  const refreshQuickExamHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch(
        `/api/lawyer/checkups/${encodeURIComponent(token)}/quick-exam-report/history`,
        { cache: "no-store" }
      );
      if (!res.ok) return;
      const json = (await res.json()) as {
        jobs?: Array<{ id: string; createdAt: string; mode: string }>;
      };
      setQuickExamHistory(json.jobs ?? []);
    } catch {
      // ignore
    } finally {
      setHistoryLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void refreshQuickExamHistory();
  }, [refreshQuickExamHistory]);

useEffect(() => {
    setAttachmentRows(attachments);
  }, [attachments]);

  useEffect(() => {
    setAiExtractById(loadAiExtractMap(token, attachmentRows.map((a) => a.id)));
  }, [token, attachmentRows]);

  useEffect(() => {
    if (!quickExamGenBusy || quickExamRunDetail.endedAt != null) return;
    const id = window.setInterval(() => setQuickExamTick((n) => n + 1), 250);
    return () => window.clearInterval(id);
  }, [quickExamGenBusy, quickExamRunDetail.endedAt]);

  const refetchAttachments = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/lawyer/checkups/${encodeURIComponent(token)}/attachments?kind=detailed`,
        {
          cache: "no-store",
        }
      );
      if (!res.ok) return;
      const json = (await res.json()) as {
        attachments?: Array<{
          id: string;
          fileName: string;
          extractError: string | null;
          createdAt: string;
          updatedAt: string;
        }>;
      };
      const list = json.attachments ?? [];
      const keep = new Set(list.map((a) => a.id));
      pruneAttachmentSideCaches(token, keep);
      const nextRows: AttachmentRow[] = list.map((a) => ({
        id: a.id,
        fileName: a.fileName,
        extractedText: null,
        extractError: a.extractError ?? null,
        createdAt: new Date(a.createdAt),
        updatedAt: a.updatedAt,
      }));
      setAttachmentRows(nextRows);
      setAiExtractById(loadAiExtractMap(token, nextRows.map((r) => r.id)));
    } catch {
      // ignore
    }
  }, [token]);

  useEffect(() => {
    const onEvt = (e: Event) => {
      const ce = e as CustomEvent<{ token?: string }>;
      if (ce.detail?.token === token) void refetchAttachments();
    };
    window.addEventListener("lexcheck:attachments-refresh", onEvt as EventListener);
    return () => window.removeEventListener("lexcheck:attachments-refresh", onEvt as EventListener);
  }, [token, refetchAttachments]);

  useEffect(() => {
    if (!settingsOpenKey) return;
    if (settingsOpenKey.startsWith("dd_")) {
      ensureDdSegmentTemplateSeeded(token, settingsOpenKey);
    } else if (settingsOpenKey === LEXCHECK_QUICK_EXAM_SECTION_KEY) {
      ensureQuickExamTemplateSeeded(token);
    }
    setSegDialogPrompt(localStorage.getItem(segmentPromptStorageKey(token, settingsOpenKey)) ?? "");
    setSegDialogOutput(localStorage.getItem(segmentOutputStorageKey(token, settingsOpenKey)) ?? "");
  }, [settingsOpenKey, token]);

  function expandAllSections() {
    setOpenSectionIndices(new Set(DD_REPORT_SECTIONS.map((_, i) => i)));
  }

  function collapseAllSections() {
    setOpenSectionIndices(new Set());
  }

  function toggleSectionIndex(i: number) {
    setOpenSectionIndices((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  function expandAllExtract() {
    setOpenExtractIndices(new Set(attachmentRows.map((_, i) => i)));
  }

  function collapseAllExtract() {
    setOpenExtractIndices(new Set());
  }

  function toggleExtractIndex(i: number) {
    setOpenExtractIndices((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  async function runExtractAll() {
    if (attachmentRows.length === 0) return;
    setExtractAllBusy(true);
    setErr(null);
    setMsg(null);
    let stopped = false;
    try {
      for (const a of attachmentRows) {
        const ok = await runExtractOneAi(a.id, { quiet: true });
        if (!ok) {
          stopped = true;
          break;
        }
        await new Promise((r) => setTimeout(r, 200));
      }
      if (!stopped) setMsg("已全部完成 AI 提取");
    } finally {
      setExtractAllBusy(false);
    }
  }

  async function runExtractOneAi(
    attachmentId: string,
    opts?: { quiet?: boolean }
  ): Promise<boolean> {
    if (!opts?.quiet) {
      setErr(null);
      setMsg(null);
    }
    setExtractingIds((prev) => new Set(prev).add(attachmentId));
    try {
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

      const extractionRule = readAttachmentExtractRule(token, attachmentId).trim();
      const res = await fetch(
        `/api/lawyer/checkups/${encodeURIComponent(token)}/attachments/${encodeURIComponent(attachmentId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "ai",
            extractionRule,
            providerId,
            model,
            apiKey,
            baseUrlOverride: providerId === "custom" ? customBaseUrl : provider?.baseUrl,
          }),
        }
      );
      const json = (await res.json()) as {
        error?: string;
        message?: string;
        attachment?: {
          id: string;
          fileName: string;
          extractedText: string | null;
          extractError: string | null;
          updatedAt: string;
        };
      };
      if (!res.ok || !json.attachment) {
        throw new Error(json.message ?? json.error ?? `AI提取失败 ${res.status}`);
      }
      const u = json.attachment;
      const aiBody = (u.extractedText ?? "").trim();
      if (aiBody) {
        saveAiExtractToLs(token, attachmentId, aiBody);
        setAiExtractById((prev) => ({ ...prev, [attachmentId]: aiBody }));
      } else {
        saveAiExtractToLs(token, attachmentId, "");
        setAiExtractById((prev) => {
          const next = { ...prev };
          delete next[attachmentId];
          return next;
        });
      }
      setAttachmentRows((prev) =>
        prev.map((r) =>
          r.id === attachmentId
            ? {
                ...r,
                extractedText: null,
                extractError: u.extractError,
                updatedAt: u.updatedAt,
              }
            : r
        )
      );
      if (!opts?.quiet) {
        if (u.extractError && !aiBody) setMsg(`「${u.fileName}」AI提取失败`);
        else if (aiBody) setMsg(`「${u.fileName}」已完成 AI 提取`);
      }
      return true;
    } catch (e) {
      setErr(String(e));
      return false;
    } finally {
      setExtractingIds((prev) => {
        const next = new Set(prev);
        next.delete(attachmentId);
        return next;
      });
    }
  }

  async function generateSection(
    sectionKey: string,
    opts?: { quiet?: boolean }
  ): Promise<boolean> {
    if (!opts?.quiet) {
      setErr(null);
      setMsg(null);
    }
    setGeneratingKeys((prev) => new Set(prev).add(sectionKey));
    try {
      const customRequirement = readSegmentCustomRequirement(token, sectionKey);
      const res = await fetch(`/api/lawyer/checkups/${encodeURIComponent(token)}/generate-section`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionKey, customRequirement }),
      });
      const json = (await res.json()) as {
        error?: string;
        message?: string;
        draft?: {
          id: string;
          sectionKey: string;
          sectionName: string;
          draftText: string;
          reviewedText: string;
          included: boolean;
          updatedAt: string;
        };
      };
      if (!res.ok || !json.draft) {
        throw new Error(json.message ?? json.error ?? `生成失败 ${res.status}`);
      }
      const d = json.draft;
      setDraftByKey((prev) => ({
        ...prev,
        [sectionKey]: {
          id: d.id,
          sectionKey: d.sectionKey,
          sectionName: d.sectionName,
          draftText: d.draftText,
          reviewedText: (d.reviewedText ?? "").trim(),
          included: d.included,
          updatedAt: d.updatedAt,
        },
      }));
      setReviewEdits((prev) => ({
        ...prev,
        [sectionKey]: (d.reviewedText ?? "").trim() || d.draftText,
      }));
      if (!opts?.quiet) setMsg(`「${d.sectionName}」草稿已更新`);
      return true;
    } catch (e) {
      setErr(String(e));
      return false;
    } finally {
      setGeneratingKeys((prev) => {
        const next = new Set(prev);
        next.delete(sectionKey);
        return next;
      });
    }
  }

  async function saveReviewed(sectionKey: string) {
    const d = draftByKey[sectionKey];
    if (!d) return;
    const text = (reviewEdits[sectionKey] ?? (d.reviewedText || d.draftText)).trim();
    setSavingKey(sectionKey);
    setErr(null);
    try {
      const res = await fetch(`/api/lawyer/checkups/${encodeURIComponent(token)}/generate-section`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId: d.id, reviewedText: text }),
      });
      const json = (await res.json()) as {
        error?: string;
        message?: string;
        draft?: { reviewedText: string; updatedAt: string };
      };
      if (!res.ok || !json.draft) {
        throw new Error(json.message ?? json.error ?? `保存失败 ${res.status}`);
      }
      setDraftByKey((prev) => ({
        ...prev,
        [sectionKey]: {
          ...d,
          reviewedText: json.draft!.reviewedText,
          updatedAt: json.draft!.updatedAt,
        },
      }));
      setReviewEdits((prev) => ({ ...prev, [sectionKey]: json.draft!.reviewedText }));
      setMsg("修订内容已保存");
    } catch (e) {
      setErr(String(e));
    } finally {
      setSavingKey(null);
    }
  }

  async function setDraftIncluded(sectionKey: string, included: boolean) {
    const d = draftByKey[sectionKey];
    if (!d) return;
    setErr(null);
    try {
      const res = await fetch(`/api/lawyer/checkups/${encodeURIComponent(token)}/generate-section`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId: d.id, included }),
      });
      const json = (await res.json()) as {
        error?: string;
        message?: string;
        draft?: { included: boolean; updatedAt: string };
      };
      if (!res.ok || !json.draft) {
        throw new Error(json.message ?? json.error ?? `更新失败 ${res.status}`);
      }
      setDraftByKey((prev) => ({
        ...prev,
        [sectionKey]: {
          ...d,
          included: json.draft!.included,
          updatedAt: json.draft!.updatedAt,
        },
      }));
    } catch (e) {
      setErr(String(e));
    }
  }

  async function autoGenerateAllSections() {
    setErr(null);
    setMsg(null);
    setAutoGenBusy(true);
    let stopped = false;
    try {
      for (const s of DD_REPORT_SECTIONS) {
        const ok = await generateSection(s.key, { quiet: true });
        if (!ok) {
          stopped = true;
          break;
        }
        await new Promise((r) => setTimeout(r, 320));
      }
      if (!stopped) setMsg("已依次生成全部 14 个尽调分部草稿");
    } finally {
      setAutoGenBusy(false);
    }
  }

  async function finalizeReport() {
    setFinalizing(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/lawyer/checkups/${token}/finalize-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteInstruction }),
      });
      const json = (await res.json()) as {
        error?: string;
        message?: string;
        finalReport?: FinalReport;
      };
      if (!res.ok) throw new Error(json.message ?? json.error ?? `生成失败 ${res.status}`);
      setFinalReport(json.finalReport ?? null);
      setMsg("最终体检报告已生成");
    } catch (e) {
      setErr(String(e));
    } finally {
      setFinalizing(false);
    }
  }

  async function generateQuickExamReport() {
    setErr(null);
    setMsg(null);
    const startedAt = Date.now();
    setQuickExamRunDetail({ stats: null, startedAt, endedAt: null });
    setQuickExamGenBusy(true);
    try {
      ensureQuickExamTemplateSeeded(token);
      const prompt =
        localStorage.getItem(segmentPromptStorageKey(token, LEXCHECK_QUICK_EXAM_SECTION_KEY)) ?? "";
      const outputFull =
        localStorage.getItem(segmentOutputStorageKey(token, LEXCHECK_QUICK_EXAM_SECTION_KEY)) ?? "";
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

      const baseBody = {
        promptMd: prompt,
        outputMd: outputFull,
        providerId,
        model,
        apiKey,
        baseUrlOverride: providerId === "custom" ? customBaseUrl : provider?.baseUrl ?? "",
      };

      const applyRunStats = (rs?: QuickExamRunStats | null) => {
        if (!rs) return;
        setQuickExamRunDetail((d) => ({ ...d, stats: rs }));
        const p = rs.phase;
        if (p === "chunk_summaries") {
          setMsg(
            `分块摘要：${rs.chunksCompleted}/${rs.totalChunksPlanned} 块 · LLM ${rs.llmHttpCallsTotal} 次`
          );
        } else if (p === "final_report") {
          setMsg("正在生成终稿…");
        }
      };

      let res = await fetch(`/api/lawyer/checkups/${encodeURIComponent(token)}/quick-exam-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(baseBody),
      });
      let json = (await res.json()) as {
        ok?: boolean;
        async?: boolean;
        done?: boolean;
        jobId?: string;
        reportText?: string;
        progress?: { chunkCursor?: number; totalChunks?: number };
        meta?: { mode?: string; preliminaryInputKind?: string; fileCount?: number };
        runStats?: QuickExamRunStats;
        message?: string;
        error?: string;
      };

      if (!res.ok) {
        throw new Error(json.message ?? json.error ?? `生成失败 ${res.status}`);
      }

      applyRunStats(json.runStats);

      let guard = 0;
      while (json.async && json.jobId && !json.done && guard < 600) {
        guard++;
        await new Promise((r) => setTimeout(r, 400));
        res = await fetch(`/api/lawyer/checkups/${encodeURIComponent(token)}/quick-exam-report`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...baseBody, jobId: json.jobId }),
        });
        json = (await res.json()) as typeof json;
        if (!res.ok) {
          throw new Error(json.message ?? json.error ?? `生成失败 ${res.status}`);
        }
        applyRunStats(json.runStats);
      }

      if (json.error && !json.reportText) {
        if (json.runStats) {
          setQuickExamRunDetail((d) => ({ ...d, stats: json.runStats ?? d.stats }));
        }
        throw new Error(json.error);
      }
      if (!json.reportText?.trim()) {
        throw new Error(json.message ?? json.error ?? "未返回报告正文");
      }

      setQuickExamReportText(json.reportText);
      setSelectedHistoryJobId(null);
      if (typeof window !== "undefined") {
        localStorage.setItem(quickExamReportStorageKey(token), json.reportText);
        window.dispatchEvent(
          new CustomEvent("lexcheck:quick-exam-history-updated", { detail: { token } })
        );
      }
      void refreshQuickExamHistory();

      if (json.runStats) {
        setQuickExamRunDetail((d) => ({ ...d, stats: json.runStats ?? d.stats }));
      }

      if (process.env.NODE_ENV === "development") {
        console.info("[quick-exam]", {
          async: json.async,
          runStats: json.runStats,
          progress: json.progress,
        });
      }

      setMsg("快速体检报告已生成");
    } catch (e) {
      setErr(String(e));
    } finally {
      setQuickExamGenBusy(false);
      setQuickExamRunDetail((d) => {
        if (d.startedAt == null) return d;
        if (d.endedAt != null) return d;
        return { ...d, endedAt: Date.now() };
      });
    }
  }

  async function exportQuickExamReportDocx() {
    const text = quickExamReportText.trim();
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

  async function loadHistoryReport(jobId: string) {
    setErr(null);
    try {
      const res = await fetch(
        `/api/lawyer/checkups/${encodeURIComponent(token)}/quick-exam-report/history/${encodeURIComponent(jobId)}`
      );
      if (!res.ok) throw new Error("获取历史报告失败");
      const json = (await res.json()) as { job?: { reportText?: string } };
      const text = json.job?.reportText?.trim();
      if (!text) throw new Error("历史报告内容为空");
      setQuickExamReportText(text);
      setSelectedHistoryJobId(jobId);
    } catch (e) {
      setErr(String(e));
    }
  }

  return (
    <div className="flex min-h-[60vh] flex-col rounded-lg border bg-card shadow-sm">
      <div className="flex flex-wrap gap-1 border-b px-2 pt-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "relative rounded-t-md px-3 py-2 text-xs font-medium transition-colors sm:text-sm",
              tab === t.id
                ? "text-foreground after:absolute after:bottom-0 after:left-2 after:right-2 after:h-0.5 after:rounded-full after:bg-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {tab === "overview" && (
          <div className="space-y-4">
            <Card className="p-4">
              <div className="text-sm font-semibold">概况</div>
              <dl className="mt-3 space-y-2 text-xs">
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">企业名称</dt>
                  <dd className="text-right font-medium">{companyName?.trim() || "未填写"}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">问卷状态</dt>
                  <dd>{questionnaireStatus === "submitted" ? "已提交" : "草稿"}</dd>
                </div>
              </dl>
            </Card>
            <div className="overflow-hidden rounded-lg border border-border/80 bg-background/40">
              <div className="flex items-stretch gap-1 border-b border-border/50 bg-muted/15 px-2 py-1.5 sm:px-3">
                <button
                  type="button"
                  onClick={() => setQDetailOpen((o) => !o)}
                  className="flex min-w-0 flex-1 items-center gap-2 rounded-md py-1 text-left text-sm font-medium leading-tight text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span
                    className={`shrink-0 text-muted-foreground transition-transform ${
                      qDetailOpen ? "rotate-90" : ""
                    }`}
                    aria-hidden
                  >
                    ›
                  </span>
                  <span className="min-w-0 truncate">问卷详情</span>
                </button>
                <div className="flex shrink-0 items-center gap-1 border-l border-border/60 pl-1.5">
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
                </div>
              </div>
              {qDetailOpen ? (
                <div className="space-y-3 px-3 py-3 text-xs">
                  <QuestionnaireCompactText sections={sections} answers={answers} mode={qDetailMode} />
                </div>
              ) : null}
            </div>
            <div className="overflow-hidden rounded-lg border border-border/80 bg-background/40">
              <div className="flex items-stretch gap-1 border-b border-border/50 bg-muted/15 px-2 py-1.5 sm:px-3">
                <div className="flex min-w-0 flex-1 items-center py-1 text-left text-sm font-medium leading-tight text-foreground">
                  <span className="min-w-0 truncate">快速体检报告</span>
                </div>
                <div className="flex shrink-0 items-center gap-0.5 border-l border-border/60 pl-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    title="提示词和模板配置"
                    onClick={(e) => {
                      e.preventDefault();
                      setSettingsOpenKey(LEXCHECK_QUICK_EXAM_SECTION_KEY);
                    }}
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    title="快速生成"
                    disabled={quickExamGenBusy}
                    onClick={(e) => {
                      e.preventDefault();
                      void generateQuickExamReport();
                    }}
                  >
                    {quickExamGenBusy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    title="导出 Word"
                    disabled={!quickExamReportText.trim()}
                    onClick={(e) => {
                      e.preventDefault();
                      void exportQuickExamReportDocx();
                    }}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="px-3 py-3 text-xs">
                {/* 历史报告选择器 */}
                {!historyLoading && quickExamHistory.length > 0 && (
                  <div className="mb-2 flex flex-wrap items-center gap-2 rounded-md border border-border/60 bg-muted/20 px-2.5 py-2 text-[11px]">
                    <span className="shrink-0 text-muted-foreground">历史记录</span>
                    <select
                      className="min-w-0 flex-1 rounded border bg-background px-1.5 py-1 text-[11px] text-foreground"
                      value={selectedHistoryJobId ?? ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (!val) {
                          setSelectedHistoryJobId(null);
                          if (typeof window !== "undefined") {
                            setQuickExamReportText(
                              localStorage.getItem(quickExamReportStorageKey(token)) ?? ""
                            );
                          }
                        } else {
                          void loadHistoryReport(val);
                        }
                      }}
                    >
                      <option value="">最新生成</option>
                      {quickExamHistory.map((job) => (
                        <option key={job.id} value={job.id}>
                          {new Date(job.createdAt).toLocaleString()}
                          {job.mode === "sync_full" ? "（同步）" : "（分块）"}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {quickExamRunDetail.startedAt != null ? (
                  <div className="mb-2 space-y-1.5 rounded-md border border-border/60 bg-muted/30 px-2.5 py-2 text-[11px] leading-snug text-muted-foreground">
                    <div className="font-semibold text-foreground">本次生成过程</div>
                    {quickExamRunDetail.stats ? (
                      <>
                        <div>
                          <span className="text-muted-foreground">阶段：</span>
                          <span className="text-foreground">
                            {quickExamPhaseLabel(quickExamRunDetail.stats.phase)}
                          </span>
                          {quickExamRunDetail.stats.mode === "async_chunk" &&
                          quickExamRunDetail.stats.totalChunksPlanned > 0
                            ? `（${quickExamRunDetail.stats.chunksCompleted}/${quickExamRunDetail.stats.totalChunksPlanned} 块）`
                            : null}
                        </div>
                        <div>
                          <span className="text-muted-foreground">切块：</span>
                          计划 {quickExamRunDetail.stats.totalChunksPlanned} 块
                          {quickExamRunDetail.stats.mode === "async_chunk"
                            ? ` · 已处理 ${quickExamRunDetail.stats.chunksCompleted} 块`
                            : "（同步路径未逐块请求模型，上数为文本切块计划）"}
                        </div>
                        <div>
                          <span className="text-muted-foreground">LLM 接口：</span>
                          分块阶段 {quickExamRunDetail.stats.llmHttpCallsChunk} 次（含解析重试）
                          {" · "}
                          终稿 {quickExamRunDetail.stats.llmHttpCallsFinal} 次
                          {" · "}
                          合计 {quickExamRunDetail.stats.llmHttpCallsTotal} 次
                        </div>
                      </>
                    ) : (
                      <div>正在连接服务…</div>
                    )}
                    <div>
                      <span className="text-muted-foreground">耗时：</span>
                      {formatQuickExamDuration(
                        (quickExamRunDetail.endedAt ?? Date.now()) - quickExamRunDetail.startedAt
                      )}
                      {quickExamGenBusy ? " · 进行中" : " · 已结束"}
                    </div>
                  </div>
                ) : null}
                {quickExamReportText.trim() ? (
                  <div
                    ref={quickExamReportBodyRef}
                    className="max-h-[min(78vh,40rem)] min-h-[50vh] overflow-y-auto"
                  >
                    <QuickExamReportMarkdown markdown={quickExamReportText} />
                  </div>
                ) : (
                  <div className="flex min-h-[50vh] flex-col">
                    <p className="text-muted-foreground">
                      尚未生成。请点击「快速生成」：当前大模型配置会读取「prompt.md / output.md」、中间列「三方速查」已上传文件（解析正文）及问卷数据，生成简要版报告。生成前可在「提示词和模板配置」中编辑模版。
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === "extract" && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              以下为已上传文件。列表中不会直接展示附件原文；点击「AI 提取」后，才把文件内容与提取规则发送给大模型并在此显示返回的关键内容。上传请使用中间列「详细资料」。
            </p>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={expandAllExtract}
                disabled={attachmentRows.length === 0}
              >
                全部展开
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={collapseAllExtract}
                disabled={attachmentRows.length === 0}
              >
                全部折叠
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-8 text-xs"
                disabled={extractAllBusy || attachmentRows.length === 0}
                onClick={() => void runExtractAll()}
              >
                {extractAllBusy ? (
                  <>
                    <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />
                    AI提取中…
                  </>
                ) : (
                  "全部AI提取"
                )}
              </Button>
            </div>
            {attachmentRows.length === 0 ? (
              <p className="text-xs text-muted-foreground">暂无上传文件。</p>
            ) : (
              attachmentRows.map((a, i) => {
                const open = openExtractIndices.has(i);
                const busy = extractingIds.has(a.id);
                const aiText = (aiExtractById[a.id] ?? "").trim();
                return (
                  <div
                    key={a.id}
                    className="overflow-hidden rounded-lg border border-border/80 bg-background/40"
                  >
                    <div className="flex items-stretch gap-1 border-b border-border/50 bg-muted/15 px-2 py-1.5 sm:px-3">
                      <button
                        type="button"
                        onClick={() => toggleExtractIndex(i)}
                        className="flex min-w-0 flex-1 items-center gap-2 rounded-md py-1 text-left text-sm font-medium leading-tight outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span
                          className={`shrink-0 text-muted-foreground transition-transform ${
                            open ? "rotate-90" : ""
                          }`}
                          aria-hidden
                        >
                          ›
                        </span>
                        <span className="min-w-0 truncate" title={a.fileName}>
                          {a.fileName}
                        </span>
                      </button>
                      <div className="flex shrink-0 items-center gap-1 border-l border-border/60 pl-1.5 text-xs text-muted-foreground">
                        {aiText ? (
                          <span className="hidden sm:inline">AI关键内容 {aiText.length} 字</span>
                        ) : null}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          title="提取规则设置"
                          onClick={(e) => {
                            e.preventDefault();
                            setExtractRuleDraft(readAttachmentExtractRule(token, a.id));
                            setExtractRuleOpenId(a.id);
                          }}
                        >
                          <SlidersHorizontal className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          title="单个AI提取"
                          disabled={busy || extractAllBusy}
                          onClick={(e) => {
                            e.preventDefault();
                            void runExtractOneAi(a.id);
                          }}
                        >
                          {busy ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                    {open ? (
                      <div className="space-y-3 px-3 py-3 text-xs">
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
                          <span>上传：{new Date(a.createdAt).toLocaleString()}</span>
                          {a.updatedAt ? (
                            <span>最近解析：{new Date(a.updatedAt).toLocaleString()}</span>
                          ) : null}
                        </div>
                        {a.extractError ? (
                          <p className="rounded-md border border-destructive/40 bg-destructive/5 px-2 py-2 text-destructive">
                            {a.extractError}
                          </p>
                        ) : null}
                        <div className="space-y-1">
                          <div className="text-muted-foreground">AI提取关键内容</div>
                          <div className="max-h-52 overflow-y-auto rounded-md border bg-muted/15 p-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-muted-foreground">
                            {aiText || "（暂无结果，可点击右上角「AI提取」生成关键内容）"}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        )}

        {tab === "segments" && (
          <div className="space-y-2">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={expandAllSections}
              >
                全部展开
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={collapseAllSections}
              >
                全部折叠
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-8 text-xs"
                disabled={autoGenBusy}
                onClick={() => void autoGenerateAllSections()}
              >
                {autoGenBusy ? (
                  <>
                    <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />
                    生成中…
                  </>
                ) : (
                  "全部自动生成"
                )}
              </Button>
            </div>
            {DD_REPORT_SECTIONS.map((section, i) => {
              const open = openSectionIndices.has(i);
              const draft = draftByKey[section.key];
              const busy = generatingKeys.has(section.key);
              const draftText = draft?.draftText ?? "";
              const reviewedVal =
                reviewEdits[section.key] ?? (draft ? draft.reviewedText || draft.draftText : "");
              return (
                <div
                  key={section.key}
                  className="overflow-hidden rounded-lg border border-border/80 bg-background/40"
                >
                  <div className="flex items-stretch gap-1 border-b border-border/50 bg-muted/15 px-2 py-1.5 sm:px-3">
                    <button
                      type="button"
                      onClick={() => toggleSectionIndex(i)}
                      className="flex min-w-0 flex-1 items-center gap-2 rounded-md py-1 text-left text-sm font-medium leading-tight outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span
                        className={`shrink-0 text-muted-foreground transition-transform ${
                          open ? "rotate-90" : ""
                        }`}
                        aria-hidden
                      >
                        ›
                      </span>
                      <span className="min-w-0 truncate">{section.name}</span>
                    </button>
                    <div className="flex shrink-0 items-center gap-0.5 border-l border-border/60 pl-1.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        title="本段提示与输出要点"
                        onClick={(e) => {
                          e.preventDefault();
                          const key = section.key;
                          ensureDdSegmentTemplateSeeded(token, key);
                          setSegDialogPrompt(localStorage.getItem(segmentPromptStorageKey(token, key)) ?? "");
                          setSegDialogOutput(localStorage.getItem(segmentOutputStorageKey(token, key)) ?? "");
                          setSettingsOpenKey(key);
                        }}
                      >
                        <SlidersHorizontal className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        title="生成本段草稿"
                        disabled={busy || autoGenBusy}
                        onClick={(e) => {
                          e.preventDefault();
                          void generateSection(section.key);
                        }}
                      >
                        {busy ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  {open ? (
                    <div className="space-y-3 px-3 py-3 text-xs">
                      {!draft ? (
                        <p className="leading-relaxed text-muted-foreground">
                          尚无草稿。点击标题行右侧星形图标生成本段，或使用上方「全部自动生成」。
                        </p>
                      ) : (
                        <>
                          <div className="space-y-1">
                            <div className="text-muted-foreground">草稿正文</div>
                            <div className="max-h-40 overflow-y-auto rounded-md border bg-muted/15 p-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-muted-foreground">
                              {draftText || "（空）"}
                            </div>
                          </div>
                          <label className="block space-y-1">
                            <span className="text-muted-foreground">人工修订</span>
                            <Textarea
                              value={reviewedVal}
                              onChange={(e) =>
                                setReviewEdits((prev) => ({
                                  ...prev,
                                  [section.key]: e.target.value,
                                }))
                              }
                              className="min-h-28 text-xs leading-relaxed"
                              placeholder="在此修订本段后保存；最终报告汇总时优先采用修订稿。"
                            />
                          </label>
                          <div className="flex flex-wrap items-center gap-3">
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              disabled={savingKey === section.key}
                              onClick={() => void saveReviewed(section.key)}
                            >
                              {savingKey === section.key ? "保存中…" : "保存修订"}
                            </Button>
                            <label className="flex cursor-pointer items-center gap-2 text-muted-foreground">
                              <Checkbox
                                checked={draft.included}
                                onCheckedChange={(v) => {
                                  if (v === "indeterminate") return;
                                  void setDraftIncluded(section.key, Boolean(v));
                                }}
                              />
                              <span>纳入最终报告汇总</span>
                            </label>
                            <span className="ml-auto text-[11px] text-muted-foreground">
                              更新：{new Date(draft.updatedAt).toLocaleString()}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}

        {tab === "summary" && (
          <div className="space-y-4">
            <LawyerAiPanel token={token} />
          </div>
        )}

        {tab === "report" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">尽调报告输出</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  汇总已勾选的分部草稿，生成最终报告文本。
                </p>
              </div>
              <Button type="button" size="sm" onClick={() => void finalizeReport()} disabled={finalizing}>
                {finalizing ? "生成中…" : "生成最终报告"}
              </Button>
            </div>
            <label className="block space-y-1">
              <span className="text-sm text-muted-foreground">最终报告补充指令（可选）</span>
              <Textarea
                value={noteInstruction}
                onChange={(e) => setNoteInstruction(e.target.value)}
                className="min-h-20"
                placeholder="例如：注意强调股权代持风险并补充执行优先级。"
              />
            </label>
            {finalReport && (
              <Card className="p-4">
                <div className="text-sm font-medium">最终体检报告</div>
                <div className="mt-2 whitespace-pre-wrap text-sm">{finalReport.reportText}</div>
                <div className="mt-4 text-sm font-medium">其他注意事项</div>
                <div className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                  {finalReport.notesText || "暂无"}
                </div>
              </Card>
            )}
          </div>
        )}

        {(err || msg) && (
          <Card className="mt-4 p-3 text-sm">
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
        sectionTitle={
          settingsOpenKey
            ? settingsOpenKey === LEXCHECK_QUICK_EXAM_SECTION_KEY
              ? "快速体检报告"
              : (DD_REPORT_SECTIONS.find((s) => s.key === settingsOpenKey)?.name ?? settingsOpenKey)
            : ""
        }
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
        variant={
          settingsOpenKey === LEXCHECK_QUICK_EXAM_SECTION_KEY ? "quickExam" : "segment"
        }
      />

      <AlertDialog open={extractRuleOpenId !== null} onOpenChange={(o) => !o && setExtractRuleOpenId(null)}>
        <AlertDialogContent className="max-w-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>提取规则设置</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="space-y-2 text-xs text-muted-foreground">
            <p>该规则仅作用于当前附件的「单个AI提取」。为空时使用系统默认提取规则。</p>
            <p>
              当前文件：
              <span className="text-foreground">
                {extractRuleOpenId
                  ? attachmentRows.find((r) => r.id === extractRuleOpenId)?.fileName ?? "未知文件"
                  : "—"}
              </span>
            </p>
          </div>
          <Textarea
            value={extractRuleDraft}
            onChange={(e) => setExtractRuleDraft(e.target.value)}
            className="min-h-[40vh]"
            placeholder="例如：仅提取与股权结构、重大合同、诉讼仲裁相关的信息；按“事实-依据-风险”结构输出。"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <Button
              type="button"
              onClick={() => {
                if (!extractRuleOpenId) return;
                const key = attachmentExtractRuleStorageKey(token, extractRuleOpenId);
                const next = extractRuleDraft.trim();
                if (next) localStorage.setItem(key, next);
                else localStorage.removeItem(key);
                setExtractRuleOpenId(null);
                setMsg("提取规则已保存");
              }}
            >
              保存规则
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
