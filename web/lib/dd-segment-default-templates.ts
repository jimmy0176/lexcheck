import raw from "./dd-segment-default-templates.json";

export type DdSegmentDefaultSubsection = { title: string; body: string };

export type DdSegmentDefaultBlock = {
  prompt: string;
  outputFull: string;
  outputSubsections: DdSegmentDefaultSubsection[];
};

/** 由 `尽调报告_14个MD模板` 解析生成的内置默认（dd_01…dd_14） */
export const DD_SEGMENT_DEFAULT_TEMPLATES = raw as Record<string, DdSegmentDefaultBlock>;

/** 与尽调分部共用 SegmentTemplateSettingsDialog；勿写入 json，以免被 build:dd-templates 覆盖 */
export const LEXCHECK_QUICK_EXAM_SECTION_KEY = "lexcheck_quick_exam_report";

const QUICK_EXAM_REPORT_DEFAULT: DdSegmentDefaultBlock = {
  prompt:
    "你是企业法律体检助手。请根据「问卷数据」生成《快速体检报告》正文。\n" +
    "要求：\n" +
    "1. 使用简体中文，专业、克制。\n" +
    "2. 严格依据问卷答案与规则引擎风险识别结果，不编造。\n" +
    "3. 按 output.md 中的层级与小标题组织正文。\n" +
    "4. 对未填写项可标注「未提供」，不要臆测。\n",
  outputFull:
    "## 快速体检报告\n\n" +
    "### 一、总体判断\n\n" +
    "（概括企业当前合规态势与风险等级判断依据。）\n\n" +
    "### 二、主要风险与关注项\n\n" +
    "请使用 **Markdown 表格**（GFM），示例：\n\n" +
    "| 风险类型 | 风险描述 | 等级 | 依据或信息来源 |\n" +
    "| --- | --- | --- | --- |\n" +
    "| 示例 | （简述） | 高/中/低 | （问卷或三方速查） |\n\n" +
    "### 三、建议与后续动作\n\n" +
    "建议同样优先用表格列出（可执行、可排序），示例：\n\n" +
    "| 优先级 | 建议事项 | 责任/配合方 | 备注 |\n" +
    "| --- | --- | --- | --- |\n" +
    "| P1 | （示例） | — | — |\n",
  outputSubsections: [
    {
      title: "快速体检报告",
      body:
        "### 一、总体判断\n\n### 二、主要风险与关注项\n\n### 三、建议与后续动作\n",
    },
  ],
};

export function getDdSegmentDefaultTemplate(sectionKey: string): DdSegmentDefaultBlock | null {
  if (sectionKey === LEXCHECK_QUICK_EXAM_SECTION_KEY) return QUICK_EXAM_REPORT_DEFAULT;
  return DD_SEGMENT_DEFAULT_TEMPLATES[sectionKey] ?? null;
}

