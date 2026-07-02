export type QuestionnaireOption = {
  value: string;
  label: string;
  /** 该选项对应分值（0 / 0.5 / 1）。仅计分题使用，企业端不展示。 */
  score?: number;
  /** 选中该选项时对应的风险说明。仅供律师端/报告拼装使用，企业端不展示。 */
  riskText?: string;
  /** 选中该选项时对应的整改建议。多为非满分选项才有；仅供律师端/报告拼装使用。 */
  adviceText?: string;
};

export type QuestionnaireQuestionBase = {
  qid: string;
  question: string;
  required?: boolean;
  notes?: string[];
};

/** 前置门槛题触发"跳过"选项时，标记哪些后续题目变为非必填并在留空时按不涉及自动计满分。 */
export type QuestionnaireSkipGate = {
  /** 触发跳过的选项 value（如"否（请跳转至第七部分）"对应的 value） */
  triggerValue: string;
  /** 被跳过、留空时按不涉及自动计满分的题号列表 */
  skipQids: string[];
};

export type QuestionnaireSingleChoiceQuestion = QuestionnaireQuestionBase & {
  type: "single_choice";
  options: QuestionnaireOption[];
  skipGate?: QuestionnaireSkipGate;
};

export type QuestionnaireTextareaQuestion = QuestionnaireQuestionBase & {
  type: "textarea";
  placeholder?: string;
};

export type QuestionnaireMultiChoiceWithOtherQuestion = QuestionnaireQuestionBase & {
  type: "multi_choice_with_other";
  options: QuestionnaireOption[];
  other?: { enabled: boolean; placeholder?: string };
};

export type QuestionnaireQuestion =
  | QuestionnaireSingleChoiceQuestion
  | QuestionnaireTextareaQuestion
  | QuestionnaireMultiChoiceWithOtherQuestion;

export type QuestionnaireSection = {
  sectionId: string;
  title: string;
  order: number;
  /** 本章节计分题满分（如人力资源 12 分）；不计分章节（如"其他"）省略。 */
  maxScore?: number;
  questions: QuestionnaireQuestion[];
};

/** 门槛题触发跳过时，被跳过题目留空的默认计分与风险文案。 */
export const SKIPPED_NA_SCORE = 1;
export const SKIPPED_NA_RISK_TEXT = "不涉及，暂未发现该项风险。";

export type QuestionnaireConfig = {
  formKey: string;
  title: string;
  version: string;
  requiredMode?: string;
  skipLogicMode?: string;
  sections: QuestionnaireSection[];
};

export type Answers = Record<
  string,
  | { kind: "single_choice"; value: string | null }
  | { kind: "textarea"; value: string }
  | { kind: "multi_choice_with_other"; values: string[]; otherText?: string }
>;

