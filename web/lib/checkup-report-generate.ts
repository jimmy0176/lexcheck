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
import {
  CHECKUP_REPORT_CONCAT_SECTION_KEY,
  CHECKUP_REPORT_FUSION_SECTION_KEY,
  CHECKUP_REPORT_ADVANCED_SECTION_KEY,
  CHECKUP_REPORT_THIRDPARTY_SECTION_KEY,
  CHECKUP_REPORT_DISCLAIMER_SECTION_KEY,
  CHECKUP_REPORT_GUARDRAILS,
  CHECKUP_REPORT_PROMPT_DEFAULTS,
} from "@/lib/dd-segment-default-templates";

const REPORT_ISSUER_NAME = "HE Partners";

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
  thirdPartyPromptMd: string
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
      return `### ${m.title}模块　优先级：${m.priority}（${m.score}/${m.maxScore} 分）\n\n${body}`;
    })
    .join("\n\n");
  return { markdown, anyFallback };
}

const NO_AI_NOTICE =
  "当前律师账号、管理员共用 Key、共用备用 Key 均不可用，本报告未调用大模型，仅按问卷答案与预设风险/建议文案自动拼装，不含摘要与整改顺序建议，请人工补充。";

/** 高级模式返回一整段 Markdown，无结构化字段可核对，只做粗粒度完整性检查：是否出现固定小节标题、是否至少命中一个模块标题。 */
function assessAdvancedOutput(raw: string, modules: ModuleAssembly[]): { text: string; degraded: boolean } {
  const text = raw.trim();
  if (!text) return { text: "", degraded: true };
  const hasSummaryHeading = /###\s*报告摘要/.test(text);
  const hasActionHeading = /###\s*重点整改顺序建议/.test(text);
  const matchedModules = modules.filter((m) => text.includes(`${m.title}模块`)).length;
  const degraded = !hasSummaryHeading || !hasActionHeading || (modules.length > 0 && matchedModules === 0);
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
}): Promise<{ reportText: string; moduleCount: number; usedAi: boolean; degraded: boolean }> {
  const { prisma, token, lawyerId, promptMd } = opts;
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

  const thirdPartySection = await getThirdPartyReportSection(prisma, checkup, lawyerId, thirdPartyPromptMd);
  const thirdPartyLines = thirdPartySection ? [thirdPartySection, ""] : [];

  const profiles = await resolveLlmProfiles(lawyerId);

  const noAiFallback = () => {
    const reportText = [
      ...headerLines,
      ...thirdPartyLines,
      `> ${NO_AI_NOTICE}`,
      "",
      fallbackModulesMarkdown,
      "",
      "### 免责声明",
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
    const factsPayload = {
      modules: modules.map((m) => ({
        title: m.title,
        score: m.score,
        maxScore: m.maxScore,
        priority: m.priority,
        riskItems: m.riskItems,
      })),
      clientFreeformAnswers: freeformAnswers.length > 0 ? freeformAnswers : "（未填写）",
    };
    const result = await callChatCompletionsWithFallback(profiles, {
      messages: [
        { role: "system", content: buildSystemPrompt(sectionKey, promptMd) },
        { role: "user", content: `【模块事实与客户自述】\n\n${JSON.stringify(factsPayload, null, 2)}` },
      ],
      temperature: 0.3,
      max_tokens: 3600,
    });

    if (!result.ok) {
      const fb = noAiFallback();
      await prisma.quickExamReportJob.create({
        data: { checkupId: checkup.id, status: "success", mode: "assembled_no_ai", progressJson: {}, reportText: fb.reportText },
      });
      return fb;
    }

    const { text: aiBody, degraded } = assessAdvancedOutput(result.text, modules);
    if (!aiBody) {
      const fb = noAiFallback();
      await prisma.quickExamReportJob.create({
        data: { checkupId: checkup.id, status: "success", mode: "assembled_no_ai", progressJson: {}, reportText: fb.reportText },
      });
      return fb;
    }

    const reportText = [...headerLines, ...thirdPartyLines, aiBody, "", "### 免责声明", "", disclaimerText].join("\n");
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
