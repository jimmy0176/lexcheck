import type { Answers, QuestionnaireConfig } from "@/lib/questionnaire-types";
import { analyzeRisk, generateRuleAdvice } from "@/lib/ai-advice";

function formatAnswerLine(
  answer: Answers[string] | undefined,
  question: QuestionnaireConfig["sections"][number]["questions"][number]
) {
  if (!answer) return "未填写";
  if (question.type === "single_choice" && answer.kind === "single_choice") {
    if (!answer.value) return "未填写";
    return (
      question.options.find((opt) => opt.value === answer.value)?.label ?? answer.value
    );
  }
  if (question.type === "textarea" && answer.kind === "textarea") {
    const value = answer.value.trim();
    return value.length > 0 ? value : "未填写";
  }
  if (
    question.type === "multi_choice_with_other" &&
    answer.kind === "multi_choice_with_other"
  ) {
    const labels = answer.values
      .map((v) => question.options.find((opt) => opt.value === v)?.label ?? v)
      .filter(Boolean);
    const otherText = (answer.otherText ?? "").trim();
    if (otherText.length > 0) labels.push(`其他：${otherText}`);
    return labels.length > 0 ? labels.join("；") : "未填写";
  }
  return "未填写";
}

/** 供「快速体检报告」大模型调用的问卷文本（含规则风险与全量问答） */
export function buildQuickExamQuestionnaireNarrative(
  config: QuestionnaireConfig,
  answers: Answers
): string {
  const advice = generateRuleAdvice(config, answers);
  const risk = analyzeRisk(config, answers);
  const lines: string[] = [];
  lines.push(`【规则引擎】风险等级：${advice.riskLevel}`);
  lines.push(`【规则引擎】摘要：${advice.summary}`);
  lines.push(`【风险项数量】${risk.riskItems.length}（按非首选项等规则）`);
  if (risk.riskItems.length > 0) {
    lines.push("【风险项明细】");
    risk.riskItems.forEach((x, i) => lines.push(`${i + 1}. ${x}`));
  }
  lines.push("");
  lines.push("【问卷全量作答】");
  for (const section of config.sections) {
    lines.push("");
    lines.push(`《${section.title}》`);
    for (const q of section.questions) {
      lines.push(`${q.qid} ${q.question}`);
      lines.push(`答：${formatAnswerLine(answers[q.qid], q)}`);
    }
  }
  return lines.join("\n");
}
