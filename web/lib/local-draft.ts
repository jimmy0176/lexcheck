import type { Answers, QuestionnaireConfig } from "@/lib/questionnaire-types";

export type DraftEnvelope = {
  schemaVersion: 1;
  formKey: string;
  questionnaireVersion: string;
  token: string;
  companyName?: string;
  savedAt: string; // ISO
  submittedAt?: string; // ISO
  answers: Answers;
};

export function getDraftStorageKey(formKey: string, token: string) {
  return `lexcheck:draft:${formKey}:${token}`;
}

export function loadDraft(config: QuestionnaireConfig, token: string): DraftEnvelope | null {
  if (typeof window === "undefined") return null;
  const key = getDraftStorageKey(config.formKey, token);
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as DraftEnvelope;
    if (parsed.schemaVersion !== 1) return null;
    if (parsed.formKey !== config.formKey) return null;
    if (parsed.token !== token) return null;
    return parsed;
  } catch {
    return null;
  }
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

