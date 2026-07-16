"use client";

import { useState } from "react";
import {
  CHECKUP_REPORT_CONCAT_SECTION_KEY,
  CHECKUP_REPORT_FUSION_SECTION_KEY,
  CHECKUP_REPORT_ADVANCED_SECTION_KEY,
  CHECKUP_REPORT_THIRDPARTY_SECTION_KEY,
  CHECKUP_REPORT_DISCLAIMER_SECTION_KEY,
  CHECKUP_REPORT_GUARDRAILS,
  CHECKUP_REPORT_PROMPT_DEFAULTS,
  CHECKUP_REPORT_PROMPT_VERSION,
} from "@/lib/dd-segment-default-templates";
import { CheckupPromptEditor } from "./CheckupPromptEditor";

const TABS: Array<{
  key: string;
  label: string;
  sectionKey: string;
  contentLabel?: string;
  placeholder?: string;
}> = [
  { key: "concat", label: "拼装模式", sectionKey: CHECKUP_REPORT_CONCAT_SECTION_KEY },
  { key: "fusion", label: "融合模式", sectionKey: CHECKUP_REPORT_FUSION_SECTION_KEY },
  { key: "advanced", label: "高级模式", sectionKey: CHECKUP_REPORT_ADVANCED_SECTION_KEY },
  { key: "thirdparty", label: "三方报告提取", sectionKey: CHECKUP_REPORT_THIRDPARTY_SECTION_KEY },
  {
    key: "disclaimer",
    label: "免责声明",
    sectionKey: CHECKUP_REPORT_DISCLAIMER_SECTION_KEY,
    contentLabel: "免责声明正文",
    placeholder: "报告末尾固定展示的免责声明文字，不经过大模型，逐字插入报告",
  },
];

export function PromptConfigPanel({ token }: { token: string; companyName: string | null }) {
  const [activeTab, setActiveTab] = useState(TABS[0]!.key);

  return (
    <div className="flex h-full flex-col overflow-hidden px-8 py-4">
      <h1 className="shrink-0 text-2xl font-semibold tracking-tight">AI配置</h1>

      <div className="mt-3 mb-3 flex shrink-0 items-stretch gap-4 border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`-mb-px shrink-0 border-b-2 px-1 py-2 text-base font-medium transition-colors ${
              activeTab === tab.key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1">
        {TABS.map((tab) =>
          tab.key === activeTab ? (
            <CheckupPromptEditor
              key={`${token}:${tab.sectionKey}`}
              token={token}
              sectionKey={tab.sectionKey}
              guardrail={CHECKUP_REPORT_GUARDRAILS[tab.sectionKey] ?? ""}
              defaultText={CHECKUP_REPORT_PROMPT_DEFAULTS[tab.sectionKey] ?? ""}
              version={CHECKUP_REPORT_PROMPT_VERSION}
              contentLabel={tab.contentLabel}
              placeholder={tab.placeholder}
            />
          ) : null
        )}
      </div>
    </div>
  );
}
