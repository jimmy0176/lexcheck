import type { PrismaClient } from "@prisma/client";
import type { Answers } from "@/lib/questionnaire-types";
import {
  assembleAllModules,
  buildModulesMarkdown,
  computeTotalScore,
  extractFreeformAnswers,
  DEFAULT_PRIORITY_THRESHOLDS,
  type ModuleAssembly,
  type PriorityThresholds,
} from "@/lib/checkup-report-assemble";
import { readQuestionnaireConfigForCheckup } from "@/lib/questionnaire-templates";
import { resolveLlmProfiles, callChatCompletionsWithFallback } from "@/lib/llm-resolve";
import { parseJsonLenient } from "@/lib/quick-exam-json";

const REPORT_ISSUER_NAME = "HE Partners";

export type ReportGenerationMode = "concat" | "fusion";

const SUMMARY_SYSTEM =
  "你是谨慎、务实的企业法律顾问，负责为律所撰写体检报告中的两个片段：「报告摘要」与「重点整改顺序建议」。\n\n" +
  "报告正文的各模块风险点已经由系统按问卷答案逐条拼装完成，不需要你生成，也不会提供给你——你只会拿到每个模块的名称、得分、优先级，以及客户在开放题中的自述内容。\n\n" +
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
  "- moduleBodies 必须同时涵盖每一条风险点的「风险描述」与「整改建议」两部分内容，不能只保留风险、省略建议——即使为了精简把多条风险合并叙述，也要让每条风险对应的建议清晰保留下来。\n" +
  "- 只能整合、精简、润色已提供的风险描述与建议内容，禁止编造未提供的风险事实或建议、禁止提及列表之外的风险点、禁止做超出原文范围的分析扩展。\n" +
  "- 每个模块正文必须分成两段，用一个空行隔开：第一段以「风险分析：」开头，整合精简表达该模块命中的全部风险点；第二段以「建议：」开头，整合精简表达对应的全部整改建议。每段内部比逐条罗列更精简、可用连贯文字或简短列表，但不得省略「风险分析：」「建议：」这两个开头标签，不需要重复模块名称和分数。\n" +
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

const THIRD_PARTY_EXTRACTION_SYSTEM =
  "你是谨慎的企业法律顾问助理，负责阅读一份三方企业背景报告（如企查查/天眼查一类的企业信息核查报告）原文，为体检报告提炼两段内容。\n\n" +
  "【硬性约束】\n" +
  "- 只能使用原文中明确出现的信息，禁止编造、禁止推测、禁止补全原文没有的字段（尤其是统一社会信用代码、法定代表人、注册资本等企业登记信息，宁可少写也不能编）。\n" +
  "- 简体中文，语气专业克制，不夸大风险。\n" +
  "- 只输出一个 JSON 对象，键为 companyInfo、highlights，值都必须是字符串（不能是嵌套对象或数组），不要 Markdown 代码围栏，不要多余的键。\n\n" +
  "【companyInfo 要求】\n" +
  "用一段话概述原文中出现的企业基本信息，可包含统一社会信用代码、法定代表人、注册资本、成立日期、经营状态、股东/主要人员等——仅限原文实际出现的项，原文没有的直接省略，不要写「未提及」之类的占位说明。\n\n" +
  "【highlights 要求】\n" +
  "用一段话概述原文中值得关注的风险点或异常信息（如经营异常、失信被执行、股权出质、行政处罚、诉讼记录等），如果原文没有明显风险，如实说明企业信息正常、未发现异常。";

/** 从三方报告原文提取企业基本信息与重点风险提示；成功时缓存到附件行，避免每次生成报告都重新调用。 */
async function getThirdPartyReportSection(
  prisma: PrismaClient,
  checkup: { id: string },
  lawyerId: string
): Promise<string | null> {
  const workspace = await prisma.checkupWorkspace.findUnique({ where: { checkupId: checkup.id } });
  if (!workspace?.thirdPartyReportEnabled) return null;

  const attachment = await prisma.checkupAttachment.findFirst({
    where: { checkupId: checkup.id, kind: "thirdParty" },
    orderBy: { createdAt: "desc" },
  });
  if (!attachment?.extractedText?.trim()) return null;

  const cached = attachment.parsedSummaryJson as { companyInfo?: string; highlights?: string } | null;
  if (cached?.companyInfo || cached?.highlights) {
    return buildThirdPartyMarkdown(cached.companyInfo ?? "", cached.highlights ?? "");
  }

  const profiles = await resolveLlmProfiles(lawyerId);
  if (profiles.length === 0) return null;

  const result = await callChatCompletionsWithFallback(profiles, {
    messages: [
      { role: "system", content: THIRD_PARTY_EXTRACTION_SYSTEM },
      { role: "user", content: `【三方报告原文】\n\n${attachment.extractedText}` },
    ],
    temperature: 0.2,
    max_tokens: 1200,
    wantJson: true,
  });
  if (!result.ok) return null;

  try {
    const parsed = parseJsonLenient(result.text) as { companyInfo?: unknown; highlights?: unknown };
    const companyInfo = coerceToText(parsed.companyInfo);
    const highlights = coerceToText(parsed.highlights);
    if (!companyInfo && !highlights) return null;

    await prisma.checkupAttachment.update({
      where: { id: attachment.id },
      data: { parsedSummaryJson: { companyInfo, highlights } },
    });
    return buildThirdPartyMarkdown(companyInfo, highlights);
  } catch {
    return null;
  }
}

function buildThirdPartyMarkdown(companyInfo: string, highlights: string): string | null {
  const parts: string[] = [];
  if (companyInfo) parts.push(`基本信息：${companyInfo}`);
  if (highlights) parts.push(`重点提示：${highlights}`);
  if (parts.length === 0) return null;
  return `### 三方背景信息\n\n${parts.join("\n\n")}`;
}

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

const NO_AI_NOTICE =
  "当前律师账号、管理员共用 Key、共用备用 Key 均不可用，本报告未调用大模型，仅按问卷答案与预设风险/建议文案自动拼装，不含摘要与整改顺序建议，请人工补充。";

export async function generateCheckupReport(opts: {
  prisma: PrismaClient;
  token: string;
  lawyerId: string;
  promptMd: string;
  outputMd: string;
  mode?: ReportGenerationMode;
  thresholds?: PriorityThresholds;
}): Promise<{ reportText: string; moduleCount: number; usedAi: boolean }> {
  const { prisma, token, lawyerId, promptMd, outputMd } = opts;
  const thresholds = opts.thresholds ?? DEFAULT_PRIORITY_THRESHOLDS;
  const mode: ReportGenerationMode = opts.mode ?? "concat";

  const checkup = await prisma.checkup.findUnique({ where: { token } });
  if (!checkup) throw new Error("not_found");

  const config = await readQuestionnaireConfigForCheckup(prisma, checkup);
  const answers = (checkup.answersJson ?? {}) as Answers;

  const modules = assembleAllModules(config, answers, thresholds);
  const totalScore = computeTotalScore(config, answers, thresholds);
  const freeformAnswers = extractFreeformAnswers(config, answers);

  const companyName = checkup.companyName?.trim() || "（未填写公司名称）";
  const issueDate = new Date().toLocaleDateString("zh-CN");
  const totalScorePct = Math.round(totalScore.ratio * 100);
  const headerLines = [
    "## 企业法律顾问体检报告",
    "",
    `**委托方：**${companyName}　**出具单位：**${REPORT_ISSUER_NAME}　**出具日期：**${issueDate}`,
    "",
    `**总分：**${totalScore.score}/${totalScore.maxScore}（${totalScorePct}%）　**整体评价：**${totalScore.healthLabel}`,
    "",
  ];
  const fallbackModulesMarkdown =
    modules.length === 0 ? "本次体检未发现需要重点关注的合规风险项。" : buildModulesMarkdown(modules);

  const thirdPartySection = await getThirdPartyReportSection(prisma, checkup, lawyerId);
  const thirdPartyLines = thirdPartySection ? [thirdPartySection, ""] : [];

  const profiles = await resolveLlmProfiles(lawyerId);

  if (profiles.length === 0) {
    const reportText = [
      ...headerLines,
      ...thirdPartyLines,
      `> ${NO_AI_NOTICE}`,
      "",
      fallbackModulesMarkdown,
      "",
      "### 免责声明",
      "",
      DISCLAIMER_TEXT,
    ].join("\n");
    await prisma.quickExamReportJob.create({
      data: { checkupId: checkup.id, status: "success", mode: "assembled_no_ai", progressJson: {}, reportText },
    });
    return { reportText, moduleCount: modules.length, usedAi: false };
  }

  const factsPayload = {
    modules: modules.map((m) => ({
      title: m.title,
      score: m.score,
      maxScore: m.maxScore,
      priority: m.priority,
      ...(mode === "fusion" ? { riskItems: m.riskItems } : {}),
    })),
    clientFreeformAnswers: freeformAnswers.length > 0 ? freeformAnswers : "（未填写）",
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

  const result = await callChatCompletionsWithFallback(profiles, {
    messages,
    temperature: 0.3,
    max_tokens: mode === "fusion" ? 3000 : 1500,
    wantJson: true,
  });

  if (!result.ok) {
    const reportText = [
      ...headerLines,
      ...thirdPartyLines,
      `> ${NO_AI_NOTICE}`,
      "",
      fallbackModulesMarkdown,
      "",
      "### 免责声明",
      "",
      DISCLAIMER_TEXT,
    ].join("\n");
    await prisma.quickExamReportJob.create({
      data: { checkupId: checkup.id, status: "success", mode: "assembled_no_ai", progressJson: {}, reportText },
    });
    return { reportText, moduleCount: modules.length, usedAi: false };
  }

  const raw = result.text;

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

  const modulesMarkdown =
    modules.length === 0
      ? "本次体检未发现需要重点关注的合规风险项。"
      : mode === "fusion"
        ? buildFusionModulesMarkdown(modules, moduleBodies)
        : buildModulesMarkdown(modules);

  const reportText = [
    ...headerLines,
    ...thirdPartyLines,
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

  return { reportText, moduleCount: modules.length, usedAi: true };
}
