"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Payload = {
  riskLevel: string;
  riskHighlights: string[];
  recommendations: string[];
  aiOpinion: string | null;
  fallbackSummary: string;
  meta?: {
    deepseekConfigured: boolean;
    usedDeepseek: boolean;
    attachmentsUsed?: boolean;
    attachmentInputs?: Array<{
      id: string;
      fileName: string;
      extractedChars: number;
      includedInPrompt: boolean;
      extractError?: string | null;
    }>;
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
  const [aiElapsedSec, setAiElapsedSec] = useState(0);
  const [customRequirement, setCustomRequirement] = useState("");

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
    return data.aiOpinion ?? "AI意见待生成";
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

  const aiProgressText = useMemo(() => {
    if (!aiLoading) return "";
    if (aiElapsedSec < 3) return "正在整理问卷风险点…";
    if (aiElapsedSec < 8) return "正在读取并压缩补充材料…";
    if (aiElapsedSec < 20) return "正在调用 DeepSeek 生成报告…";
    return "模型生成中（长文档可能耗时更久）…";
  }, [aiLoading, aiElapsedSec]);

  const runAiAnalysis = useCallback(async () => {
    setAiLoading(true);
    setErr(null);
    setAiRequested(true);
    setAiElapsedSec(0);
    try {
      const q = new URLSearchParams({
        mode: "full",
        includeAttachments: "true",
      });
      const reqText = customRequirement.trim();
      if (reqText) q.set("customRequirement", reqText.slice(0, 1200));
      const res = await fetch(
        `/api/lawyer/checkups/${token}/ai-summary?${q.toString()}`,
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
  }, [customRequirement, token]);

  useEffect(() => {
    if (!aiLoading) return;
    const timer = window.setInterval(() => {
      setAiElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [aiLoading]);

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
    <Card id="ai-opinion" className="scroll-mt-24 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="text-sm font-semibold">AI意见（DeepSeek）</div>
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
          未配置 DEEPSEEK_API_KEY，暂无法进行 AI 分析。
        </p>
      )}

      {rulesLoading && !data && (
        <div className="mt-3 text-xs text-muted-foreground">加载规则摘要…</div>
      )}
      <div className="mt-3">
        <div className="mb-1 text-xs font-medium">补充要求（可选）</div>
        <Textarea
          value={customRequirement}
          onChange={(e) => setCustomRequirement(e.target.value)}
          placeholder="例如：请重点评估股权代持、劳动仲裁与税务稽查风险，并给出分阶段整改计划。"
          className="min-h-20"
          disabled={aiLoading}
        />
      </div>

      {err && (
        <div className="mt-3 text-xs text-destructive">
          加载失败：{err}。请检查网络或稍后重试。
        </div>
      )}
      {aiLoading && (
        <div className="mt-3 rounded-md border bg-muted/20 p-2 text-xs text-muted-foreground">
          <div>分析已用时：{aiElapsedSec}s</div>
          <div className="mt-1">{aiProgressText}</div>
        </div>
      )}

      {data && (
        <>
          <div className="mt-2">
            <div className="text-xs font-medium">本次材料读取情况</div>
            {data.meta?.attachmentInputs && data.meta.attachmentInputs.length > 0 ? (
              <ul className="mt-1 space-y-1 text-xs">
                {data.meta.attachmentInputs.map((item) => (
                  <li key={item.id} className="text-muted-foreground">
                    {item.fileName} · 提取 {item.extractedChars} 字
                    {item.includedInPrompt ? " · 已纳入分析" : " · 未纳入分析"}
                    {item.extractError ? ` · 解析异常：${item.extractError}` : ""}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-1 text-xs text-muted-foreground">本次未读取到补充材料。</div>
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
            className="mt-2 rounded-lg border bg-muted/20 p-3 text-xs whitespace-pre-wrap"
            aria-live="polite"
          >
            {mainOpinionText}
          </div>
        </>
      )}
    </Card>
  );
}
