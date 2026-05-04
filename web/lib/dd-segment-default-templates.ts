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

/** 每次更新内置默认时递增，用于强制刷新用户 localStorage 中的旧模版 */
export const QUICK_EXAM_TEMPLATE_VERSION = "v3";

const QUICK_EXAM_REPORT_DEFAULT: DdSegmentDefaultBlock = {
  prompt:
    "你是谨慎、务实的企业法律体检顾问，为律所出具面向客户的初步快速体检报告。\n\n" +
    "【角色与约束】\n" +
    "- 严格依据「问卷数据」与「三方速查附件要点」作出判断，不得编造或臆测。\n" +
    "- 未填写或无数据的项目，跳过对应模块，不作推断。\n" +
    "- 语言：简体中文，专业、克制，避免夸大或渲染风险。\n" +
    "- 优先级标准：高（可能触发即时法律责任或监管处罚）、中高（存在结构性隐患需尽快处理）、中（一般合规缺口）、低（建议关注但暂无紧迫性）。\n\n" +
    "【模块选择】\n" +
    "- 依据问卷与三方速查，从以下领域中筛选有实质内容的模块：人力资源、股权投融资、税收法律、知识产权、婚家传承、国际商事、商业刑事、困境挽救。\n" +
    "- 通常生成 3–6 个模块；无实质风险或数据不足的领域不得强行生成。\n" +
    "- 模块标题格式：### 序号、领域名称模块    优先级：高/中高/中/低\n\n" +
    "【格式要求】\n" +
    "- 严格按照 output.md 的层级与标题生成，不得新增或删减结构层级。\n" +
    "- 标题只使用 ## 和 ### 两级，禁止使用 # 一级标题或四级以下标题。\n" +
    "- 每个模块格式：### 标题行（含优先级）→ 一句话核心结论段 → 背景说明段 → 编号建议列表。\n" +
    "- 每条建议：**加粗标题（6 字以内）** 另起一行，再接一整段说明（说明与标题之间空一行）。\n" +
    "- 「重点整改顺序建议」节按阶段用加粗标题分列，不使用表格，不使用多级列表。\n" +
    "- 全文不使用表格；段落间空一行，章节标题前后各空一行。\n",
  outputFull:
    "## 企业法律快速体检报告\n\n" +
    "**委托方：**（公司名称）\n" +
    "**出具单位：**（律所名称）\n" +
    "**出具日期：**（生成日期）\n\n" +
    "---\n\n" +
    "### 报告摘要\n\n" +
    "（2–4 句综合评估：基于问卷与三方速查，概括企业整体合规态势，点出 1–3 个核心风险领域，说明本报告分析方向。）\n\n" +
    "---\n\n" +
    "### 一、（领域名称）模块    优先级：高/中高/中/低\n\n" +
    "（一句话核心结论：点明该领域现状与主要问题方向。）\n\n" +
    "（1–2 段背景说明：基于问卷反馈与三方速查，说明已有基础与存在不足。）\n\n" +
    "1. **（建议标题，6 字以内）**\n\n" +
    "   （具体可执行的建议，1–2 句。说明做什么、如何操作、紧迫性。）\n\n" +
    "2. **（建议标题）**\n\n" +
    "   （建议内容。）\n\n" +
    "3. **（建议标题）**\n\n" +
    "   （建议内容。）\n\n" +
    "### 二、（领域名称）模块    优先级：...\n\n" +
    "（按上述格式继续生成，通常 3–6 个模块，每模块 2–5 条建议。）\n\n" +
    "---\n\n" +
    "### 重点整改顺序建议\n\n" +
    "**第一阶段（1 个月内）**：（高优先级紧急事项，简要列举。）\n\n" +
    "**第二阶段（2–3 个月内）**：（中高优先级重要事项。）\n\n" +
    "**第三阶段（3–6 个月内）**：（中期推进事项。）\n\n" +
    "---\n\n" +
    "### 免责声明\n\n" +
    "本报告依据委托方提供的问卷数据及三方速查资料出具，仅供参考，不构成正式法律意见。如需进一步核实或采取法律行动，请委托专业律师开展详细尽职调查。\n",
  outputSubsections: [],
};

export function getDdSegmentDefaultTemplate(sectionKey: string): DdSegmentDefaultBlock | null {
  if (sectionKey === LEXCHECK_QUICK_EXAM_SECTION_KEY) return QUICK_EXAM_REPORT_DEFAULT;
  return DD_SEGMENT_DEFAULT_TEMPLATES[sectionKey] ?? null;
}

