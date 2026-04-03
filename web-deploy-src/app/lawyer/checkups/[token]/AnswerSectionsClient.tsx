"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Answers, QuestionnaireSection } from "@/lib/questionnaire-types";

type DisplayMode = "all" | "risk-only";

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

export function AnswerSectionsClient({
  sections,
  answers,
}: {
  sections: QuestionnaireSection[];
  answers: Answers;
}) {
  const [mode, setMode] = useState<DisplayMode>("all");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const display = useMemo(() => {
    return sections.map((section) => {
      const questions =
        mode === "risk-only"
          ? section.questions.filter((q) => isRiskAnswer(answers[q.qid], q))
          : section.questions;
      return { section, questions };
    });
  }, [answers, mode, sections]);

  const hasAnyRisk = display.some((s) => s.questions.length > 0);

  return (
    <div className="mt-6 space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={mode === "all" ? "default" : "outline"}
            onClick={() => setMode("all")}
          >
            显示全部
          </Button>
          <Button
            size="sm"
            variant={mode === "risk-only" ? "default" : "outline"}
            onClick={() => setMode("risk-only")}
          >
            仅显示风险项
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setCollapsed(
                Object.fromEntries(sections.map((s) => [s.sectionId, true]))
              )
            }
          >
            全部折叠
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setCollapsed({})}
          >
            全部展开
          </Button>
        </div>
      </Card>

      {mode === "risk-only" && !hasAnyRisk && (
        <Card className="p-4 text-sm text-muted-foreground">
          当前体检单暂无风险项（未发现“非第一选项”答案）。
        </Card>
      )}

      {display.map(({ section, questions }) => {
        if (mode === "risk-only" && questions.length === 0) return null;
        const isCollapsed = collapsed[section.sectionId] ?? false;
        return (
          <Card key={section.sectionId} className="p-4">
            <button
              type="button"
              className="flex w-full items-center justify-between text-left"
              onClick={() =>
                setCollapsed((prev) => ({
                  ...prev,
                  [section.sectionId]: !isCollapsed,
                }))
              }
            >
              <div className="text-base font-semibold">{section.title}</div>
              <div className="text-sm text-muted-foreground">
                {isCollapsed ? "展开" : "折叠"}
              </div>
            </button>

            {!isCollapsed && (
              <div className="mt-3 space-y-4">
                {questions.map((q) => (
                  <div key={q.qid} className="rounded-lg border bg-muted/20 p-3">
                    <div className="text-sm font-medium leading-6">
                      <span className="mr-2 text-muted-foreground">{q.qid}</span>
                      {q.question}
                    </div>
                    <div className="mt-2 text-sm text-muted-foreground">
                      答案：{formatAnswerValue(answers[q.qid], q)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
