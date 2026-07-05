import {
  SKIPPED_NA_SCORE,
  type Answers,
  type QuestionnaireConfig,
  type QuestionnaireSection,
} from "@/lib/questionnaire-types";

export type PriorityThresholds = { low: number; mid: number; midHigh: number };

/** 默认优先级阈值（得分/满分占比）；律师端可在「配置中心」覆盖，存浏览器 localStorage。 */
export const DEFAULT_PRIORITY_THRESHOLDS: PriorityThresholds = {
  low: 0.9,
  mid: 0.75,
  midHigh: 0.5,
};

export const PRIORITY_THRESHOLDS_STORAGE_KEY = "lexcheck:report:priority-thresholds";

export type PriorityLabel = "高" | "中高" | "中" | "低";

export function computePriorityLabel(
  ratio: number,
  t: PriorityThresholds = DEFAULT_PRIORITY_THRESHOLDS
): PriorityLabel {
  if (ratio >= t.low) return "低";
  if (ratio >= t.mid) return "中";
  if (ratio >= t.midHigh) return "中高";
  return "高";
}

export type HealthLabel = "优" | "良" | "中" | "差";

/** 总分整体评价：复用优先级阈值，但按"健康程度"而非"风险优先级"措辞，避免总分行读起来像风险提示。 */
export function computeHealthLabel(
  ratio: number,
  t: PriorityThresholds = DEFAULT_PRIORITY_THRESHOLDS
): HealthLabel {
  if (ratio >= t.low) return "优";
  if (ratio >= t.mid) return "良";
  if (ratio >= t.midHigh) return "中";
  return "差";
}

export type RiskItem = {
  qid: string;
  question: string;
  riskText: string;
  adviceText: string;
};

export type ModuleAssembly = {
  sectionId: string;
  title: string;
  score: number;
  maxScore: number;
  ratio: number;
  priority: PriorityLabel;
  riskItems: RiskItem[];
  bodyMarkdown: string;
};

/**
 * 标记哪些计分题留空时按"不涉及"自动计满分。两种来源：
 * 1. 门槛题触发跳过（与问卷填写页同一套规则）；
 * 2. 本节所有计分题均未作答——视为该节对企业不适用，整节按满分处理，不生成风险项。
 */
function computeSkippedQids(section: QuestionnaireSection, answers: Answers): Set<string> {
  const skipped = new Set<string>();
  for (const q of section.questions) {
    if (q.type !== "single_choice" || !q.skipGate) continue;
    const a = answers[q.qid];
    if (a?.kind === "single_choice" && a.value === q.skipGate.triggerValue) {
      for (const sq of q.skipGate.skipQids) skipped.add(sq);
    }
  }

  const scoredQids = section.questions.filter((q) => q.type === "single_choice").map((q) => q.qid);
  const anyAnswered = scoredQids.some((qid) => {
    const a = answers[qid];
    return a?.kind === "single_choice" && !!a.value;
  });
  if (!anyAnswered) {
    for (const qid of scoredQids) skipped.add(qid);
  }

  return skipped;
}

function resolveQuestionScore(
  q: QuestionnaireSection["questions"][number],
  answers: Answers,
  skipped: Set<string>
): { score: number; riskText: string | null; adviceText: string | null } {
  if (q.type !== "single_choice") return { score: 1, riskText: null, adviceText: null };

  const a = answers[q.qid];
  if (a?.kind === "single_choice" && a.value) {
    const opt = q.options.find((o) => o.value === a.value);
    if (opt && typeof opt.score === "number") {
      return { score: opt.score, riskText: opt.riskText ?? null, adviceText: opt.adviceText ?? null };
    }
  }

  if (skipped.has(q.qid)) {
    return { score: SKIPPED_NA_SCORE, riskText: null, adviceText: null };
  }

  return {
    score: 0,
    riskText: "该题客户尚未填写，暂无法判断相关风险，建议核实后补充。",
    adviceText: "请企业方补充填写本题答案，避免报告因数据缺失而遗漏相关风险。",
  };
}

/** 逐题计分并收集风险项；供 assembleSection 与 computeTotalScore 共用，避免重复计分逻辑。 */
function computeSectionScore(
  section: QuestionnaireSection,
  answers: Answers
): { score: number; riskItems: RiskItem[] } {
  const skipped = computeSkippedQids(section, answers);
  let score = 0;
  const riskItems: RiskItem[] = [];

  for (const q of section.questions) {
    if (q.type !== "single_choice") continue;
    const r = resolveQuestionScore(q, answers, skipped);
    score += r.score;
    if (r.score < 1 && r.riskText) {
      riskItems.push({
        qid: q.qid,
        question: q.question,
        riskText: r.riskText,
        adviceText: r.adviceText ?? "",
      });
    }
  }

  return { score, riskItems };
}

/** 单个章节拼装为一个报告模块；本节所有题目均满分（无风险项）时返回 null，整节跳过。 */
export function assembleSection(
  section: QuestionnaireSection,
  answers: Answers,
  thresholds: PriorityThresholds = DEFAULT_PRIORITY_THRESHOLDS
): ModuleAssembly | null {
  if (typeof section.maxScore !== "number") return null;

  const { score, riskItems } = computeSectionScore(section, answers);
  if (riskItems.length === 0) return null;

  const maxScore = section.maxScore;
  const ratio = maxScore > 0 ? score / maxScore : 1;
  const priority = computePriorityLabel(ratio, thresholds);

  const bodyMarkdown = riskItems
    .map((item, i) => {
      const advice = item.adviceText.trim() ? `\n   建议：${item.adviceText}` : "";
      return `${i + 1}. **${item.question}**\n   风险：${item.riskText}${advice}`;
    })
    .join("\n\n");

  return { sectionId: section.sectionId, title: section.title, score, maxScore, ratio, priority, riskItems, bodyMarkdown };
}

export type TotalScoreResult = {
  score: number;
  maxScore: number;
  ratio: number;
  healthLabel: HealthLabel;
};

/** 全部章节汇总总分，用于报告开头呈现企业总体法律健康程度。不适用章节已在计分阶段按满分处理。 */
export function computeTotalScore(
  config: QuestionnaireConfig,
  answers: Answers,
  thresholds: PriorityThresholds = DEFAULT_PRIORITY_THRESHOLDS
): TotalScoreResult {
  let score = 0;
  let maxScore = 0;
  for (const section of config.sections) {
    if (typeof section.maxScore !== "number") continue;
    score += computeSectionScore(section, answers).score;
    maxScore += section.maxScore;
  }
  const ratio = maxScore > 0 ? score / maxScore : 1;
  return { score, maxScore, ratio, healthLabel: computeHealthLabel(ratio, thresholds) };
}

/** 按问卷章节原有顺序拼装全部模块；无风险的章节自动跳过。 */
export function assembleAllModules(
  config: QuestionnaireConfig,
  answers: Answers,
  thresholds: PriorityThresholds = DEFAULT_PRIORITY_THRESHOLDS
): ModuleAssembly[] {
  const modules: ModuleAssembly[] = [];
  for (const section of config.sections) {
    const m = assembleSection(section, answers, thresholds);
    if (m) modules.push(m);
  }
  return modules;
}

export function buildModulesMarkdown(modules: ModuleAssembly[]): string {
  return modules
    .map((m) => `### ${m.title}模块　优先级：${m.priority}（${m.score}/${m.maxScore} 分）\n\n${m.bodyMarkdown}`)
    .join("\n\n");
}

/** 第九节「其他」两道开放题答案，供 LLM 撰写报告摘要时参考。 */
export function extractOtherAnswers(config: QuestionnaireConfig, answers: Answers) {
  const otherSection = config.sections.find((s) => s.sectionId === "other");
  const get = (qid: string) => {
    const a = answers[qid];
    return a?.kind === "textarea" ? a.value.trim() : "";
  };
  const qids = otherSection?.questions.map((q) => q.qid) ?? [];
  return {
    topIssue: qids[0] ? get(qids[0]) : "",
    nextThreeYears: qids[1] ? get(qids[1]) : "",
  };
}
