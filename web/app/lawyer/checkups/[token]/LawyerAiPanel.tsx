"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Payload = {
  riskLevel: string;
  riskHighlights: string[];
  recommendations: string[];
  aiOpinion: string | null;
  fallbackSummary: string;
  meta?: {
    deepseekConfigured: boolean;
    usedDeepseek: boolean;
    deepseekError?: string | null;
    deepseekHttpStatus?: number | null;
  };
};

export function LawyerAiPanel({ token }: { token: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [rulesLoading, setRulesLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiRequested, setAiRequested] = useState(false);
  const [copyLabel, setCopyLabel] = useState("复制全文");

  useEffect(() => {
    let cancelled = false;
    setRulesLoading(true);
    setErr(null);
    (async () => {
      try {
        const res = await fetch(
          `/api/lawyer/checkups/${token}/ai-summary?mode=rules`,
          { cache: "no-store" }
        );
        const json = (await res.json()) as Payload & { error?: string };
        if (!res.ok) {
          if (!cancelled) setErr(json.error ?? `请求失败 ${res.status}`);
          return;
        }
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setErr(String(e));
      } finally {
        if (!cancelled) setRulesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const mainOpinionText = useMemo(() => {
    if (!data) return "";
    return (
      data.aiOpinion ??
      `${data.fallbackSummary}（当前为规则引擎兜底输出）`
    );
  }, [data]);

  const copyText = useMemo(() => {
    if (!data) return "";
    const lines: string[] = [
      `风险等级：${data.riskLevel}`,
      "",
      mainOpinionText,
      "",
      "主要风险点：",
      ...(data.riskHighlights.length
        ? data.riskHighlights.map((s) => `· ${s}`)
        : ["· 暂无可展示风险点"]),
      "",
      "建议动作：",
      ...data.recommendations.map((s) => `· ${s}`),
    ];
    return lines.join("\n");
  }, [data, mainOpinionText]);

  const runAiAnalysis = useCallback(async () => {
    setAiLoading(true);
    setErr(null);
    setAiRequested(true);
    try {
      const res = await fetch(
        `/api/lawyer/checkups/${token}/ai-summary?mode=full`,
        { cache: "no-store" }
      );
      const json = (await res.json()) as Payload & { error?: string };
      if (!res.ok) {
        setErr(json.error ?? `请求失败 ${res.status}`);
        return;
      }
      setData(json);
    } catch (e) {
      setErr(String(e));
    } finally {
      setAiLoading(false);
    }
  }, [token]);

  const handleCopy = useCallback(async () => {
    if (!copyText) return;
    try {
      await navigator.clipboard.writeText(copyText);
      setCopyLabel("已复制");
      window.setTimeout(() => setCopyLabel("复制全文"), 2000);
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = copyText;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setCopyLabel("已复制");
        window.setTimeout(() => setCopyLabel("复制全文"), 2000);
      } catch {
        setCopyLabel("复制失败");
        window.setTimeout(() => setCopyLabel("复制全文"), 2000);
      }
    }
  }, [copyText]);

  return (
    <Card id="ai-opinion" className="mt-6 scroll-mt-24 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="text-base font-semibold">AI意见（DeepSeek）</div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={
              rulesLoading ||
              aiLoading ||
              !data ||
              !data.meta?.deepseekConfigured ||
              (data.meta?.usedDeepseek && aiRequested)
            }
            onClick={runAiAnalysis}
          >
            {aiLoading ? "分析中…" : "AI 分析"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!data || rulesLoading}
            onClick={handleCopy}
          >
            {copyLabel}
          </Button>
        </div>
      </div>

      {!data?.meta?.deepseekConfigured && data && !rulesLoading && (
        <p className="mt-2 text-xs text-amber-600 dark:text-amber-500">
          未配置 DEEPSEEK_API_KEY，无法进行 AI 分析；可先查看规则引擎摘要并复制。
        </p>
      )}

      {rulesLoading && !data && (
        <div className="mt-3 text-sm text-muted-foreground">加载规则摘要…</div>
      )}

      {err && (
        <div className="mt-3 text-sm text-destructive">
          加载失败：{err}。请检查网络或稍后重试。
        </div>
      )}

      {data && (
        <>
          <div className="mt-2 text-sm text-muted-foreground">
            风险等级：{data.riskLevel}
            {data.meta && !data.meta.deepseekConfigured && (
              <span className="ml-2 text-amber-600 dark:text-amber-500">
                （未配置 DEEPSEEK_API_KEY）
              </span>
            )}
            {data.meta?.deepseekConfigured && !data.meta.usedDeepseek && aiRequested && (
              <span className="ml-2 text-muted-foreground">
                （DeepSeek 调用失败，已用规则摘要兜底）
              </span>
            )}
          </div>
          {data.meta?.deepseekConfigured &&
            !data.meta.usedDeepseek &&
            aiRequested &&
            data.meta.deepseekError && (
              <div className="mt-2 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs break-words text-destructive">
                原因：{data.meta.deepseekError}
                {data.meta.deepseekHttpStatus != null &&
                  `（HTTP ${data.meta.deepseekHttpStatus}）`}
              </div>
            )}
          <div
            className="mt-2 rounded-lg border bg-muted/20 p-3 text-sm whitespace-pre-wrap"
            aria-live="polite"
          >
            {mainOpinionText}
          </div>

          <div className="mt-4">
            <div className="text-sm font-medium">主要风险点</div>
            {data.riskHighlights.length === 0 ? (
              <div className="mt-2 text-sm text-muted-foreground">
                暂无可展示风险点。
              </div>
            ) : (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                {data.riskHighlights.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-4">
            <div className="text-sm font-medium">建议动作</div>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {data.recommendations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </>
      )}
    </Card>
  );
}
