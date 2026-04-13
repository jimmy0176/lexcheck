import type { Answers, QuestionnaireConfig } from "@/lib/questionnaire-types";

export type GeneratedAdvice = {
  riskLevel: "低" | "中" | "高";
  summary: string;
  riskHighlights: string[];
  recommendations: string[];
};

export type RiskAnalysis = {
  riskLevel: "低" | "中" | "高";
  riskItems: string[];
  textConcerns: string[];
};

function answerLabel(
  answer: Answers[string] | undefined,
  question: QuestionnaireConfig["sections"][number]["questions"][number]
) {
  if (!answer) return "未填写";
  if (question.type === "single_choice" && answer.kind === "single_choice") {
    if (!answer.value) return "未填写";
    return question.options.find((o) => o.value === answer.value)?.label ?? answer.value;
  }
  if (question.type === "textarea" && answer.kind === "textarea") {
    const value = answer.value.trim();
    return value || "未填写";
  }
  if (
    question.type === "multi_choice_with_other" &&
    answer.kind === "multi_choice_with_other"
  ) {
    const labels = answer.values.map(
      (v) => question.options.find((o) => o.value === v)?.label ?? v
    );
    const other = (answer.otherText ?? "").trim();
    if (other) labels.push(`其他：${other}`);
    return labels.length ? labels.join("；") : "未填写";
  }
  return "未填写";
}

function isRisk(
  answer: Answers[string] | undefined,
  question: QuestionnaireConfig["sections"][number]["questions"][number]
) {
  if (!answer) return false;
  if (question.type === "single_choice" && answer.kind === "single_choice") {
    const first = question.options[0]?.value;
    return Boolean(first && answer.value && answer.value !== first);
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

export function analyzeRisk(config: QuestionnaireConfig, answers: Answers): RiskAnalysis {
  const riskItems: string[] = [];
  const textConcerns: string[] = [];

  for (const section of config.sections) {
    for (const q of section.questions) {
      const a = answers[q.qid];
      if (isRisk(a, q)) {
        riskItems.push(`${section.title} - ${q.qid}：${answerLabel(a, q)}`);
      }
      if (q.type === "textarea" && a?.kind === "textarea" && a.value.trim()) {
        textConcerns.push(`${section.title} - ${q.qid}：${a.value.trim()}`);
      }
    }
  }

  const riskCount = riskItems.length;
  const riskLevel: GeneratedAdvice["riskLevel"] =
    riskCount >= 12 ? "高" : riskCount >= 5 ? "中" : "低";

  return { riskLevel, riskItems, textConcerns };
}

export function generateRuleAdvice(config: QuestionnaireConfig, answers: Answers): GeneratedAdvice {
  const { riskLevel, riskItems, textConcerns } = analyzeRisk(config, answers);
  const riskCount = riskItems.length;

  const recommendations = [
    "先按高风险章节建立整改清单，明确责任人和完成时间。",
    "优先补齐对应证据材料（合同、制度、决议、付款凭证、授权文件）。",
    "对连续出现非首选答案的章节安排专项合规复核与律师复评。",
    "针对可能触发争议的事项，提前准备沟通口径与应对预案。",
    "整改完成后建议二次体检，形成留痕闭环。",
  ];

  if (riskCount === 0) {
    return {
      riskLevel,
      summary: "当前问卷未识别到明显风险选项，建议保持现有合规流程并定期复核。",
      riskHighlights: textConcerns.slice(0, 5),
      recommendations: recommendations.slice(0, 3),
    };
  }

  return {
    riskLevel,
    summary: `本次共识别 ${riskCount} 项潜在风险（按“非第一选项”规则），建议优先处理高频风险章节。`,
    riskHighlights: riskItems.slice(0, 8),
    recommendations,
  };
}

export type DeepSeekAdviceResult = {
  text: string | null;
  error?: string;
  httpStatus?: number;
};

function extractMessageContent(data: unknown): string | null {
  const d = data as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const raw = d.choices?.[0]?.message?.content;
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  return t.length > 0 ? t : null;
}

export async function generateDeepSeekAdvice(
  config: QuestionnaireConfig,
  answers: Answers,
  options?: { attachmentSummary?: string | null }
): Promise<DeepSeekAdviceResult> {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) {
    return { text: null, error: "未配置 DEEPSEEK_API_KEY" };
  }

  const { riskItems } = analyzeRisk(config, answers);
  const topRiskItems = riskItems.slice(0, 5);
  let riskText = topRiskItems.length
    ? topRiskItems.map((item, idx) => `${idx + 1}. ${item}`).join("\n")
    : "暂无风险项";
  const maxRiskChars = 6000;
  if (riskText.length > maxRiskChars) {
    riskText = `${riskText.slice(0, maxRiskChars)}…（已截断）`;
  }

  const prompt = [
    "你是资深企业法律顾问，请基于问卷风险点与补充材料输出详细分析报告。",
    "要求：",
    "1) 输出中文，结构化小标题分段；",
    "2) 必含：总体风险判断、按章节风险分析、关键证据/依据、优先级整改清单（短中长期）、需进一步核查事项；",
    "3) 如存在补充材料，必须与问卷风险点交叉印证，避免臆测；",
    "4) 结论务实、可执行，尽量给出明确动作和责任建议。",
    "",
    "风险点：",
    riskText,
    ...(options?.attachmentSummary
      ? ["", "补充材料摘要：", options.attachmentSummary]
      : []),
  ].join("\n");

  const base =
    process.env.DEEPSEEK_API_BASE_URL?.trim().replace(/\/+$/, "") ||
    "https://api.deepseek.com";
  const url = `${base}/chat/completions`;

  const body = JSON.stringify({
    model: process.env.DEEPSEEK_MODEL?.trim() || "deepseek-chat",
    stream: false,
    temperature: 0.2,
    max_tokens: 1200,
    messages: [
      { role: "system", content: "你是一名谨慎、实务导向的企业合规律师。" },
      { role: "user", content: prompt },
    ],
  });

  const callOnce = async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90000);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "User-Agent": "Lexcheck/1.0 (Next.js server)",
        },
        body,
        signal: controller.signal,
        cache: "no-store",
      });

      const rawBody = await res.text();
      if (!res.ok) {
        const snippet = rawBody.slice(0, 280);
        console.error("[deepseek] non-200", res.status, snippet);
        return {
          text: null as string | null,
          error: `HTTP ${res.status}${snippet ? `: ${snippet}` : ""}`,
          httpStatus: res.status,
        };
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(rawBody) as unknown;
      } catch {
        return {
          text: null,
          error: "响应不是合法 JSON",
          httpStatus: res.status,
        };
      }

      const content = extractMessageContent(parsed);
      if (!content) {
        return {
          text: null,
          error: `返回正文为空（请检查模型/额度）。片段：${rawBody.slice(0, 200)}`,
          httpStatus: res.status,
        };
      }
      const text = content.length > 3000 ? `${content.slice(0, 3000)}…` : content;
      return { text };
    } catch (e) {
      const name = e instanceof Error ? e.name : "Error";
      const msg = e instanceof Error ? e.message : String(e);
      if (name === "AbortError") {
        return { text: null, error: `请求超时（90s）` };
      }
      return { text: null, error: `${name}: ${msg}` };
    } finally {
      clearTimeout(timeout);
    }
  };

  try {
    let result = await callOnce();
    const err = result.error ?? "";
    const retriable =
      result.text == null &&
      err &&
      (err.includes("请求超时") ||
        err.includes("fetch failed") ||
        err.includes("ECONNRESET") ||
        err.includes("ETIMEDOUT") ||
        err.includes("socket") ||
        err.includes("ENOTFOUND") ||
        err.includes("EAI_AGAIN"));
    if (retriable) {
      await new Promise((r) => setTimeout(r, 1200));
      result = await callOnce();
    }
    return result.text != null
      ? { text: result.text }
      : {
          text: null,
          error: result.error,
          httpStatus: result.httpStatus,
        };
  } catch (e) {
    const name = e instanceof Error ? e.name : "Error";
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[deepseek] request failed", e);
    if (name === "AbortError") {
      return { text: null, error: "请求超时（已取消），可稍后重试或在 .env 增加 NODE_OPTIONS=--dns-result-order=ipv4first" };
    }
    return { text: null, error: `${name}: ${msg}` };
  }
}
