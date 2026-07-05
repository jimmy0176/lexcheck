import path from "node:path";
import { readFile } from "node:fs/promises";
import type { PrismaClient } from "@prisma/client";
import type { Answers, QuestionnaireConfig } from "@/lib/questionnaire-types";
import {
  assembleAllModules,
  buildModulesMarkdown,
  computeTotalScore,
  extractOtherAnswers,
  DEFAULT_PRIORITY_THRESHOLDS,
  type ModuleAssembly,
  type PriorityThresholds,
} from "@/lib/checkup-report-assemble";
import { callChatCompletions, jsonObjectFormatIfSupported } from "@/lib/quick-exam-llm";
import { parseJsonLenient } from "@/lib/quick-exam-json";

const REPORT_ISSUER_NAME = "HE Partners";

export type ReportGenerationMode = "concat" | "fusion";

const SUMMARY_SYSTEM =
  "你是谨慎、务实的企业法律顾问，负责为律所撰写体检报告中的两个片段：「报告摘要」与「重点整改顺序建议」。\n\n" +
  "报告正文的各模块风险点已经由系统按问卷答案逐条拼装完成，不需要你生成，也不会提供给你——你只会拿到每个模块的名称、得分、优先级，以及客户自述的两个问题。\n\n" +
  "【硬性约束】\n" +
  "- 只能使用提供的模块名称、分数、优先级和客户自述内容，禁止编造具体法律风险事实、禁止提及未在列表中出现的模块。\n" +
  "- 简体中文，语气专业克制，不夸大风险。\n" +
  "- 只输出一个 JSON 对象，键为 summary 和 actionPlan，两个键的值都必须是字符串（不能是嵌套对象或数组），不要 Markdown 代码围栏，不要多余的键。\n\n" +
  "【summary 要求】\n" +
  "2-4 句话，概述整体合规态势，优先点出优先级为「高」「中高」的模块（若存在），语言面向企业客户。\n\n" +
  "【actionPlan 要求】\n" +
  "值必须是一个字符串，内部按「第一阶段（1 个月内）」「第二阶段（2-3 个月内）」「第三阶段（3-6 个月内）」三段整理，每段以 **加粗标题** 开头，段落之间用换行分隔。\n" +
  "分配规则：优先级「高」的模块放入第一阶段，「中高」放入第二阶段，「中」「低」放入第三阶段；某阶段没有对应模块时可省略该阶段或注明「无紧迫事项」。\n" +
  "只提模块名称和处理方向，不复述具体风险细节。";

const FUSION_SYSTEM =
  "你是谨慎、务实的企业法律顾问，负责为律所撰写体检报告的三个片段：「报告摘要」「各模块风险评估正文」与「重点整改顺序建议」。\n\n" +
  "每个模块命中的风险点已经由系统按问卷答案逐条整理完成（每条包含：具体问题、预设风险描述、预设整改建议），随「模块事实」一并提供给你。\n\n" +
  "【硬性约束】\n" +
  "- moduleBodies 只能整合、精简、润色已提供的风险点内容，禁止编造未提供的风险事实、禁止提及列表之外的风险点、禁止做超出原文范围的分析扩展。\n" +
  "- 每个模块正文应比把风险点逐条罗列更精简，用连贯的一段或两段文字整合表达，不需要保留原有的逐条编号格式，也不需要重复模块名称和分数。\n" +
  "- 简体中文，语气专业克制，不夸大风险。\n" +
  "- 只输出一个 JSON 对象，键为 summary、moduleBodies、actionPlan；summary 和 actionPlan 的值必须是字符串（不能是嵌套对象或数组），不要 Markdown 代码围栏，不要多余的键。\n\n" +
  "【summary 要求】\n" +
  "2-4 句话，概述整体合规态势，优先点出优先级为「高」「中高」的模块（若存在），语言面向企业客户。\n\n" +
  "【moduleBodies 要求】\n" +
  "是一个 JSON 对象，键为模块在列表中的序号（从 0 开始的字符串，如 \"0\"、\"1\"），值为该模块整合润色后的风险评估正文（字符串）。\n\n" +
  "【actionPlan 要求】\n" +
  "值必须是一个字符串，内部按「第一阶段（1 个月内）」「第二阶段（2-3 个月内）」「第三阶段（3-6 个月内）」三段整理，每段以 **加粗标题** 开头，段落之间用换行分隔。\n" +
  "分配规则：优先级「高」的模块放入第一阶段，「中高」放入第二阶段，「中」「低」放入第三阶段；某阶段没有对应模块时可省略该阶段或注明「无紧迫事项」。\n" +
  "只提模块名称和处理方向，不复述具体风险细节。";

/** LLM 偶尔会把本应是字符串的字段返回成嵌套对象；尽量从中恢复文本而不是整体报废这次解析。 */
function coerceToText(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (v && typeof v === "object") {
    return Object.entries(v as Record<string, unknown>)
      .map(([k, val]) => `**${k}**：${typeof val === "string" ? val.trim() : JSON.stringify(val)}`)
      .join("\n\n");
  }
  return "";
}

function buildFusionModulesMarkdown(modules: ModuleAssembly[], bodies: Record<string, string>): string {
  return modules
    .map((m, i) => {
      const body = (bodies[String(i)] ?? "").trim() || m.bodyMarkdown;
      return `### ${m.title}模块　优先级：${m.priority}（${m.score}/${m.maxScore} 分）\n\n${body}`;
    })
    .join("\n\n");
}

const DISCLAIMER_TEXT =
  "本报告基于贵公司在体检问卷中提供的信息进行初步梳理和风险提示，不构成正式法律意见，亦不能替代律师就具体事项出具的专项法律意见书。" +
  "如需就报告中涉及的具体风险采取行动，请与出具律师团队进一步沟通，由律师团队结合具体情况提供专项服务方案。";

async function readQuestionnaireConfig(): Promise<QuestionnaireConfig> {
  const filePath = path.join(process.cwd(), "public", "questionnaire.json");
  const raw = await readFile(filePath, "utf-8");
  return JSON.parse(raw) as QuestionnaireConfig;
}

export async function generateCheckupReport(opts: {
  prisma: PrismaClient;
  token: string;
  promptMd: string;
  outputMd: string;
  base: string;
  apiKey: string;
  model: string;
  providerId: string;
  mode?: ReportGenerationMode;
  thresholds?: PriorityThresholds;
}): Promise<{ reportText: string; moduleCount: number }> {
  const { prisma, token, promptMd, outputMd, base, apiKey, model, providerId } = opts;
  const thresholds = opts.thresholds ?? DEFAULT_PRIORITY_THRESHOLDS;
  const mode: ReportGenerationMode = opts.mode ?? "concat";

  const checkup = await prisma.checkup.findUnique({ where: { token } });
  if (!checkup) throw new Error("not_found");

  const config = await readQuestionnaireConfig();
  const answers = (checkup.answersJson ?? {}) as Answers;

  const modules = assembleAllModules(config, answers, thresholds);
  const totalScore = computeTotalScore(config, answers, thresholds);
  const otherAnswers = extractOtherAnswers(config, answers);

  const factsPayload = {
    modules: modules.map((m) => ({
      title: m.title,
      score: m.score,
      maxScore: m.maxScore,
      priority: m.priority,
      ...(mode === "fusion" ? { riskItems: m.riskItems } : {}),
    })),
    clientTopIssue: otherAnswers.topIssue || "（未填写）",
    clientNextThreeYears: otherAnswers.nextThreeYears || "（未填写）",
  };

  const messages: Array<{ role: "system" | "user"; content: string }> = [
    { role: "system", content: mode === "fusion" ? FUSION_SYSTEM : SUMMARY_SYSTEM },
  ];
  if (promptMd.trim()) {
    messages.push({ role: "user", content: `【补充语气/角色指引】\n\n${promptMd}` });
  }
  if (outputMd.trim()) {
    messages.push({ role: "user", content: `【补充格式要求】\n\n${outputMd}` });
  }
  messages.push({
    role: "user",
    content: `【模块事实与客户自述】\n\n${JSON.stringify(factsPayload, null, 2)}`,
  });

  const fmt = jsonObjectFormatIfSupported(providerId);
  const raw = await callChatCompletions({
    base,
    apiKey,
    model,
    messages,
    temperature: 0.3,
    max_tokens: mode === "fusion" ? 3000 : 1500,
    response_format: fmt,
  });

  let summary = "";
  let actionPlan = "";
  const moduleBodies: Record<string, string> = {};
  try {
    const parsed = parseJsonLenient(raw) as {
      summary?: unknown;
      actionPlan?: unknown;
      moduleBodies?: unknown;
    };
    summary = coerceToText(parsed.summary);
    actionPlan = coerceToText(parsed.actionPlan);
    if (parsed.moduleBodies && typeof parsed.moduleBodies === "object") {
      for (const [k, v] of Object.entries(parsed.moduleBodies as Record<string, unknown>)) {
        const text = coerceToText(v);
        if (text) moduleBodies[k] = text;
      }
    }
  } catch {
    summary = raw.trim();
  }
  if (!summary) summary = "（未生成摘要）";
  if (!actionPlan) {
    actionPlan = "（未生成整改顺序建议，请参考各模块优先级自行安排处理顺序。）";
  }

  const companyName = checkup.companyName?.trim() || "（未填写公司名称）";
  const issueDate = new Date().toLocaleDateString("zh-CN");
  const modulesMarkdown =
    modules.length === 0
      ? "本次体检未发现需要重点关注的合规风险项。"
      : mode === "fusion"
        ? buildFusionModulesMarkdown(modules, moduleBodies)
        : buildModulesMarkdown(modules);

  const totalScorePct = Math.round(totalScore.ratio * 100);

  const reportText = [
    "## 企业法律顾问体检报告",
    "",
    `**委托方：**${companyName}　**出具单位：**${REPORT_ISSUER_NAME}　**出具日期：**${issueDate}`,
    "",
    `**总分：**${totalScore.score}/${totalScore.maxScore}（${totalScorePct}%）　**整体评价：**${totalScore.healthLabel}`,
    "",
    "### 报告摘要",
    "",
    summary,
    "",
    modulesMarkdown,
    "",
    "### 重点整改顺序建议",
    "",
    actionPlan,
    "",
    "### 免责声明",
    "",
    DISCLAIMER_TEXT,
  ].join("\n");

  await prisma.quickExamReportJob.create({
    data: {
      checkupId: checkup.id,
      status: "success",
      mode: mode === "fusion" ? "assembled_fusion" : "assembled_concat",
      progressJson: {},
      reportText,
    },
  });

  return { reportText, moduleCount: modules.length };
}
