import path from "node:path";
import { readFile } from "node:fs/promises";
import type { Answers, QuestionnaireConfig } from "@/lib/questionnaire-types";
import { buildQuickExamQuestionnaireNarrative } from "@/lib/quick-exam-input";
import {
  QUICK_EXAM_CHUNKS_PER_STEP,
  QUICK_EXAM_QUESTIONNAIRE_MAX_CHARS,
  QUICK_EXAM_SYNC_MAX_FILES,
  QUICK_EXAM_SYNC_MAX_TOTAL_CHARS,
} from "@/lib/quick-exam-constants";
import { callChatCompletions, jsonObjectFormatIfSupported } from "@/lib/quick-exam-llm";
import { parsePreliminaryChunkSummaryJson } from "@/lib/quick-exam-json";
import {
  mergePreliminarySummaries,
  mergedSummaryToNarrative,
  type PreliminaryChunkSummary,
} from "@/lib/quick-exam-preliminary-summary-types";
import {
  buildPreliminaryChunkPlan,
  buildPreliminaryFullNarrative,
  loadPreliminaryAttachmentBodies,
  type PlannedPreliminaryChunk,
  type PreliminaryFileBody,
} from "@/lib/quick-exam-preliminary";
import { truncateForPrompt } from "@/lib/checkup-attachments";
import type { PrismaClient } from "@prisma/client";

export type QuickExamJobStatusName = "pending" | "running" | "success" | "failed";

export type QuickExamProgressJson = {
  version: 1;
  fileCount: number;
  totalChunks: number;
  chunkCursor: number;
  usedChunkPipeline: boolean;
  files: Array<{ fileName: string; chunkCount: number; chunked: boolean }>;
  stage: "chunks" | "final" | "done";
  summaries: PreliminaryChunkSummary[];
  mergedSummaryChars?: number;
  /** 分块摘要阶段累计 chat/completions 调用次数（含 JSON 解析失败后的重试） */
  llmHttpCallsChunk?: number;
  /** 终稿阶段 chat/completions 调用次数（成功为 1） */
  llmHttpCallsFinal?: number;
};

/** 单次生成过程统计（同步/异步均返回，便于前端展示） */
export type QuickExamRunStats = {
  mode: "sync_full" | "async_chunk";
  /** 切块计划总块数；同步路径为计划块数（未逐块调模型） */
  totalChunksPlanned: number;
  /** 分块摘要阶段已完成的块数 */
  chunksCompleted: number;
  /** 分块阶段 LLM HTTP 调用次数（含重试） */
  llmHttpCallsChunk: number;
  /** 终稿 LLM HTTP 调用次数 */
  llmHttpCallsFinal: number;
  llmHttpCallsTotal: number;
  /** 当前阶段（展示用） */
  phase: "chunk_summaries" | "final_report" | "completed" | "failed";
};

export function buildRunStats(input: {
  mode: QuickExamRunStats["mode"];
  totalChunksPlanned: number;
  chunksCompleted: number;
  llmHttpCallsChunk: number;
  llmHttpCallsFinal: number;
  phase: QuickExamRunStats["phase"];
}): QuickExamRunStats {
  return {
    ...input,
    llmHttpCallsTotal: input.llmHttpCallsChunk + input.llmHttpCallsFinal,
  };
}

export function runStatsFromProgress(
  p: QuickExamProgressJson,
  status: QuickExamJobStatusName
): QuickExamRunStats {
  const chunkCalls = p.llmHttpCallsChunk ?? 0;
  const finalCalls = p.llmHttpCallsFinal ?? 0;
  const tc = p.totalChunks;
  const cc = Math.min(p.chunkCursor, tc);
  let phase: QuickExamRunStats["phase"] = "chunk_summaries";
  if (status === "failed") phase = "failed";
  else if (p.stage === "done" && finalCalls > 0) phase = "completed";
  else if (p.stage === "final") phase = "final_report";
  else if (tc === 0 && finalCalls > 0 && p.stage === "done") phase = "completed";
  else if (cc >= tc && tc > 0 && finalCalls === 0) phase = "final_report";
  else phase = "chunk_summaries";
  return buildRunStats({
    mode: "async_chunk",
    totalChunksPlanned: tc,
    chunksCompleted: cc,
    llmHttpCallsChunk: chunkCalls,
    llmHttpCallsFinal: finalCalls,
    phase,
  });
}

export type QuickExamMeta = {
  mode: "sync_full" | "async_chunk";
  fileCount: number;
  totalChunks: number;
  usedChunkPipeline: boolean;
  files: Array<{ fileName: string; chunkCount: number; chunked: boolean }>;
  /** 终稿阶段传入的是全文还是摘要汇总 */
  preliminaryInputKind: "full_text" | "merged_summaries";
};

function normalizeBase(url: string) {
  return url.trim().replace(/\/+$/, "");
}

async function readQuestionnaireConfig(): Promise<QuestionnaireConfig> {
  const filePath = path.join(process.cwd(), "public", "questionnaire.json");
  const raw = await readFile(filePath, "utf-8");
  return JSON.parse(raw) as QuestionnaireConfig;
}

const FINAL_SYSTEM =
  "你是谨慎、务实的企业法律体检顾问，为律所起草面向客户的初步快速体检报告。\n\n" +
  "用户将依次提供：prompt.md（角色与约束）、output.md（输出骨架）、三方速查附件要点、问卷数据。\n\n" +
  "【生成规则】\n" +
  "1. 严格按 prompt.md 的角色约束与模块选择规则行事。\n" +
  "2. 严格按 output.md 的结构层级生成，output.md 有哪些节就生成哪些节，不增加任何 output.md 中没有的节（包括免责声明）。\n" +
  "3. 三方速查材料作为补充事实来源，问卷数据为核心依据；严禁编造或臆测。\n" +
  "4. 无实质内容的领域模块直接跳过，不强行生成。\n\n" +
  "【格式规则（务必遵守）】\n" +
  "- 输出为纯 Markdown，不加代码块围栏（```）。\n" +
  "- 标题只用 ## 和 ### 两级，禁止使用 # 一级标题或四级以下标题。\n" +
  "- 全文**禁止使用表格**。\n" +
  "- 每个模块：### 标题行（含优先级）→ 一句话核心结论段 → 背景说明段 → 编号建议列表。\n" +
  "- 每条建议：**加粗标题** 另起一行，再空一行接说明段落（不得将标题与说明合并为同一行）。\n" +
  "- 「重点整改顺序建议」节按阶段用加粗标题分列，不用表格，不用多级列表。\n" +
  "- 段落之间空一行；章节标题前后各空一行。";

const CHUNK_SYSTEM = `你是法律与合规尽调信息抽取助手。用户将提供「三方速查」材料的一个文本片段。请只输出一个 JSON 对象（不要 Markdown 代码围栏），键为：
sourceFileName（字符串）、chunkIndex（数字，本文件内分块序号）、basicInfo、shareholders、management、investments、changeRecords、legalRisks、businessRisks、qualifications、licenses、taxInfo、employmentInfo、ipInfo、otherImportantFindings（均为字符串数组）。
每条数组元素是一句简短中文要点；无相关信息则填「未提供」或留空数组；不要编造；若原文为「无」「0」但对风险有参考意义，也要保留。`;

function buildFinalMessages(
  promptMd: string,
  outputMd: string,
  preliminaryBlock: string,
  narrative: string
): Array<{ role: "system" | "user" | "assistant"; content: string }> {
  return [
    { role: "system", content: FINAL_SYSTEM },
    { role: "user", content: `【文件：prompt.md】\n\n${promptMd || "（空）"}` },
    { role: "user", content: `【文件：output.md】\n\n${outputMd || "（空）"}` },
    { role: "user", content: `【三方速查 · 附件要点】\n\n${preliminaryBlock}` },
    { role: "user", content: `【问卷数据】\n\n${narrative}` },
  ];
}

export function shouldUseSyncPipeline(files: PreliminaryFileBody[]): boolean {
  if (files.length === 0) return true;
  if (files.length > QUICK_EXAM_SYNC_MAX_FILES) return false;
  const total = files.reduce((s, f) => s + f.text.length, 0);
  return total <= QUICK_EXAM_SYNC_MAX_TOTAL_CHARS;
}

async function extractOneChunkSummary(opts: {
  base: string;
  apiKey: string;
  model: string;
  providerId: string;
  chunk: PlannedPreliminaryChunk;
  totalChunks: number;
}): Promise<{ summary: PreliminaryChunkSummary; llmHttpCalls: number }> {
  const { base, apiKey, model, providerId, chunk, totalChunks } = opts;
  const user = `【来源文件】${chunk.fileName}
【文件内分块序号】${chunk.chunkIndexInFile}
【全局分块】第 ${chunk.globalIndex + 1} / 共 ${totalChunks} 块

--- 正文 ---

${chunk.text}`;
  let lastErr: Error | null = null;
  let llmHttpCalls = 0;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      llmHttpCalls++;
      const fmt = jsonObjectFormatIfSupported(providerId);
      const raw = await callChatCompletions({
        base,
        apiKey,
        model,
        messages: [
          { role: "system", content: CHUNK_SYSTEM },
          { role: "user", content: user },
        ],
        temperature: 0.1,
        max_tokens: 4096,
        response_format: fmt,
      });
      const summary = parsePreliminaryChunkSummaryJson(raw, chunk.fileName, chunk.chunkIndexInFile);
      return { summary, llmHttpCalls };
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastErr ?? new Error("分块摘要失败");
}

async function generateFinalReportText(opts: {
  base: string;
  apiKey: string;
  model: string;
  promptMd: string;
  outputMd: string;
  preliminaryBlock: string;
  narrative: string;
}): Promise<{ reportText: string; llmHttpCalls: number }> {
  const { base, apiKey, model, promptMd, outputMd, preliminaryBlock, narrative } = opts;
  const messages = buildFinalMessages(promptMd, outputMd, preliminaryBlock, narrative);
  const reportText = await callChatCompletions({
    base,
    apiKey,
    model,
    messages,
    temperature: 0.25,
    max_tokens: 3200,
  });
  return { reportText, llmHttpCalls: 1 };
}

export async function runQuickExamSync(opts: {
  prisma: PrismaClient;
  token: string;
  promptMd: string;
  outputMd: string;
  base: string;
  apiKey: string;
  model: string;
}): Promise<{ reportText: string; meta: QuickExamMeta; runStats: QuickExamRunStats }> {
  const { prisma, token, promptMd, outputMd, base, apiKey, model } = opts;
  const checkup = await prisma.checkup.findUnique({ where: { token } });
  if (!checkup) throw new Error("not_found");

  const preliminaryAtts = await prisma.checkupAttachment.findMany({
    where: { checkupId: checkup.id, kind: "preliminary" },
    orderBy: { createdAt: "asc" },
    select: { fileName: true, storagePath: true },
  });
  const files = await loadPreliminaryAttachmentBodies(preliminaryAtts);
  const narrativeRaw = buildQuickExamQuestionnaireNarrative(
    await readQuestionnaireConfig(),
    (checkup.answersJson ?? {}) as Answers
  );
  const narrative = truncateForPrompt(narrativeRaw, QUICK_EXAM_QUESTIONNAIRE_MAX_CHARS);

  const preliminaryNarrative = buildPreliminaryFullNarrative(files);
  const { planned, fileStats } = buildPreliminaryChunkPlan(files);

  const meta: QuickExamMeta = {
    mode: "sync_full",
    fileCount: files.length,
    totalChunks: planned.length,
    usedChunkPipeline: false,
    files: fileStats,
    preliminaryInputKind: "full_text",
  };

  const { reportText, llmHttpCalls: finalCalls } = await generateFinalReportText({
    base,
    apiKey,
    model,
    promptMd,
    outputMd,
    preliminaryBlock: preliminaryNarrative,
    narrative,
  });

  const runStats = buildRunStats({
    mode: "sync_full",
    totalChunksPlanned: planned.length,
    chunksCompleted: planned.length,
    llmHttpCallsChunk: 0,
    llmHttpCallsFinal: finalCalls,
    phase: "completed",
  });

  await prisma.quickExamReportJob.create({
    data: { checkupId: checkup.id, status: "success", mode: "sync_full", progressJson: {}, reportText },
  });

  return { reportText, meta, runStats };
}

function emptyProgress(
  files: PreliminaryFileBody[],
  fileStats: QuickExamProgressJson["files"],
  totalChunks: number
): QuickExamProgressJson {
  return {
    version: 1,
    fileCount: files.length,
    totalChunks,
    chunkCursor: 0,
    usedChunkPipeline: true,
    files: fileStats,
    stage: "chunks",
    summaries: [],
    llmHttpCallsChunk: 0,
    llmHttpCallsFinal: 0,
  };
}

export async function createAsyncQuickExamJob(opts: {
  prisma: PrismaClient;
  checkupId: string;
}): Promise<{ jobId: string; progress: QuickExamProgressJson }> {
  const { prisma, checkupId } = opts;
  const preliminaryAtts = await prisma.checkupAttachment.findMany({
    where: { checkupId, kind: "preliminary" },
    orderBy: { createdAt: "asc" },
    select: { fileName: true, storagePath: true },
  });
  const files = await loadPreliminaryAttachmentBodies(preliminaryAtts);
  const { planned, fileStats } = buildPreliminaryChunkPlan(files);
  const progress = emptyProgress(files, fileStats, planned.length);

  const job = await prisma.quickExamReportJob.create({
    data: {
      checkupId,
      status: "running",
      mode: "async_chunk",
      progressJson: progress as object,
    },
  });
  return { jobId: job.id, progress };
}

export async function stepQuickExamJob(opts: {
  prisma: PrismaClient;
  token: string;
  jobId: string;
  promptMd: string;
  outputMd: string;
  base: string;
  apiKey: string;
  model: string;
  providerId: string;
}): Promise<{
  done: boolean;
  reportText?: string;
  error?: string;
  progress: QuickExamProgressJson;
  status: QuickExamJobStatusName;
  runStats: QuickExamRunStats;
}> {
  const { prisma, token, jobId, promptMd, outputMd, base, apiKey, model, providerId } = opts;

  const checkup = await prisma.checkup.findUnique({ where: { token } });
  if (!checkup) throw new Error("not_found");

  const job = await prisma.quickExamReportJob.findFirst({
    where: { id: jobId, checkupId: checkup.id },
  });
  if (!job) throw new Error("job_not_found");

  if (job.status === "success" && job.reportText) {
    const pj = job.progressJson as QuickExamProgressJson;
    return {
      done: true,
      reportText: job.reportText,
      progress: pj,
      status: job.status,
      runStats: runStatsFromProgress(pj, job.status),
    };
  }
  if (job.status === "failed") {
    const pj = job.progressJson as QuickExamProgressJson;
    return {
      done: true,
      error: job.errorMessage ?? "任务失败",
      progress: pj,
      status: job.status,
      runStats: runStatsFromProgress(pj, job.status),
    };
  }

  let progress = job.progressJson as QuickExamProgressJson;
  const preliminaryAtts = await prisma.checkupAttachment.findMany({
    where: { checkupId: checkup.id, kind: "preliminary" },
    orderBy: { createdAt: "asc" },
    select: { fileName: true, storagePath: true },
  });
  const files = await loadPreliminaryAttachmentBodies(preliminaryAtts);
  const { planned, fileStats } = buildPreliminaryChunkPlan(files);

  const narrativeRaw = buildQuickExamQuestionnaireNarrative(
    await readQuestionnaireConfig(),
    (checkup.answersJson ?? {}) as Answers
  );
  const narrative = truncateForPrompt(narrativeRaw, QUICK_EXAM_QUESTIONNAIRE_MAX_CHARS);

  const b = normalizeBase(base);

  try {
    if (progress.stage === "chunks" && progress.totalChunks === 0) {
      const { reportText, llmHttpCalls: fh } = await generateFinalReportText({
        base: b,
        apiKey,
        model,
        promptMd,
        outputMd,
        preliminaryBlock: "（三方速查暂无上传文件）",
        narrative,
      });
      const p: QuickExamProgressJson = {
        ...progress,
        stage: "done",
        mergedSummaryChars: 0,
        llmHttpCallsChunk: 0,
        llmHttpCallsFinal: fh,
      };
      await prisma.quickExamReportJob.update({
        where: { id: jobId },
        data: { status: "success", reportText, progressJson: p as object },
      });
      return {
        done: true,
        reportText,
        progress: p,
        status: "success",
        runStats: runStatsFromProgress(p, "success"),
      };
    }

    if (progress.stage === "chunks" && progress.chunkCursor < progress.totalChunks) {
      let cursor = progress.chunkCursor;
      const summaries = [...progress.summaries];
      let steps = 0;
      let batchHttp = 0;
      while (steps < QUICK_EXAM_CHUNKS_PER_STEP && cursor < planned.length) {
        const chunk = planned[cursor]!;
        const { summary, llmHttpCalls: h } = await extractOneChunkSummary({
          base: b,
          apiKey,
          model,
          providerId,
          chunk,
          totalChunks: planned.length,
        });
        batchHttp += h;
        summaries.push(summary);
        cursor++;
        steps++;
      }
      progress = {
        ...progress,
        chunkCursor: cursor,
        summaries,
        fileCount: files.length,
        totalChunks: planned.length,
        files: fileStats,
        llmHttpCallsChunk: (progress.llmHttpCallsChunk ?? 0) + batchHttp,
      };

      if (cursor >= planned.length) {
        const merged = mergePreliminarySummaries(summaries);
        const narrativeBlock = mergedSummaryToNarrative(merged);
        progress = {
          ...progress,
          stage: "final",
          mergedSummaryChars: narrativeBlock.length,
        };
        await prisma.quickExamReportJob.update({
          where: { id: jobId },
          data: { progressJson: progress as object, status: "running" },
        });
        // 终稿在下一轮 step 中执行，避免与最后一批分块摘要同一次 HTTP 请求内串行，
        // 否则易超过反向代理默认 60s 读超时。
        return {
          done: false,
          progress,
          status: "running",
          runStats: runStatsFromProgress(progress, "running"),
        };
      }

      await prisma.quickExamReportJob.update({
        where: { id: jobId },
        data: { progressJson: progress as object, status: "running" },
      });
      return {
        done: false,
        progress,
        status: "running",
        runStats: runStatsFromProgress(progress, "running"),
      };
    }

    if (progress.stage === "final") {
      const merged = mergePreliminarySummaries(progress.summaries);
      const narrativeBlock = mergedSummaryToNarrative(merged);
      const { reportText, llmHttpCalls: fh } = await generateFinalReportText({
        base: b,
        apiKey,
        model,
        promptMd,
        outputMd,
        preliminaryBlock: narrativeBlock,
        narrative,
      });
      progress = {
        ...progress,
        stage: "done",
        llmHttpCallsFinal: (progress.llmHttpCallsFinal ?? 0) + fh,
      };
      await prisma.quickExamReportJob.update({
        where: { id: jobId },
        data: {
          status: "success",
          reportText,
          progressJson: progress as object,
        },
      });
      return {
        done: true,
        reportText,
        progress,
        status: "success",
        runStats: runStatsFromProgress(progress, "success"),
      };
    }

    return {
      done: true,
      error: "未知任务阶段",
      progress,
      status: job.status,
      runStats: runStatsFromProgress(progress, job.status as QuickExamJobStatusName),
    };
  } catch (e) {
    const msg = String(e);
    await prisma.quickExamReportJob.update({
      where: { id: jobId },
      data: {
        status: "failed",
        errorMessage: msg,
        progressJson: progress as object,
      },
    });
    const failedProgress = progress;
    return {
      done: true,
      error: msg,
      progress: failedProgress,
      status: "failed",
      runStats: runStatsFromProgress(failedProgress, "failed"),
    };
  }
}
