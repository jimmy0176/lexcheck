import ExcelJS from "exceljs";
import type {
  QuestionnaireConfig,
  QuestionnaireOption,
  QuestionnaireQuestion,
  QuestionnaireSection,
} from "@/lib/questionnaire-types";

const SECTION_SHEET = "章节";
const QUESTION_SHEET = "题目";
const OPTION_SHEET = "选项";

const SECTION_HEADERS = ["章节ID", "标题", "顺序", "满分（留空=不计分）"];
const QUESTION_HEADERS = [
  "题号",
  "所属章节ID",
  "类型（single_choice/textarea/multi_choice_with_other）",
  "题干",
  "是否必填（是/否）",
  "备注（多条用;分隔）",
  "占位符",
  "多选题-启用其他选项（是/否）",
  "跳转门槛-触发选项值",
  "跳转门槛-跳过题号（逗号分隔）",
];
const OPTION_HEADERS = ["题号", "选项值", "选项文案", "分值（0-1，留空=不计分）", "风险描述", "整改建议"];

const TYPE_ALIASES: Record<string, QuestionnaireQuestion["type"]> = {
  single_choice: "single_choice",
  单选: "single_choice",
  单选题: "single_choice",
  textarea: "textarea",
  文本: "textarea",
  文本题: "textarea",
  开放题: "textarea",
  multi_choice_with_other: "multi_choice_with_other",
  多选: "multi_choice_with_other",
  多选题: "multi_choice_with_other",
};

const TRUE_PATTERN = /^(是|true|1|yes)$/i;

export type QuestionnaireXlsxError = { sheet: string; row: number; message: string };
export type ParseQuestionnaireResult =
  | { ok: true; config: QuestionnaireConfig }
  | { ok: false; errors: QuestionnaireXlsxError[] };

export function buildQuestionnaireWorkbook(config: QuestionnaireConfig): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();

  const sectionSheet = wb.addWorksheet(SECTION_SHEET);
  sectionSheet.addRow(SECTION_HEADERS);
  for (const s of config.sections) {
    sectionSheet.addRow([s.sectionId, s.title, s.order, s.maxScore ?? ""]);
  }

  const questionSheet = wb.addWorksheet(QUESTION_SHEET);
  questionSheet.addRow(QUESTION_HEADERS);
  for (const s of config.sections) {
    for (const q of s.questions) {
      const skipGate = q.type === "single_choice" ? q.skipGate : undefined;
      const other = q.type === "multi_choice_with_other" ? q.other : undefined;
      questionSheet.addRow([
        q.qid,
        s.sectionId,
        q.type,
        q.question,
        q.required ? "是" : "",
        (q.notes ?? []).join(";"),
        q.type === "textarea" ? (q.placeholder ?? "") : (other?.placeholder ?? ""),
        q.type === "multi_choice_with_other" ? (other?.enabled ? "是" : "否") : "",
        skipGate?.triggerValue ?? "",
        (skipGate?.skipQids ?? []).join(","),
      ]);
    }
  }

  const optionSheet = wb.addWorksheet(OPTION_SHEET);
  optionSheet.addRow(OPTION_HEADERS);
  for (const s of config.sections) {
    for (const q of s.questions) {
      if (q.type !== "single_choice" && q.type !== "multi_choice_with_other") continue;
      for (const opt of q.options) {
        optionSheet.addRow([q.qid, opt.value, opt.label, opt.score ?? "", opt.riskText ?? "", opt.adviceText ?? ""]);
      }
    }
  }

  return wb;
}

function cellStr(row: ExcelJS.Row, col: number): string {
  const v = row.getCell(col).value;
  if (v == null) return "";
  if (typeof v === "object") {
    const obj = v as { text?: unknown; richText?: Array<{ text: string }>; result?: unknown };
    if (Array.isArray(obj.richText)) return obj.richText.map((t) => t.text).join("").trim();
    if (typeof obj.text === "string") return obj.text.trim();
    if (obj.result != null) return String(obj.result).trim();
    return "";
  }
  return String(v).trim();
}

export async function parseQuestionnaireWorkbook(buffer: Buffer): Promise<ParseQuestionnaireResult> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer as unknown as Parameters<typeof wb.xlsx.load>[0]);
  } catch {
    return { ok: false, errors: [{ sheet: "", row: 0, message: "无法解析该文件，请确认是有效的 .xlsx 文件" }] };
  }

  const errors: QuestionnaireXlsxError[] = [];
  const sectionSheet = wb.getWorksheet(SECTION_SHEET);
  const questionSheet = wb.getWorksheet(QUESTION_SHEET);
  const optionSheet = wb.getWorksheet(OPTION_SHEET);
  if (!sectionSheet) errors.push({ sheet: SECTION_SHEET, row: 0, message: `缺少「${SECTION_SHEET}」工作表` });
  if (!questionSheet) errors.push({ sheet: QUESTION_SHEET, row: 0, message: `缺少「${QUESTION_SHEET}」工作表` });
  if (!optionSheet) errors.push({ sheet: OPTION_SHEET, row: 0, message: `缺少「${OPTION_SHEET}」工作表` });
  if (errors.length > 0) return { ok: false, errors };

  type RawSection = { row: number; sectionId: string; title: string; order: number; maxScore?: number };
  const sections: RawSection[] = [];
  const sectionIds = new Set<string>();
  sectionSheet!.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const sectionId = cellStr(row, 1);
    if (!sectionId) return;
    const title = cellStr(row, 2);
    const orderStr = cellStr(row, 3);
    const maxScoreStr = cellStr(row, 4);

    if (sectionIds.has(sectionId)) {
      errors.push({ sheet: SECTION_SHEET, row: rowNumber, message: `章节ID「${sectionId}」重复` });
    }
    sectionIds.add(sectionId);
    if (!title) errors.push({ sheet: SECTION_SHEET, row: rowNumber, message: "标题不能为空" });

    let order = sections.length + 1;
    if (orderStr) {
      const n = Number(orderStr);
      if (!Number.isFinite(n)) errors.push({ sheet: SECTION_SHEET, row: rowNumber, message: "顺序必须是数字" });
      else order = n;
    }
    let maxScore: number | undefined;
    if (maxScoreStr) {
      const n = Number(maxScoreStr);
      if (!Number.isFinite(n)) errors.push({ sheet: SECTION_SHEET, row: rowNumber, message: "满分必须是数字" });
      else maxScore = n;
    }
    sections.push({ row: rowNumber, sectionId, title, order, maxScore });
  });
  if (sections.length === 0) errors.push({ sheet: SECTION_SHEET, row: 0, message: "至少需要 1 个章节" });

  type RawQuestion = {
    row: number;
    qid: string;
    sectionId: string;
    type: QuestionnaireQuestion["type"];
    question: string;
    required: boolean;
    notes: string[];
    placeholder: string;
    otherEnabled: boolean;
    skipTrigger: string;
    skipQids: string[];
  };
  const questions: RawQuestion[] = [];
  const qids = new Set<string>();
  questionSheet!.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const qid = cellStr(row, 1);
    if (!qid) return;
    const sectionId = cellStr(row, 2);
    const typeRaw = cellStr(row, 3);
    const type = TYPE_ALIASES[typeRaw];
    const question = cellStr(row, 4);
    const requiredRaw = cellStr(row, 5);
    const notesRaw = cellStr(row, 6);
    const placeholder = cellStr(row, 7);
    const otherEnabledRaw = cellStr(row, 8);
    const skipTrigger = cellStr(row, 9);
    const skipQidsRaw = cellStr(row, 10);

    if (qids.has(qid)) errors.push({ sheet: QUESTION_SHEET, row: rowNumber, message: `题号「${qid}」重复` });
    qids.add(qid);
    if (!sectionId || !sectionIds.has(sectionId)) {
      errors.push({
        sheet: QUESTION_SHEET,
        row: rowNumber,
        message: `所属章节ID「${sectionId}」在「${SECTION_SHEET}」表中不存在`,
      });
    }
    if (!type) {
      errors.push({
        sheet: QUESTION_SHEET,
        row: rowNumber,
        message: `类型「${typeRaw}」不合法，必须是 single_choice / textarea / multi_choice_with_other`,
      });
    }
    if (!question) errors.push({ sheet: QUESTION_SHEET, row: rowNumber, message: "题干不能为空" });

    questions.push({
      row: rowNumber,
      qid,
      sectionId,
      type: type ?? "textarea",
      question,
      required: TRUE_PATTERN.test(requiredRaw),
      notes: notesRaw ? notesRaw.split(";").map((s) => s.trim()).filter(Boolean) : [],
      placeholder,
      otherEnabled: TRUE_PATTERN.test(otherEnabledRaw),
      skipTrigger,
      skipQids: skipQidsRaw ? skipQidsRaw.split(",").map((s) => s.trim()).filter(Boolean) : [],
    });
  });
  if (questions.length === 0) errors.push({ sheet: QUESTION_SHEET, row: 0, message: "至少需要 1 道题目" });

  for (const q of questions) {
    for (const sq of q.skipQids) {
      if (!qids.has(sq)) {
        errors.push({
          sheet: QUESTION_SHEET,
          row: q.row,
          message: `题号「${q.qid}」的跳转门槛引用了不存在的题号「${sq}」`,
        });
      }
    }
  }

  type RawOption = {
    row: number;
    qid: string;
    value: string;
    label: string;
    score?: number;
    riskText?: string;
    adviceText?: string;
  };
  const options: RawOption[] = [];
  optionSheet!.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const qid = cellStr(row, 1);
    if (!qid) return;
    const value = cellStr(row, 2);
    const label = cellStr(row, 3);
    const scoreStr = cellStr(row, 4);
    const riskText = cellStr(row, 5);
    const adviceText = cellStr(row, 6);

    if (!qids.has(qid)) {
      errors.push({ sheet: OPTION_SHEET, row: rowNumber, message: `题号「${qid}」在「${QUESTION_SHEET}」表中不存在` });
    }
    if (!value) errors.push({ sheet: OPTION_SHEET, row: rowNumber, message: "选项值不能为空" });
    if (!label) errors.push({ sheet: OPTION_SHEET, row: rowNumber, message: "选项文案不能为空" });

    let score: number | undefined;
    if (scoreStr) {
      const n = Number(scoreStr);
      if (!Number.isFinite(n)) errors.push({ sheet: OPTION_SHEET, row: rowNumber, message: "分值必须是数字" });
      else score = n;
    }
    options.push({
      row: rowNumber,
      qid,
      value,
      label,
      score,
      riskText: riskText || undefined,
      adviceText: adviceText || undefined,
    });
  });

  const seenOptKey = new Map<string, number>();
  for (const o of options) {
    const key = `${o.qid}::${o.value}`;
    if (seenOptKey.has(key)) {
      errors.push({ sheet: OPTION_SHEET, row: o.row, message: `题号「${o.qid}」下选项值「${o.value}」重复` });
    }
    seenOptKey.set(key, o.row);
  }

  const optsByQid = new Map<string, RawOption[]>();
  for (const o of options) {
    if (!optsByQid.has(o.qid)) optsByQid.set(o.qid, []);
    optsByQid.get(o.qid)!.push(o);
  }
  for (const q of questions) {
    if ((q.type === "single_choice" || q.type === "multi_choice_with_other") && !optsByQid.get(q.qid)?.length) {
      errors.push({ sheet: OPTION_SHEET, row: q.row, message: `题号「${q.qid}」是选择题但在「${OPTION_SHEET}」表中没有任何选项` });
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  const sortedSections = [...sections].sort((a, b) => a.order - b.order);
  const configSections: QuestionnaireSection[] = sortedSections.map((s) => {
    const sectionQuestions = questions.filter((q) => q.sectionId === s.sectionId);
    const builtQuestions: QuestionnaireQuestion[] = sectionQuestions.map((q) => {
      const opts: QuestionnaireOption[] = (optsByQid.get(q.qid) ?? []).map((o) => ({
        value: o.value,
        label: o.label,
        score: o.score,
        riskText: o.riskText,
        adviceText: o.adviceText,
      }));
      const base = {
        qid: q.qid,
        question: q.question,
        required: q.required || undefined,
        notes: q.notes.length ? q.notes : undefined,
      };
      if (q.type === "single_choice") {
        return {
          ...base,
          type: "single_choice" as const,
          options: opts,
          skipGate:
            q.skipTrigger && q.skipQids.length ? { triggerValue: q.skipTrigger, skipQids: q.skipQids } : undefined,
        };
      }
      if (q.type === "multi_choice_with_other") {
        return {
          ...base,
          type: "multi_choice_with_other" as const,
          options: opts,
          other: q.otherEnabled || q.placeholder ? { enabled: q.otherEnabled, placeholder: q.placeholder || undefined } : undefined,
        };
      }
      return { ...base, type: "textarea" as const, placeholder: q.placeholder || undefined };
    });
    return { sectionId: s.sectionId, title: s.title, order: s.order, maxScore: s.maxScore, questions: builtQuestions };
  });

  const config: QuestionnaireConfig = {
    formKey: "template",
    title: "",
    version: new Date().toISOString(),
    sections: configSections,
  };

  return { ok: true, config };
}
