"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { LLM_PROVIDERS, getProviderById } from "@/lib/llm-providers";

export function LlmSettingsPanel() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [providerId, setProviderId] = useState("dashscope");
  const [modelName, setModelName] = useState("qwen-turbo");
  const [apiKey, setApiKey] = useState("");
  const [customBaseUrl, setCustomBaseUrl] = useState("");
  const [testing, setTesting] = useState(false);
  const [testHint, setTestHint] = useState<string | null>(null);

  const currentProvider = useMemo(() => getProviderById(providerId), [providerId]);

  useEffect(() => {
    fetch("/api/lawyer/me/llm-profile")
      .then((res) => res.json())
      .then((json: { profile?: { providerId: string; model: string; apiKey: string; baseUrl: string } }) => {
        const profile = json.profile;
        if (!profile) return;
        const pid = getProviderById(profile.providerId) ? profile.providerId : "dashscope";
        setProviderId(pid);
        setApiKey(profile.apiKey);
        setCustomBaseUrl(profile.baseUrl);
        const p = getProviderById(pid);
        const defaultModel = p?.models?.[0] ?? "qwen-turbo";
        setModelName(profile.model || defaultModel);
      })
      .catch(() => {
        // ignore：保持默认值
      });
  }, []);

  async function saveModelProfile() {
    try {
      const res = await fetch("/api/lawyer/me/llm-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId,
          model: modelName.trim(),
          apiKey: apiKey.trim(),
          baseUrl: customBaseUrl.trim(),
        }),
      });
      if (!res.ok) throw new Error("保存失败");
      setMessage("大模型设置已保存到当前账号，登录本账号的任意设备均可使用。");
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }

  async function testConnection() {
    setTesting(true);
    setTestHint(null);
    setError(null);
    try {
      const res = await fetch("/api/lawyer/llm/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId,
          model: modelName.trim(),
          apiKey: apiKey.trim(),
          baseUrlOverride: providerId === "custom" ? customBaseUrl.trim() : undefined,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        message?: string;
        error?: string;
        elapsedMs?: number;
      };
      if (json.ok) {
        setTestHint(json.message ?? "连通成功");
      } else {
        setTestHint(null);
        setError(json.error ?? "连通失败");
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto px-8 py-4">
      <div className="max-w-2xl space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">大模型设置</h1>
          <p className="mt-2 text-xs text-muted-foreground">
            连通性测试使用 OpenAI 兼容接口{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-[11px]">POST /chat/completions</code>
            ；此处设置的 Key 关联到当前登录账号，登录本账号的任意设备均可使用，生成报告时优先调用。
            若未配置或调用失败，会依次尝试管理员配置的共用 Key、共用备用 Key。
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            体检报告「高级模式」会把问卷全量数据和三方报告一起提交，内容较长时对模型的上下文窗口要求较高，
            建议优先选择各供应商的旗舰或长文本档位（如 qwen-max/qwen-plus、deepseek-v4-pro、glm-5.2、moonshot-v1-128k
            等上下文窗口较大的型号），避免用较小上下文的轻量档位处理长三方报告。
          </p>
        </div>

        {message || error ? (
          <div
            className={`rounded-md border px-3 py-2 text-sm ${
              error ? "border-destructive/40 text-destructive" : "border-border text-muted-foreground"
            }`}
          >
            {error ?? message}
          </div>
        ) : null}

        <div className="grid gap-3">
          <label className="space-y-1">
            <span className="text-sm text-muted-foreground">模型供应商</span>
            <select
              value={providerId}
              onChange={(e) => {
                const next = e.target.value;
                setProviderId(next);
                const p = getProviderById(next);
                if (p?.models?.length) setModelName(p.models[0]);
                else if (next === "custom") setModelName("");
              }}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              {LLM_PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          {providerId === "custom" ? (
            <label className="space-y-1">
              <span className="text-sm text-muted-foreground">Base URL（OpenAI 兼容根路径）</span>
              <input
                value={customBaseUrl}
                onChange={(e) => setCustomBaseUrl(e.target.value)}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm font-mono"
                placeholder="例如：https://api.example.com/v1"
              />
            </label>
          ) : null}
          <label className="space-y-1">
            <span className="text-sm text-muted-foreground">模型名称</span>
            {currentProvider?.models && currentProvider.models.length > 0 ? (
              <select
                value={currentProvider.models.includes(modelName) ? modelName : "__custom__"}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "__custom__") {
                    if (currentProvider.models.includes(modelName)) setModelName("");
                  } else {
                    setModelName(v);
                  }
                }}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                {currentProvider.models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
                <option value="__custom__">其他（使用下方输入）</option>
              </select>
            ) : null}
            <input
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              className={`h-10 w-full rounded-md border bg-background px-3 text-sm ${
                currentProvider?.models?.length ? "mt-2" : ""
              }`}
              placeholder="填写模型名称，或 Endpoint 对应模型 ID"
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm text-muted-foreground">接口密钥</span>
            <input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              placeholder="输入 API Key（保存到当前账号）"
              type="password"
              autoComplete="off"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" disabled={testing} onClick={() => void testConnection()}>
              {testing ? "检测中…" : "检测连通性"}
            </Button>
            {testHint ? <span className="text-xs text-muted-foreground">{testHint}</span> : null}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button type="button" onClick={() => void saveModelProfile()}>
            保存设置
          </Button>
        </div>
      </div>
    </div>
  );
}
