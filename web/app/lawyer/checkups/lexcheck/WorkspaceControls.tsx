"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { LLM_PROVIDERS, getProviderById } from "@/lib/llm-providers";

const darkGhostBtn =
  "w-full justify-start border-0 bg-transparent text-base text-white/60 hover:bg-sidebar-accent hover:text-white";

export function WorkspaceSettingsButtons({ token }: { token?: string }) {
  const [modelOpen, setModelOpen] = useState(false);
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
    const rawPid = localStorage.getItem("lexcheck:model:providerId") ?? "dashscope";
    const pid = getProviderById(rawPid) ? rawPid : "dashscope";
    const model = localStorage.getItem("lexcheck:model:name") ?? "";
    const key = localStorage.getItem("lexcheck:model:key") ?? "";
    const custom = localStorage.getItem("lexcheck:model:customBaseUrl") ?? "";
    setProviderId(pid);
    setApiKey(key);
    setCustomBaseUrl(custom);
    const p = getProviderById(pid);
    const defaultModel = p?.models?.[0] ?? "qwen-turbo";
    setModelName(model || defaultModel);
  }, []);

  function saveModelProfile() {
    localStorage.setItem("lexcheck:model:providerId", providerId);
    localStorage.setItem(
      "lexcheck:model:vendor",
      currentProvider?.label ?? providerId
    );
    localStorage.setItem("lexcheck:model:name", modelName.trim());
    localStorage.setItem("lexcheck:model:key", apiKey.trim());
    localStorage.setItem("lexcheck:model:customBaseUrl", customBaseUrl.trim());
    setMessage("大模型设置已保存到当前浏览器。");
    setError(null);
    setModelOpen(false);
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
          baseUrlOverride:
            providerId === "custom" ? customBaseUrl.trim() : undefined,
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
    <div className="space-y-2">
      <Button
        type="button"
        variant="ghost"
        className={darkGhostBtn}
        disabled={!token}
        onClick={() => {
          if (!token) return;
          window.dispatchEvent(
            new CustomEvent("lexcheck:open-report-settings", { detail: { token } })
          );
        }}
      >
        提示词与模板设置
      </Button>
      <Button type="button" variant="ghost" className={darkGhostBtn} onClick={() => setModelOpen(true)}>
        大模型设置
      </Button>

      {(message || error) && (
        <div
          className={`rounded-md border px-3 py-2 text-sm ${error ? "border-destructive/40 text-destructive" : "border-white/15 text-white/60"}`}
        >
          {error ?? message}
        </div>
      )}

      <AlertDialog open={modelOpen} onOpenChange={setModelOpen}>
        <AlertDialogContent className="max-w-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>大模型设置</AlertDialogTitle>
          </AlertDialogHeader>
          <p className="text-xs text-muted-foreground">
            连通性测试使用 OpenAI 兼容接口{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-[11px]">POST /chat/completions</code>
            ；密钥仅保存在本机浏览器，测试请求经服务端转发。
          </p>
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
                  value={
                    currentProvider.models.includes(modelName) ? modelName : "__custom__"
                  }
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
                placeholder="输入 API Key（本地浏览器保存）"
                type="password"
                autoComplete="off"
              />
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={testing}
                onClick={() => void testConnection()}
              >
                {testing ? "检测中…" : "检测连通性"}
              </Button>
              {testHint ? (
                <span className="text-xs text-muted-foreground">{testHint}</span>
              ) : null}
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <Button type="button" onClick={saveModelProfile}>
              保存设置
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
