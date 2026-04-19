"use client";

import { useCallback, useMemo, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { WORKFLOW_STEPS, normalizeProgress, type WorkflowProgressMap } from "@/lib/checkup-workflow";

export function ProjectProgressPanel({
  token,
  initialProgress,
}: {
  token: string;
  initialProgress: WorkflowProgressMap;
}) {
  const [progress, setProgress] = useState(() => normalizeProgress(initialProgress));
  const [saving, setSaving] = useState(false);

  const completedSteps = useMemo(
    () => WORKFLOW_STEPS.filter((step) => progress[step]).length,
    [progress]
  );
  const progressPercent = Math.round((completedSteps / WORKFLOW_STEPS.length) * 100);

  const persist = useCallback(
    async (next: WorkflowProgressMap) => {
      setSaving(true);
      try {
        await fetch(`/api/lawyer/checkups/${token}/workspace`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ progress: next }),
        });
      } finally {
        setSaving(false);
      }
    },
    [token]
  );

  return (
    <div className="mt-3 border-t pt-3">
      <div className="text-xs font-medium text-muted-foreground">当前进度</div>
      <div className="mt-1 text-xs text-muted-foreground">
        已完成 {completedSteps} / {WORKFLOW_STEPS.length}
        {saving ? " · 保存中…" : ""}
      </div>
      <Progress className="mt-2 h-1.5" value={progressPercent} />
      <div className="mt-3 grid gap-1.5">
        {WORKFLOW_STEPS.map((step) => (
          <label key={step} className="flex items-center gap-2 text-xs">
            <Checkbox
              checked={Boolean(progress[step])}
              onCheckedChange={(checked) => {
                const next = {
                  ...progress,
                  [step]: Boolean(checked),
                };
                setProgress(next);
                void persist(next);
              }}
            />
            <span>{step}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
