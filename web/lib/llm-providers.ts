/**
 * 国内常用、且多为 OpenAI 兼容 /chat/completions 的供应商预设。
 * 实际以各厂商文档为准；用户可在「自定义」中填写 base URL。
 */
export type LlmProviderDef = {
  id: string;
  label: string;
  /** 不含尾部斜杠；与 `/chat/completions` 拼接 */
  baseUrl: string;
  models: string[];
};

export const LLM_PROVIDERS: LlmProviderDef[] = [
  {
    id: "dashscope",
    label: "阿里云通义千问（百炼兼容模式）",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    models: ["qwen-plus", "qwen-turbo", "qwen-max", "qwen3.7-max", "qwen3.7-plus", "qwen3.6-flash"],
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    // deepseek-chat/deepseek-reasoner 将于 2026-07-24 弃用，请优先使用 v4 系列。
    models: ["deepseek-v4-pro", "deepseek-v4-flash", "deepseek-chat", "deepseek-reasoner"],
  },
  {
    id: "zhipu",
    label: "智谱 AI（GLM，OpenAPI）",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    models: ["glm-5.2", "glm-5.1", "glm-5", "glm-4.7-flash", "glm-4.6", "glm-4-flash-250414"],
  },
  {
    id: "moonshot",
    label: "月之暗面 Moonshot",
    baseUrl: "https://api.moonshot.cn/v1",
    models: ["kimi-k2.7-code", "kimi-k2.6", "kimi-k2.5", "moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k"],
  },
  {
    id: "custom",
    label: "自定义（手动填写 Base URL）",
    baseUrl: "",
    models: [],
  },
];

export function getProviderById(id: string): LlmProviderDef | undefined {
  return LLM_PROVIDERS.find((p) => p.id === id);
}
