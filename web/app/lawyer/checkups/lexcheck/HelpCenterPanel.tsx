"use client";

import { useState } from "react";
import { getAppVersion } from "@/lib/app-version";

const TABS = [
  { key: "guide", label: "使用说明" },
  { key: "changelog", label: "更新记录" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

type GuideItem = { title: string; body: string };

const GUIDE_SECTIONS: Array<{ heading: string; items: GuideItem[] }> = [
  {
    heading: "法律体检",
    items: [
      {
        title: "总览",
        body: "查看已发放问卷的整体进度：未提交、已提交未生成报告、已生成报告的份数统计。点击表格中的企业名称可直接进入该企业的报告制作。",
      },
      {
        title: "报告制作",
        body: "先在问卷列表里选择一份已提交问卷，再选择生成模式（拼装 / 融合 / 高级）生成报告正文；生成后可导出 Word、查看历史版本。三种模式的实际提示词在「AI配置」里调整。",
      },
      {
        title: "问卷管理",
        body: "管理问卷模板：导入/导出 Excel、改名与备注、锁定已使用的模板；设置某个模板的推送范围（广播给所有客户或指定客户）；查看已收集问卷，可删除（会一并清理该问卷关联的报告与工作区数据，不可恢复）。",
      },
      {
        title: "AI配置",
        body: "配置报告生成用到的提示词，共五个标签：拼装模式、融合模式、高级模式各自的效果文案，三方报告提取的提取要求，以及报告末尾的免责声明文案。每份内容按问卷单独保存生效，内置默认只读，如需修改先复制一份再编辑。灰色框内的「系统固定要求」是硬性约束，不可修改。",
      },
    ],
  },
  {
    heading: "账号与配置",
    items: [
      {
        title: "大模型设置",
        body: "绑定当前律师账号自己的大模型 Key（供应商、模型、密钥）。生成报告时优先使用这里配置的 Key；未配置或调用失败时，会自动依次尝试管理员配置的公用 Key、公用备用 Key。",
      },
      {
        title: "客户管理",
        body: "新建与管理企业客户账号，用于向客户发放问卷。",
      },
      {
        title: "后台管理（仅管理员可见）",
        body: "系统级配置入口，含注册模式（验证码登录、邀请码）、账号管理（新建/编辑/删除任意账号）、公用大模型（供全体律师兜底使用的共用/共用备用 Key）、其他设置（如问卷重填间隔）。",
      },
    ],
  },
  {
    heading: "其他",
    items: [
      {
        title: "尽调报告（暂不可用）",
        body: "另一套独立的尽调工作区，目前不是维护重点，功能可能与法律体检不一致，仅供参考。",
      },
    ],
  },
];

type ChangelogEntry = { date: string; title: string; points: string[] };

const CHANGELOG: ChangelogEntry[] = [
  {
    date: "2026-07-15",
    title: "工作台导航与体检报告提示词体系改版",
    points: [
      "左侧导航改为统一的一级/二级结构，展开状态跨页面持久保留，不再随意折叠。",
      "「大模型设置」「后台管理」从弹窗/独立整页改为右侧内联页面，与其他功能页体验一致，并始终在侧栏底部可见。",
      "体检报告新增「高级模式」：由大模型一次性撰写报告核心正文，模块顺序、取舍更灵活；原「普通模式」更名「拼装模式」。",
      "「提示词配置」更名为「AI配置」，改为拼装/融合/高级/三方报告提取/免责声明五个标签页，每个标签的系统硬性约束与可编辑效果文案分离展示。",
      "报告生成部分内容未完整生成时（如摘要缺失、某模块未成功融合），会给出明确提示，不再无声兜底。",
      "后台管理拆分为注册模式/账号管理/公用大模型/其他设置四个标签页，公用大模型新增连通性测试。",
      "新增本「帮助与支持」页面。",
    ],
  },
  {
    date: "2026-07-12",
    title: "问卷多模板体系与客户账号配置",
    points: [
      "问卷支持多模板，可通过 Excel 批量导入导出。",
      "新增客户账号配置功能。",
      "接入三方背景报告，报告开头可展示企业基本信息与风险提示。",
    ],
  },
  {
    date: "2026-07-07",
    title: "修复：融合模式报告偶发丢失整改建议",
    points: ["融合模式提示词未强制要求同时保留风险与建议，导致部分报告只有风险描述、没有整改建议，已修复。"],
  },
  {
    date: "2026-07-05",
    title: "账号体系与大模型 Key 级联",
    points: [
      "新增登录鉴权与律师/客户账号体系。",
      "体检报告支持双模式生成，报告页展示企业总分。",
      "大模型 Key 支持三级级联：律师本人 → 管理员公用 → 管理员公用备用，逐级兜底。",
    ],
  },
  {
    date: "2026-07-02",
    title: "法律体检与尽调报告双应用拆分",
    points: ["法律体检、尽调报告拆分为两个独立应用；问卷体系与拼装式报告重做；全站视觉改版。"],
  },
  {
    date: "2026-05-04",
    title: "快速体检历史报告与导出优化",
    points: ["历史报告支持存储与查看；报告导出 Word 样式（表格、字体、颜色）优化。"],
  },
  {
    date: "2026-04-19",
    title: "快速体检分块异步生成",
    points: ["附件较多或较大时自动切换为分块异步生成，避免请求超时。"],
  },
  {
    date: "2026-04-03",
    title: "项目启动",
    points: ["搭建应用中心首页与问卷填写流程，项目正式启动。"],
  },
];

export function HelpCenterPanel() {
  const [activeTab, setActiveTab] = useState<TabKey>("guide");

  return (
    <div className="flex h-full flex-col overflow-hidden px-8 py-4">
      <h1 className="shrink-0 text-2xl font-semibold tracking-tight">帮助与支持</h1>

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

      <div className="min-h-0 flex-1 overflow-y-auto">
        {activeTab === "guide" ? (
          <div className="max-w-3xl space-y-6 pb-4">
            {GUIDE_SECTIONS.map((section) => (
              <div key={section.heading} className="space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground">{section.heading}</h2>
                <div className="space-y-3">
                  {section.items.map((item) => (
                    <div key={item.title} className="rounded-md border p-3">
                      <div className="text-sm font-medium text-foreground">{item.title}</div>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="max-w-3xl space-y-6 pb-4">
            <div className="text-xs text-muted-foreground">当前版本：{getAppVersion().label}</div>
            {CHANGELOG.map((entry) => (
              <div key={entry.date} className="space-y-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium text-foreground">{entry.title}</span>
                  <span className="text-xs text-muted-foreground">{entry.date}</span>
                </div>
                <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground">
                  {entry.points.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
