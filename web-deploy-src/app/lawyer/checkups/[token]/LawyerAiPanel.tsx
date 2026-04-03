"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/lawyer/checkups/${token}/ai-summary`, {
          cache: "no-store",
        });
        const json = (await res.json()) as Payload & { error?: string };
        if (!res.ok) {
          if (!cancelled) setErr(json.error ?? `请求失败 ${res.status}`);
          return;
        }
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setErr(String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <Card id="ai-opinion" className="mt-6 scroll-mt-6 p-4">
      <div className="text-base font-semibold">AI意见（DeepSeek）</div>

      {!data && !err && (
        <div className="mt-3 text-sm text-muted-foreground">正在生成意见…</div>
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
            {data.meta?.deepseekConfigured && !data.meta.usedDeepseek && (
              <span className="ml-2 text-muted-foreground">
                （DeepSeek 调用失败，已用规则摘要兜底）
              </span>
            )}
          </div>
          {data.meta?.deepseekConfigured &&
            !data.meta.usedDeepseek &&
            data.meta.deepseekError && (
              <div className="mt-2 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive break-words">
                原因：{data.meta.deepseekError}
                {data.meta.deepseekHttpStatus != null &&
                  `（HTTP ${data.meta.deepseekHttpStatus}）`}
              </div>
            )}
          <div className="mt-2 rounded-lg border bg-muted/20 p-3 text-sm whitespace-pre-wrap">
            {data.aiOpinion ??
              `${data.fallbackSummary}（当前为规则引擎兜底输出）`}
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
