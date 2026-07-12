import type { Answers, QuestionnaireConfig } from "@/lib/questionnaire-types";

export type DraftEnvelope = {
  schemaVersion: 1;
  formKey: string;
  questionnaireVersion: string;
  token: string;
  companyName?: string;
  contactName?: string;
  contactPhone?: string;
  savedAt: string; // ISO
  submittedAt?: string; // ISO
  answers: Answers;
};

export function getDraftStorageKey(formKey: string, token: string) {
  return `lexcheck:draft:${formKey}:${token}`;
}

export function saveDraft(config: QuestionnaireConfig, token: string, draft: Omit<DraftEnvelope, "schemaVersion" | "formKey" | "questionnaireVersion" | "token">) {
  if (typeof window === "undefined") return;
  const key = getDraftStorageKey(config.formKey, token);
  const envelope: DraftEnvelope = {
    schemaVersion: 1,
    formKey: config.formKey,
    questionnaireVersion: config.version,
    token,
    ...draft,
  };
  window.localStorage.setItem(key, JSON.stringify(envelope));
}

