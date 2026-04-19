import type { Answers, QuestionnaireSection } from "@/lib/questionnaire-types";

function formatAnswerValue(
  answer: Answers[string] | undefined,
  question: QuestionnaireSection["questions"][number]
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

function isRiskAnswer(
  answer: Answers[string] | undefined,
  question: QuestionnaireSection["questions"][number]
) {
  if (!answer) return false;
  if (question.type === "single_choice" && answer.kind === "single_choice") {
    if (!answer.value || question.options.length === 0) return false;
    return answer.value !== question.options[0].value;
  }
  if (
    question.type === "multi_choice_with_other" &&
    answer.kind === "multi_choice_with_other"
  ) {
    const first = question.options[0]?.value;
    const hasNonFirst = answer.values.some((v) => v !== first);
    return hasNonFirst || (answer.otherText ?? "").trim().length > 0;
  }
  return false;
}

export function QuestionnaireCompactText({
  sections,
  answers,
  mode,
}: {
  sections: QuestionnaireSection[];
  answers: Answers;
  mode: "risk-only" | "all";
}) {
  const hasRisk = sections.some((s) =>
    s.questions.some((q) => isRiskAnswer(answers[q.qid], q))
  );

  if (mode === "risk-only" && !hasRisk) {
    return (
      <p className="text-xs text-muted-foreground">
        当前体检单暂无风险项（未发现「非第一选项」答案）。
      </p>
    );
  }

  return (
    <div className="space-y-4 text-xs leading-relaxed">
      {sections.map((section) => {
        const questions =
          mode === "risk-only"
            ? section.questions.filter((q) => isRiskAnswer(answers[q.qid], q))
            : section.questions;
        if (questions.length === 0) return null;
        return (
          <div key={section.sectionId} className="space-y-2.5">
            <div className="font-semibold text-foreground">{section.title}</div>
            <div className="space-y-2.5 text-foreground/90">
              {questions.map((q) => (
                <div key={q.qid}>
                  <div>
                    {q.qid} {q.question}
                  </div>
                  <div className="mt-0.5 text-muted-foreground">
                    答：{formatAnswerValue(answers[q.qid], q)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
