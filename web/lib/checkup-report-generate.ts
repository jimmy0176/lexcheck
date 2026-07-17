import type { PrismaClient } from "@prisma/client";
import type { Answers } from "@/lib/questionnaire-types";
import {
  assembleAllModules,
  assembleAllModulesFull,
  buildModulesMarkdown,
  extractFreeformAnswers,
  DEFAULT_PRIORITY_THRESHOLDS,
  type ModuleAssembly,
  type PriorityThresholds,
} from "@/lib/checkup-report-assemble";
import { readQuestionnaireConfigForCheckup } from "@/lib/questionnaire-templates";
import { resolveLlmProfiles, callChatCompletionsWithFallback, type LlmProfileSource } from "@/lib/llm-resolve";
import { parseJsonLenient } from "@/lib/quick-exam-json";
import {
  CHECKUP_REPORT_CONCAT_SECTION_KEY,
  CHECKUP_REPORT_FUSION_SECTION_KEY,
  CHECKUP_REPORT_ADVANCED_SECTION_KEY,
  CHECKUP_REPORT_THIRDPARTY_SECTION_KEY,
  CHECKUP_REPORT_DISCLAIMER_SECTION_KEY,
  CHECKUP_REPORT_THIRDPARTY_DETAILED_PROMPT,
  CHECKUP_REPORT_GUARDRAILS,
  CHECKUP_REPORT_PROMPT_DEFAULTS,
} from "@/lib/dd-segment-default-templates";

export type ReportGenerationMode = "concat" | "fusion" | "advanced";

/** 由护栏（固定，不可编辑）+ 律师保存的效果文案（为空则用内置默认）拼成完整 system 提示词。 */
function buildSystemPrompt(sectionKey: string, effectiveText: string): string {
  const guardrail = CHECKUP_REPORT_GUARDRAILS[sectionKey] ?? "";
  const effect = effectiveText.trim() || CHECKUP_REPORT_PROMPT_DEFAULTS[sectionKey] || "";
  return [guardrail, effect].filter(Boolean).join("\n\n");
}

/** 从三方报告原文提取企业基本信息与重点风险提示；成功时缓存到附件行，避免每次生成报告都重新调用。 */
async function getThirdPartyReportSection(
  prisma: PrismaClient,
  checkup: { id: string },
  lawyerId: string,
  thirdPartyPromptMd: string,
  llmSource?: LlmProfileSource
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

  const profiles = await resolveLlmProfiles(lawyerId, llmSource);
  if (profiles.length === 0) return null;

  const result = await callChatCompletionsWithFallback(profiles, {
    messages: [
      { role: "system", content: buildSystemPrompt(CHECKUP_REPORT_THIRDPARTY_SECTION_KEY, thirdPartyPromptMd) },
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

/**
 * 高级模式专用：直接拿三方报告在上传时就已本地提取好的原文文本（不额外调用大模型摘要），
 * 和问卷全量数据一起交给同一次生成调用，让模型自己在一个上下文里综合判断，
 * 而不是像拼装/融合模式那样先由独立的一次调用把三方报告压缩成两段摘要再拼接进最终文档。
 */
/**
 * 三方报告原文超过这个字符数时，高级模式改用下面的"详细版"预提取摘要而不是原文，避免和问卷全量数据、
 * system prompt 一起拼进单次请求后超出模型上下文窗口。门槛只按原文本身的长度判断，不精确估算问卷+
 * prompt 实际占用的字符数——面向主流国内大模型（旗舰/长文本档位通常至少 32K～128K tokens 上下文）
 * 留出足够余量，不追求逐模型精确计算，也不考虑上下文窗口很小的模型。
 */
export const ADVANCED_THIRDPARTY_DETAIL_TRIGGER_CHARS = 85000;

/**
 * 三方报告"详细版"预提取：原文超过 ADVANCED_THIRDPARTY_DETAIL_TRIGGER_CHARS 时使用，单独一次 LLM
 * 调用把原文压缩成一份仍保留案号/金额/日期等具体细节的详细摘要（而不是拼装/融合模式那种两三句话的
 * 概述），结果缓存在 parsedSummaryJson.detailedExtract，避免重复调用。可以在上传三方报告时就预处理
 * （见 /api/lawyer/checkups/[token]/third-party-report 的 POST），也可以在生成报告时按需触发。
 */
export async function getThirdPartyDetailedExtract(
  prisma: PrismaClient,
  attachment: { id: string; extractedText: string | null; parsedSummaryJson: unknown },
  lawyerId: string,
  llmSource?: LlmProfileSource
): Promise<string | null> {
  const cached = attachment.parsedSummaryJson as { detailedExtract?: string } | null;
  if (cached?.detailedExtract?.trim()) return cached.detailedExtract;

  const rawText = attachment.extractedText?.trim();
  if (!rawText) return null;

  const profiles = await resolveLlmProfiles(lawyerId, llmSource);
  if (profiles.length === 0) return null;

  const result = await callChatCompletionsWithFallback(profiles, {
    messages: [
      { role: "system", content: CHECKUP_REPORT_THIRDPARTY_DETAILED_PROMPT },
      { role: "user", content: `【三方报告原文】\n\n${rawText}` },
    ],
    temperature: 0.2,
    max_tokens: 12000,
  });
  if (!result.ok || !result.text.trim()) return null;

  const detailedExtract = result.text.trim();
  const existingCache = (attachment.parsedSummaryJson as Record<string, unknown> | null) ?? {};
  await prisma.checkupAttachment.update({
    where: { id: attachment.id },
    data: { parsedSummaryJson: { ...existingCache, detailedExtract } },
  });
  return detailedExtract;
}

/**
 * 高级模式专用：三方报告原文在门槛内直接用原文，超过门槛则改用详细摘要（已缓存则直接用缓存，
 * 未缓存则现场生成一次）；详细摘要生成失败时宁可退回原文（承担超长风险）也不丢失三方报告信息，
 * 由主调用失败后的重试逻辑兜底。
 */
async function getThirdPartyContentForAdvanced(
  prisma: PrismaClient,
  checkup: { id: string },
  lawyerId: string,
  llmSource?: LlmProfileSource
): Promise<{ text: string; usedDetail: boolean } | null> {
  const workspace = await prisma.checkupWorkspace.findUnique({ where: { checkupId: checkup.id } });
  if (!workspace?.thirdPartyReportEnabled) return null;

  const attachment = await prisma.checkupAttachment.findFirst({
    where: { checkupId: checkup.id, kind: "thirdParty" },
    orderBy: { createdAt: "desc" },
  });
  const rawText = attachment?.extractedText?.trim();
  if (!attachment || !rawText) return null;

  if (rawText.length <= ADVANCED_THIRDPARTY_DETAIL_TRIGGER_CHARS) {
    return { text: rawText, usedDetail: false };
  }

  const detailed = await getThirdPartyDetailedExtract(prisma, attachment, lawyerId, llmSource);
  if (detailed) return { text: detailed, usedDetail: true };
  return { text: rawText, usedDetail: false };
}

export type HeaderCompanyInfo = { creditCode?: string; companyType?: string; industry?: string };

const HEADER_FIELDS_EXTRACT_PROMPT =
  "你是企业信用报告信息提取助手。请从用户提供的三方企业信用报告原文中提取以下三项信息，只返回 JSON，不要输出任何多余文字：" +
  '{"creditCode": 统一社会信用代码, "companyType": 企业类型/组织形式（如「有限责任公司（自然人投资或控股）」）, "industry": 所属行业（国民经济行业分类）}。' +
  "原文没有明确出现的项，对应值返回空字符串，不得编造。";

/**
 * 报告头部的「统一社会信用代码/企业类型/所属行业」来自三方报告原文，用一次轻量 LLM 调用单独提取
 * （而不是复用高级模式主调用的输出），因为这三项是结构化短字段，拼装/融合模式也需要展示，
 * 与"综合分析报告正文"的主调用职责不同。提取结果缓存在附件行的 parsedSummaryJson.headerFields 里，
 * 避免每次生成报告都重新调用一次大模型。
 */
async function getHeaderCompanyInfo(
  prisma: PrismaClient,
  checkup: { id: string },
  lawyerId: string,
  llmSource?: LlmProfileSource
): Promise<HeaderCompanyInfo | null> {
  const workspace = await prisma.checkupWorkspace.findUnique({ where: { checkupId: checkup.id } });
  if (!workspace?.thirdPartyReportEnabled) return null;

  const attachment = await prisma.checkupAttachment.findFirst({
    where: { checkupId: checkup.id, kind: "thirdParty" },
    orderBy: { createdAt: "desc" },
  });
  if (!attachment?.extractedText?.trim()) return null;

  const cached = attachment.parsedSummaryJson as { headerFields?: HeaderCompanyInfo } | null;
  if (cached?.headerFields && (cached.headerFields.creditCode || cached.headerFields.companyType || cached.headerFields.industry)) {
    return cached.headerFields;
  }

  const profiles = await resolveLlmProfiles(lawyerId, llmSource);
  if (profiles.length === 0) return null;

  const result = await callChatCompletionsWithFallback(profiles, {
    messages: [
      { role: "system", content: HEADER_FIELDS_EXTRACT_PROMPT },
      { role: "user", content: `【三方报告原文】\n\n${attachment.extractedText}` },
    ],
    temperature: 0,
    max_tokens: 300,
    wantJson: true,
  });
  if (!result.ok) return null;

  try {
    const parsed = parseJsonLenient(result.text) as { creditCode?: unknown; companyType?: unknown; industry?: unknown };
    const headerFields: HeaderCompanyInfo = {
      creditCode: typeof parsed.creditCode === "string" ? parsed.creditCode.trim() : "",
      companyType: typeof parsed.companyType === "string" ? parsed.companyType.trim() : "",
      industry: typeof parsed.industry === "string" ? parsed.industry.trim() : "",
    };
    if (!headerFields.creditCode && !headerFields.companyType && !headerFields.industry) return null;

    const existingCache = (attachment.parsedSummaryJson as Record<string, unknown> | null) ?? {};
    await prisma.checkupAttachment.update({
      where: { id: attachment.id },
      data: { parsedSummaryJson: { ...existingCache, headerFields } },
    });
    return headerFields;
  } catch {
    return null;
  }
}

/** 报告编号无需人工维护序号表，直接由出具日期 + token 派生，同一份体检每次生成都得到相同编号。 */
function buildReportNo(token: string, issueDate: Date): string {
  const yyyy = issueDate.getFullYear();
  const mm = String(issueDate.getMonth() + 1).padStart(2, "0");
  const dd = String(issueDate.getDate()).padStart(2, "0");
  let hash = 0;
  for (const ch of token) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const seq = String(hash % 1000).padStart(3, "0");
  return `LX-${yyyy}${mm}${dd}-${seq}`;
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

function buildFusionModulesMarkdown(
  modules: ModuleAssembly[],
  bodies: Record<string, string>
): { markdown: string; anyFallback: boolean } {
  let anyFallback = false;
  const markdown = modules
    .map((m, i) => {
      const aiBody = (bodies[String(i)] ?? "").trim();
      if (!aiBody) anyFallback = true;
      const body = aiBody || m.bodyMarkdown;
      return `## ${m.title}模块　优先级：${m.priority}（${m.score}/${m.maxScore} 分）\n\n${body}`;
    })
    .join("\n\n");
  return { markdown, anyFallback };
}

const NO_AI_NOTICE =
  "当前律师账号、管理员共用 Key、共用备用 Key 均不可用，本报告未调用大模型，仅按问卷答案与预设风险/建议文案自动拼装，不含摘要与整改顺序建议，请人工补充。";

/**
 * 高级模式返回一整段 Markdown，无结构化字段可核对，只做粗粒度完整性检查：
 * 固定六个章节标题是否齐全（不再逐模块检查——新版 prompt 把风险点归并成"综合风险主题"，
 * 不再保证每个问卷模块都单独开一个标题），以及"专项风险分析与律师建议"下是否至少展开了一个
 * 风险主题（###，不要求编号——v6 起风险主题标题不再让模型自己编号，避免和正文里"整改建议"
 * 编号列表同样用阿拉伯数字加点、层级混淆的问题；标题本身的字号/颜色已经足以和正文区分）。
 * 标题层级：文档标题 # / 六个固定章节 ## / 风险主题 ###，检查时用 (?!#) 卡住层级，
 * 避免"##标题"的判断误把"###标题"也算命中。
 */
const ADVANCED_REQUIRED_HEADINGS = [
  "报告基础与分析口径",
  "公司总体法律风险画像",
  "评分与重点风险概览",
  "专项风险分析与律师建议",
  "90日整改工作安排",
  "结论",
];
const ADVANCED_RISK_TOPIC_HEADING = /(^|\n)###(?!#)\s*\S/;

function assessAdvancedOutput(raw: string): { text: string; degraded: boolean } {
  const text = raw.trim();
  if (!text) return { text: "", degraded: true };
  const missingHeading = ADVANCED_REQUIRED_HEADINGS.some((h) => !new RegExp(`(^|\\n)##(?!#)\\s*${h}`).test(text));
  const hasRiskTopicHeading = ADVANCED_RISK_TOPIC_HEADING.test(text);
  const degraded = missingHeading || !hasRiskTopicHeading;
  return { text, degraded };
}

export async function generateCheckupReport(opts: {
  prisma: PrismaClient;
  token: string;
  lawyerId: string;
  /** 当前选中生成模式（concat/fusion/advanced）对应标签页里、律师已保存的效果文案；为空则用该模式的内置默认 */
  promptMd: string;
  /** 三方报告提取标签页里、律师已保存的效果文案；为空则用内置默认 */
  thirdPartyPromptMd?: string;
  /** "免责声明"标签页里、律师已保存的正文；为空则用内置默认，不经过大模型，逐字插入报告末尾 */
  disclaimerText?: string;
  mode?: ReportGenerationMode;
  thresholds?: PriorityThresholds;
  /** 律师在生成报告时显式选择的模型来源（自用/共用/共用备用）；不传则按原有级联顺序自动选择 */
  llmSource?: LlmProfileSource;
}): Promise<{ reportText: string; moduleCount: number; usedAi: boolean; degraded: boolean }> {
  const { prisma, token, lawyerId, promptMd, llmSource } = opts;
  const thirdPartyPromptMd = opts.thirdPartyPromptMd ?? "";
  const disclaimerText =
    (opts.disclaimerText ?? "").trim() || CHECKUP_REPORT_PROMPT_DEFAULTS[CHECKUP_REPORT_DISCLAIMER_SECTION_KEY]!;
  const thresholds = opts.thresholds ?? DEFAULT_PRIORITY_THRESHOLDS;
  const mode: ReportGenerationMode = opts.mode ?? "fusion";

  const checkup = await prisma.checkup.findUnique({ where: { token } });
  if (!checkup) throw new Error("not_found");

  const config = await readQuestionnaireConfigForCheckup(prisma, checkup);
  const answers = (checkup.answersJson ?? {}) as Answers;

  const modules = assembleAllModules(config, answers, thresholds);
  const freeformAnswers = extractFreeformAnswers(config, answers);

  const companyName = checkup.companyName?.trim() || "（未填写公司名称）";
  const issueDateObj = new Date();
  const issueDateCn = `${issueDateObj.getFullYear()}年${issueDateObj.getMonth() + 1}月${issueDateObj.getDate()}日`;
  const reportNo = buildReportNo(checkup.token, issueDateObj);
  const headerFields = await getHeaderCompanyInfo(prisma, checkup, lawyerId, llmSource);
  // 注意：粗体标签后紧跟中文/英文冒号、冒号后又直接接非空白内容（如"**报告编号：**LX-..."）时，
  // CommonMark 的强调分隔符 flanking 规则会判定右侧 ** 不构成有效闭合定界符（前一个字符是标点、
  // 后一个字符又不是空白/标点），导致整行被解析成纯文本、字面显示 **——冒号必须放在闭合 ** 之外。
  const headerLines = [
    `# ${companyName}法律体检报告`,
    "",
    `**报告编号**：${reportNo}`,
    "",
    `**报告日期**：${issueDateCn}`,
    "",
    `**体检对象**：${companyName}`,
    "",
    `**统一社会信用代码**：${headerFields?.creditCode || "未提供"}`,
    "",
    `**企业类型**：${headerFields?.companyType || "未提供"}`,
    "",
    `**所属行业**：${headerFields?.industry || "未提供"}`,
    "",
  ];
  const fallbackModulesMarkdown =
    modules.length === 0 ? "本次体检未发现需要重点关注的合规风险项。" : buildModulesMarkdown(modules);

  const thirdPartySection = await getThirdPartyReportSection(prisma, checkup, lawyerId, thirdPartyPromptMd, llmSource);
  const thirdPartyLines = thirdPartySection ? [thirdPartySection, ""] : [];

  const profiles = await resolveLlmProfiles(lawyerId, llmSource);

  const noAiFallback = (notice: string = NO_AI_NOTICE) => {
    const reportText = [
      ...headerLines,
      ...thirdPartyLines,
      `> ${notice}`,
      "",
      fallbackModulesMarkdown,
      "",
      "## 免责声明",
      "",
      disclaimerText,
    ].join("\n");
    return { reportText, moduleCount: modules.length, usedAi: false, degraded: false };
  };

  if (profiles.length === 0) {
    const result = noAiFallback();
    await prisma.quickExamReportJob.create({
      data: { checkupId: checkup.id, status: "success", mode: "assembled_no_ai", progressJson: {}, reportText: result.reportText },
    });
    return result;
  }

  if (mode === "advanced") {
    const sectionKey = CHECKUP_REPORT_ADVANCED_SECTION_KEY;
    const fullModules = assembleAllModulesFull(config, answers, thresholds);
    let thirdParty = await getThirdPartyContentForAdvanced(prisma, checkup, lawyerId, llmSource);

    const buildFactsPayload = () => ({
      modules: fullModules,
      clientFreeformAnswers: freeformAnswers.length > 0 ? freeformAnswers : "（未填写）",
      thirdPartyReportRawText: thirdParty?.text ?? "（未上传三方报告，或提取失败，本次不提供三方报告信息）",
    });
    const callAdvanced = () =>
      callChatCompletionsWithFallback(profiles, {
        messages: [
          { role: "system", content: buildSystemPrompt(sectionKey, promptMd) },
          { role: "user", content: `【问卷全量数据、客户自述与三方报告原文】\n\n${JSON.stringify(buildFactsPayload(), null, 2)}` },
        ],
        temperature: 0.3,
        max_tokens: 6500,
      });

    // 高级模式一次性把问卷全量数据（不只是扣分项）+ 三方报告内容一起交给同一次调用，让写报告正文的模型
    // 自己在同一个上下文里综合判断，不再像拼装/融合模式那样依赖另一次独立调用把三方报告压缩成摘要再拼接。
    let result = await callAdvanced();

    // 请求失败且当时用的是三方报告原文（未走详细摘要）时，退一步换成详细摘要重试一次——
    // 不去解析具体报错原因（不同供应商措辞不一致，难以可靠判断是不是"超出上下文"），
    // 只要三方报告原文本身有一定体量、换更小的摘要重试的代价可以接受，就值得试一次。
    let retriedWithDetail = false;
    if (!result.ok && thirdParty && !thirdParty.usedDetail && thirdParty.text.length > 20000) {
      const attachment = await prisma.checkupAttachment.findFirst({
        where: { checkupId: checkup.id, kind: "thirdParty" },
        orderBy: { createdAt: "desc" },
      });
      const detailed = attachment ? await getThirdPartyDetailedExtract(prisma, attachment, lawyerId, llmSource) : null;
      if (detailed) {
        thirdParty = { text: detailed, usedDetail: true };
        retriedWithDetail = true;
        result = await callAdvanced();
      }
    }

    if (!result.ok) {
      const notice = retriedWithDetail
        ? "本次生成失败：问卷内容 + 三方报告摘要合并后可能仍然超出所配置大模型的上下文长度限制（已自动压缩三方报告仍未成功），建议精简客户自述或三方报告内容后重试，或更换上下文窗口更大的模型。"
        : NO_AI_NOTICE;
      const fb = noAiFallback(notice);
      await prisma.quickExamReportJob.create({
        data: { checkupId: checkup.id, status: "success", mode: "assembled_no_ai", progressJson: {}, reportText: fb.reportText },
      });
      return fb;
    }

    const { text: aiBody, degraded } = assessAdvancedOutput(result.text);
    if (!aiBody) {
      const fb = noAiFallback();
      await prisma.quickExamReportJob.create({
        data: { checkupId: checkup.id, status: "success", mode: "assembled_no_ai", progressJson: {}, reportText: fb.reportText },
      });
      return fb;
    }

    const reportText = [...headerLines, aiBody, "", "## 免责声明", "", disclaimerText].join("\n");
    await prisma.quickExamReportJob.create({
      data: { checkupId: checkup.id, status: "success", mode: "assembled_advanced", progressJson: {}, reportText },
    });
    return { reportText, moduleCount: modules.length, usedAi: true, degraded };
  }

  const sectionKey = mode === "fusion" ? CHECKUP_REPORT_FUSION_SECTION_KEY : CHECKUP_REPORT_CONCAT_SECTION_KEY;
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
    { role: "system", content: buildSystemPrompt(sectionKey, promptMd) },
    { role: "user", content: `【模块事实与客户自述】\n\n${JSON.stringify(factsPayload, null, 2)}` },
  ];

  const result = await callChatCompletionsWithFallback(profiles, {
    messages,
    temperature: 0.3,
    max_tokens: mode === "fusion" ? 3000 : 1500,
    wantJson: true,
  });

  if (!result.ok) {
    const fb = noAiFallback();
    await prisma.quickExamReportJob.create({
      data: { checkupId: checkup.id, status: "success", mode: "assembled_no_ai", progressJson: {}, reportText: fb.reportText },
    });
    return fb;
  }

  const raw = result.text;

  let summary = "";
  let actionPlan = "";
  const moduleBodies: Record<string, string> = {};
  let degraded = false;
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
    degraded = true;
  }
  if (!summary) {
    summary = "（未生成摘要）";
    degraded = true;
  }
  if (!actionPlan) {
    actionPlan = "（未生成整改顺序建议，请参考各模块优先级自行安排处理顺序。）";
    degraded = true;
  }

  let modulesMarkdown: string;
  if (modules.length === 0) {
    modulesMarkdown = "本次体检未发现需要重点关注的合规风险项。";
  } else if (mode === "fusion") {
    const built = buildFusionModulesMarkdown(modules, moduleBodies);
    modulesMarkdown = built.markdown;
    if (built.anyFallback) degraded = true;
  } else {
    modulesMarkdown = buildModulesMarkdown(modules);
  }

  const reportText = [
    ...headerLines,
    ...thirdPartyLines,
    "## 报告摘要",
    "",
    summary,
    "",
    modulesMarkdown,
    "",
    "## 重点整改顺序建议",
    "",
    actionPlan,
    "",
    "## 免责声明",
    "",
    disclaimerText,
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

  return { reportText, moduleCount: modules.length, usedAi: true, degraded };
}
