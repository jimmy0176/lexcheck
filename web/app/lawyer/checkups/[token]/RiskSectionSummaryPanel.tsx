import { Card } from "@/components/ui/card";
import type { Answers, QuestionnaireSection } from "@/lib/questionnaire-types";

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

export function RiskSectionSummaryPanel({
  sections,
  answers,
}: {
  sections: QuestionnaireSection[];
  answers: Answers;
}) {
  const rows = sections.map((section) => {
    const riskCount = section.questions.filter((q) =>
      isRiskAnswer(answers[q.qid], q)
    ).length;
    return {
      sectionId: section.sectionId,
      title: section.title,
      riskCount,
      totalCount: section.questions.length,
    };
  });
  const totalRisk = rows.reduce((sum, row) => sum + row.riskCount, 0);

  return (
    <Card className="p-4">
      <div className="text-base font-semibold">问卷简要分析</div>
      <div className="mt-1 text-sm text-muted-foreground">
        各模块风险项统计（按非首选项/其他项判定）
      </div>
      <div className="mt-3 space-y-2">
        {rows.map((row) => (
          <div
            key={row.sectionId}
            className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
          >
            <span className="truncate pr-3">{row.title}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              风险 {row.riskCount}/{row.totalCount}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 text-sm font-medium">
        总风险项：<span className="tabular-nums">{totalRisk}</span>
      </div>
    </Card>
  );
}
