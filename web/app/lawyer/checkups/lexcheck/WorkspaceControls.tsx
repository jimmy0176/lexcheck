"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { LLM_PROVIDERS, getProviderById } from "@/lib/llm-providers";

type CheckupItem = {
  id: string;
  token: string;
  companyName: string | null;
  status: "draft" | "submitted";
  savedAtLabel: string;
};

type WorkspaceShape = {
  projectStatus: string;
  ownerName: string;
  promptTemplate: string;
  reportTemplate: string;
  progress: Record<string, boolean>;
};

async function fetchWorkspace(token: string) {
  const res = await fetch(`/api/lawyer/checkups/${token}/workspace`, {
    cache: "no-store",
  });
  const json = (await res.json()) as {
    error?: string;
    message?: string;
    workspace?: WorkspaceShape;
  };
  if (!res.ok || !json.workspace) {
    throw new Error(json.message ?? json.error ?? `请求失败 ${res.status}`);
  }
  return json.workspace;
}

async function patchWorkspace(token: string, patch: Partial<WorkspaceShape>) {
  const base = await fetchWorkspace(token);
  const payload: WorkspaceShape = {
    projectStatus: patch.projectStatus ?? base.projectStatus,
    ownerName: patch.ownerName ?? base.ownerName,
    promptTemplate: patch.promptTemplate ?? base.promptTemplate,
    reportTemplate: patch.reportTemplate ?? base.reportTemplate,
    progress: patch.progress ?? base.progress,
  };

  const res = await fetch(`/api/lawyer/checkups/${token}/workspace`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = (await res.json()) as { error?: string; message?: string };
  if (!res.ok) {
    throw new Error(json.message ?? json.error ?? `保存失败 ${res.status}`);
  }
}

export function QuestionnairePickerButton({
  checkups,
  selectedToken,
  autoOpen = false,
  buttonLabel = "切换问卷",
}: {
  checkups: CheckupItem[];
  selectedToken?: string;
  autoOpen?: boolean;
  buttonLabel?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(autoOpen);
  const [keyword, setKeyword] = useState("");

  useEffect(() => {
    if (autoOpen) setOpen(true);
  }, [autoOpen]);

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    if (!q) return checkups;
    return checkups.filter((item) => {
      const company = (item.companyName ?? "").toLowerCase();
      return item.token.toLowerCase().includes(q) || company.includes(q);
    });
  }, [checkups, keyword]);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        {buttonLabel}
      </Button>
      <AlertDialogContent className="max-w-3xl p-0">
        <AlertDialogHeader className="border-b px-6 py-4">
          <AlertDialogTitle>选择企业问卷</AlertDialogTitle>
        </AlertDialogHeader>
        <div className="space-y-3 px-6 py-4">
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索 token 或公司名称"
            className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <div className="max-h-[50vh] space-y-2 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="rounded-md border p-3 text-sm text-muted-foreground">未找到匹配问卷。</div>
            ) : (
              filtered.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    router.push(`/lawyer/checkups/lexcheck?token=${encodeURIComponent(item.token)}`);
                    setOpen(false);
                  }}
                  className={`w-full rounded-md border p-3 text-left transition hover:bg-muted/30 ${
                    item.token === selectedToken ? "border-primary bg-primary/5" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate text-sm font-medium">
                      {item.companyName?.trim() ? item.companyName : "未填写公司名称"}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {item.status === "submitted" ? "已提交" : "草稿"}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">token: {item.token}</div>
                  <div className="mt-1 text-xs text-muted-foreground">更新：{item.savedAtLabel}</div>
                </button>
              ))
            )}
          </div>
        </div>
        <AlertDialogFooter className="border-t px-6 py-4">
          <AlertDialogCancel>关闭</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function WorkspaceSettingsButtons({
  token,
  initialPromptTemplate,
  initialReportTemplate,
}: {
  token: string;
  initialPromptTemplate: string;
  initialReportTemplate: string;
}) {
  const [promptOpen, setPromptOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [promptTemplate, setPromptTemplate] = useState(initialPromptTemplate);
  const [reportTemplate, setReportTemplate] = useState(initialReportTemplate);
  const [saving, setSaving] = useState<"prompt" | "report" | null>(null);
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

  async function savePromptTemplate() {
    setSaving("prompt");
    setMessage(null);
    setError(null);
    try {
      await patchWorkspace(token, { promptTemplate });
      setMessage("提示词模板已保存");
      setPromptOpen(false);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(null);
    }
  }

  async function saveReportTemplate() {
    setSaving("report");
    setMessage(null);
    setError(null);
    try {
      await patchWorkspace(token, { reportTemplate });
      setMessage("报告输出模板已保存");
      setReportOpen(false);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(null);
    }
  }

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
      <Button type="button" variant="outline" className="w-full justify-start" onClick={() => setPromptOpen(true)}>
        提示词模板
      </Button>
      <Button type="button" variant="outline" className="w-full justify-start" onClick={() => setReportOpen(true)}>
        报告输出模板
      </Button>
      <Button type="button" variant="outline" className="w-full justify-start" onClick={() => setModelOpen(true)}>
        大模型设置
      </Button>

      {(message || error) && (
        <div className={`rounded-md border px-3 py-2 text-xs ${error ? "text-destructive" : "text-muted-foreground"}`}>
          {error ?? message}
        </div>
      )}

      <AlertDialog open={promptOpen} onOpenChange={setPromptOpen}>
        <AlertDialogContent className="max-w-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>提示词模板</AlertDialogTitle>
          </AlertDialogHeader>
          <Textarea
            value={promptTemplate}
            onChange={(e) => setPromptTemplate(e.target.value)}
            className="min-h-[45vh]"
            placeholder="填写分部草稿生成时的默认提示词模板"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <Button type="button" onClick={() => void savePromptTemplate()} disabled={saving === "prompt"}>
              {saving === "prompt" ? "保存中…" : "保存模板"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={reportOpen} onOpenChange={setReportOpen}>
        <AlertDialogContent className="max-w-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>报告输出模板</AlertDialogTitle>
          </AlertDialogHeader>
          <Textarea
            value={reportTemplate}
            onChange={(e) => setReportTemplate(e.target.value)}
            className="min-h-[45vh]"
            placeholder="填写最终报告输出结构与排版要求"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <Button type="button" onClick={() => void saveReportTemplate()} disabled={saving === "report"}>
              {saving === "report" ? "保存中…" : "保存模板"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
