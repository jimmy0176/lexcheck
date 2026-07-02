import path from "node:path";
import { readFile } from "node:fs/promises";
import type { PrismaClient } from "@prisma/client";
import type { Answers, QuestionnaireConfig } from "@/lib/questionnaire-types";
import {
  assembleAllModules,
  buildModulesMarkdown,
  extractOtherAnswers,
  DEFAULT_PRIORITY_THRESHOLDS,
  type PriorityThresholds,
} from "@/lib/checkup-report-assemble";
import { callChatCompletions, jsonObjectFormatIfSupported } from "@/lib/quick-exam-llm";
import { parseJsonLenient } from "@/lib/quick-exam-json";

const REPORT_ISSUER_NAME = "HE Partners";

const SUMMARY_SYSTEM =
  "你是谨慎、务实的企业法律顾问，负责为律所撰写体检报告中的两个片段：「报告摘要」与「重点整改顺序建议」。\n\n" +
  "报告正文的各模块风险点已经由系统按问卷答案逐条拼装完成，不需要你生成，也不会提供给你——你只会拿到每个模块的名称、得分、优先级，以及客户自述的两个问题。\n\n" +
  "【硬性约束】\n" +
  "- 只能使用提供的模块名称、分数、优先级和客户自述内容，禁止编造具体法律风险事实、禁止提及未在列表中出现的模块。\n" +
  "- 简体中文，语气专业克制，不夸大风险。\n" +
  "- 只输出一个 JSON 对象，键为 summary 和 actionPlan，不要 Markdown 代码围栏，不要多余的键。\n\n" +
  "【summary 要求】\n" +
  "2-4 句话，概述整体合规态势，优先点出优先级为「高」「中高」的模块（若存在），语言面向企业客户。\n\n" +
  "【actionPlan 要求】\n" +
  "按「第一阶段（1 个月内）」「第二阶段（2-3 个月内）」「第三阶段（3-6 个月内）」三段整理，每段以 **加粗标题** 开头。\n" +
  "分配规则：优先级「高」的模块放入第一阶段，「中高」放入第二阶段，「中」「低」放入第三阶段；某阶段没有对应模块时可省略该阶段或注明「无紧迫事项」。\n" +
  "只提模块名称和处理方向，不复述具体风险细节。";

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
  thresholds?: PriorityThresholds;
}): Promise<{ reportText: string; moduleCount: number }> {
  const { prisma, token, promptMd, outputMd, base, apiKey, model, providerId } = opts;
  const thresholds = opts.thresholds ?? DEFAULT_PRIORITY_THRESHOLDS;

  const checkup = await prisma.checkup.findUnique({ where: { token } });
  if (!checkup) throw new Error("not_found");

  const config = await readQuestionnaireConfig();
  const answers = (checkup.answersJson ?? {}) as Answers;

  const modules = assembleAllModules(config, answers, thresholds);
  const otherAnswers = extractOtherAnswers(config, answers);

  const factsPayload = {
    modules: modules.map((m) => ({
      title: m.title,
      score: m.score,
      maxScore: m.maxScore,
      priority: m.priority,
    })),
    clientTopIssue: otherAnswers.topIssue || "（未填写）",
    clientNextThreeYears: otherAnswers.nextThreeYears || "（未填写）",
  };

  const messages: Array<{ role: "system" | "user"; content: string }> = [
    { role: "system", content: SUMMARY_SYSTEM },
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
    max_tokens: 1500,
    response_format: fmt,
  });

  let summary = "";
  let actionPlan = "";
  try {
    const parsed = parseJsonLenient(raw) as { summary?: string; actionPlan?: string };
    summary = (parsed.summary ?? "").trim();
    actionPlan = (parsed.actionPlan ?? "").trim();
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
    modules.length > 0 ? buildModulesMarkdown(modules) : "本次体检未发现需要重点关注的合规风险项。";

  const reportText = [
    "## 企业法律顾问体检报告",
    "",
    `**委托方：**${companyName}　**出具单位：**${REPORT_ISSUER_NAME}　**出具日期：**${issueDate}`,
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
    data: { checkupId: checkup.id, status: "success", mode: "assembled", progressJson: {}, reportText },
  });

  return { reportText, moduleCount: modules.length };
}
