export type PreliminaryChunkSummary = {
  sourceFileName: string;
  chunkIndex: number;
  basicInfo: string[];
  shareholders: string[];
  management: string[];
  investments: string[];
  changeRecords: string[];
  legalRisks: string[];
  businessRisks: string[];
  qualifications: string[];
  licenses: string[];
  taxInfo: string[];
  employmentInfo: string[];
  ipInfo: string[];
  otherImportantFindings: string[];
};

const ARRAY_KEYS: (keyof PreliminaryChunkSummary)[] = [
  "basicInfo",
  "shareholders",
  "management",
  "investments",
  "changeRecords",
  "legalRisks",
  "businessRisks",
  "qualifications",
  "licenses",
  "taxInfo",
  "employmentInfo",
  "ipInfo",
  "otherImportantFindings",
];

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x).trim()).filter(Boolean);
}

export function normalizeChunkSummary(raw: unknown, sourceFileName: string, chunkIndex: number): PreliminaryChunkSummary {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const base: PreliminaryChunkSummary = {
    sourceFileName: String(o.sourceFileName ?? sourceFileName),
    chunkIndex: Number.isFinite(Number(o.chunkIndex)) ? Number(o.chunkIndex) : chunkIndex,
    basicInfo: [],
    shareholders: [],
    management: [],
    investments: [],
    changeRecords: [],
    legalRisks: [],
    businessRisks: [],
    qualifications: [],
    licenses: [],
    taxInfo: [],
    employmentInfo: [],
    ipInfo: [],
    otherImportantFindings: [],
  };
  for (const k of ARRAY_KEYS) {
    if (k === "sourceFileName" || k === "chunkIndex") continue;
    base[k] = asStringArray(o[k]);
  }
  return base;
}

function normItem(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

function mergeUnique(a: string[], b: string[]): string[] {
  const seen = new Set(a.map(normItem));
  const out = [...a];
  for (const x of b) {
    const n = normItem(x);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push(x);
  }
  return out;
}

export function mergePreliminarySummaries(chunks: PreliminaryChunkSummary[]): PreliminaryChunkSummary {
  const empty = (): PreliminaryChunkSummary => ({
    sourceFileName: "",
    chunkIndex: -1,
    basicInfo: [],
    shareholders: [],
    management: [],
    investments: [],
    changeRecords: [],
    legalRisks: [],
    businessRisks: [],
    qualifications: [],
    licenses: [],
    taxInfo: [],
    employmentInfo: [],
    ipInfo: [],
    otherImportantFindings: [],
  });
  if (chunks.length === 0) return empty();
  const acc = empty();
  for (const c of chunks) {
    for (const k of ARRAY_KEYS) {
      if (k === "sourceFileName" || k === "chunkIndex") continue;
      acc[k] = mergeUnique(acc[k], c[k]);
    }
  }
  acc.sourceFileName = "（合并）";
  acc.chunkIndex = -1;
  return acc;
}

export function mergedSummaryToNarrative(m: PreliminaryChunkSummary): string {
  const lines: string[] = [];
  const push = (title: string, arr: string[]) => {
    if (arr.length === 0) return;
    lines.push(`### ${title}`);
    for (const x of arr) lines.push(`- ${x}`);
    lines.push("");
  };
  push("基本信息", m.basicInfo);
  push("股东", m.shareholders);
  push("管理层", m.management);
  push("对外投资", m.investments);
  push("变更记录", m.changeRecords);
  push("法律风险 / 诉讼与处罚", m.legalRisks);
  push("经营风险", m.businessRisks);
  push("资质", m.qualifications);
  push("许可", m.licenses);
  push("税务", m.taxInfo);
  push("劳动用工", m.employmentInfo);
  push("知识产权", m.ipInfo);
  push("其他重要发现", m.otherImportantFindings);
  const body = lines.join("\n").trim();
  return body || "（附件摘要合并后无结构化要点；请以问卷为主，附件为辅。）";
}
