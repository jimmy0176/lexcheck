export type QuestionnaireOption = {
  value: string;
  label: string;
};

export type QuestionnaireQuestionBase = {
  qid: string;
  question: string;
  required?: boolean;
  notes?: string[];
};

export type QuestionnaireSingleChoiceQuestion = QuestionnaireQuestionBase & {
  type: "single_choice";
  options: QuestionnaireOption[];
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
  questions: QuestionnaireQuestion[];
};

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

