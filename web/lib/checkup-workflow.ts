import { DD_REPORT_SECTIONS } from "@/lib/dd-report-toc";

export const WORKFLOW_STEPS = [
  "问卷校核",
  "补充材料",
  "AI 草稿",
  "人工修订",
  "最终定稿",
] as const;

export const REPORT_SECTIONS = [
  { key: "governance", name: "公司治理与股权结构" },
  { key: "contracts", name: "合同与交易合规" },
  { key: "labor_tax", name: "用工与税务风险" },
  { key: "ip_data", name: "知识产权与数据合规" },
  { key: "litigation", name: "争议与历史风险事项" },
] as const;

/** 兼容旧五段 + 尽调 dd_01…dd_14，用于分部生成 API 与草稿存储 */
export function resolveWorkspaceSectionMeta(
  sectionKey: string
): { key: string; name: string } | null {
  const legacy = REPORT_SECTIONS.find((s) => s.key === sectionKey);
  if (legacy) return { key: legacy.key, name: legacy.name };
  const dd = DD_REPORT_SECTIONS.find((s) => s.key === sectionKey);
  if (dd) return { key: dd.key, name: dd.name };
  return null;
}

export type WorkflowProgressMap = Record<string, boolean>;

export type WorkspacePayload = {
  projectStatus: string;
  ownerName: string;
  promptTemplate: string;
  reportTemplate: string;
  progress: WorkflowProgressMap;
};

export function normalizeProgress(value: unknown): WorkflowProgressMap {
  const base: WorkflowProgressMap = {};
  for (const step of WORKFLOW_STEPS) base[step] = false;
  if (!value || typeof value !== "object") return base;
  const obj = value as Record<string, unknown>;
  for (const step of WORKFLOW_STEPS) {
    if (typeof obj[step] === "boolean") base[step] = obj[step];
  }
  return base;
}

export function normalizeWorkspaceInput(input: Partial<WorkspacePayload>) {
  return {
    projectStatus: (input.projectStatus ?? "").trim() || "待处理",
    ownerName: (input.ownerName ?? "").trim(),
    promptTemplate: (input.promptTemplate ?? "").trim(),
    reportTemplate: (input.reportTemplate ?? "").trim(),
    progress: normalizeProgress(input.progress),
  };
}
