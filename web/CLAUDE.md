# Lexcheck 项目文档

## 项目目标

Lexcheck 是一个**企业法律合规体检平台**，连接企业客户与律师团队：

- **企业端**：通过结构化问卷完成法律合规自查
- **律师端**：查看问卷答案、上传三方速查附件、生成 AI 分析报告、协作编辑并导出最终报告
- **核心价值**：用 AI 替代传统邮件/文件来回，生成标准化「快速体检报告」，降低律所尽调前期成本

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Next.js 16.2.2（App Router）+ React 19 + TypeScript 5 |
| 样式 | Tailwind CSS 4 + shadcn/ui + Radix UI + Lucide React |
| 数据库 | PostgreSQL + Prisma 6 ORM |
| AI / LLM | OpenAI-compatible `/chat/completions`（支持 DeepSeek / 通义千问 / 智谱 GLM / Moonshot / 自定义） |
| 文档处理 | mammoth（DOCX → 文本）、pdf-parse（PDF → 文本）、docx（生成 Word）、jspdf（生成 PDF） |
| Markdown | react-markdown + remark-gfm + unified |
| 开发环境 | ESLint 9、端口 3001（dev/start） |

> **Next.js 版本注意**：本项目使用 Next.js 16，部分 API 与旧版不同，修改前请参考 `node_modules/next/dist/docs/`。

---

## 常用命令

```bash
npm run dev          # 开发服务器（端口 3001）
npm run build        # 生产构建
npm run start        # 生产启动（端口 3001）
npm run prisma:migrate  # 运行数据库迁移
npm run prisma:studio   # 打开 Prisma Studio（数据库管理 UI）
npm run prisma:generate # 重新生成 Prisma Client
```

---

## 环境变量（.env）

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?schema=public"
DEEPSEEK_API_KEY=    # 可选；未设置时 AI 功能降级
# DEEPSEEK_API_BASE_URL=
# DEEPSEEK_MODEL=deepseek-chat
```

律师端 LLM 配置通过数据库（`CheckupWorkspace.promptTemplate` 等）或前端 UI 设置，不依赖固定环境变量。

---

## 文件结构

```
web/
├── app/
│   ├── api/
│   │   ├── checkups/[token]/            # 公开问卷接口（企业端）
│   │   │   ├── route.ts                 # GET：按 token 取问卷
│   │   │   └── submit/route.ts          # POST：提交问卷
│   │   └── lawyer/                      # 律师端接口（需鉴权）
│   │       ├── checkups/[token]/
│   │       │   ├── ai-summary/          # AI 摘要生成
│   │       │   ├── attachments/         # 附件上传/下载/删除
│   │       │   ├── finalize-report/     # 终稿保存
│   │       │   ├── generate-section/    # 单节报告生成
│   │       │   ├── quick-exam-report/   # 快速体检报告主入口（同步/异步）
│   │       │   └── workspace/           # 工作区状态管理
│   │       └── llm/test-connection/     # LLM 连通性测试
│   ├── q/
│   │   ├── new/route.ts                 # 创建新问卷会话（返回 token）
│   │   ├── page.tsx                     # 问卷列表/首页
│   │   └── [token]/page.tsx            # 问卷填写页
│   ├── lawyer/checkups/
│   │   ├── page.tsx                     # 律师端问卷列表
│   │   ├── [token]/                     # 单个问卷详情
│   │   │   ├── page.tsx
│   │   │   ├── LawyerAiPanel.tsx        # AI 功能面板
│   │   │   ├── LawyerUploadPanel.tsx    # 附件上传面板
│   │   │   ├── RiskSectionSummaryPanel.tsx
│   │   │   └── AnswerSectionsClient.tsx # 答案展示
│   │   └── lexcheck/                    # 快速体检工作区
│   │       ├── page.tsx
│   │       ├── QuickExamReportMarkdown.tsx  # 报告 Markdown 预览
│   │       ├── WorkspaceControls.tsx
│   │       ├── LexcheckWorkspaceRightPanel.tsx  # 右侧面板（含模板初始化逻辑）
│   │       ├── export-quick-exam-report.ts      # 导出（Word/PDF）+ GFM 表格修复
│   │       └── SegmentTemplateSettingsDialog.tsx # prompt/output 模板编辑弹窗
│   ├── login/
│   │   ├── user/page.tsx
│   │   └── lawyer/page.tsx
│   ├── layout.tsx
│   └── page.tsx                         # 落地页
├── lib/
│   ├── prisma.ts                        # Prisma Client 单例
│   ├── llm-providers.ts                 # LLM 提供商预设（DeepSeek/通义/GLM/Moonshot）
│   ├── questionnaire-types.ts           # 问卷 TypeScript 类型
│   ├── local-draft.ts                   # 客户端草稿（localStorage）
│   ├── utils.ts                         # 通用工具
│   ├── checkup-attachments.ts           # 附件存储 + 文本提取
│   ├── extract-attachment-text.ts       # PDF/DOCX 解析逻辑
│   ├── checkup-workflow.ts              # 问卷状态机
│   # 快速体检核心管道
│   ├── quick-exam-constants.ts          # 阈值配置（可通过 env 覆盖）
│   ├── quick-exam-pipeline.ts           # 主编排：同步/异步两路 + Job 管理 + FINAL_SYSTEM 提示词
│   ├── quick-exam-preliminary.ts        # 附件加载 + 分块计划
│   ├── quick-exam-preliminary-summary-types.ts  # 分块摘要 JSON schema
│   ├── quick-exam-chunk.ts              # 自然边界文本切块
│   ├── quick-exam-input.ts              # 问卷答案 → 叙述文本
│   ├── quick-exam-llm.ts                # OpenAI-compatible API 调用
│   ├── quick-exam-json.ts               # LLM 响应 JSON 鲁棒解析
│   ├── quick-exam-markdown-docx.ts      # Markdown → Word 段落/表格（含样式）
│   ├── dd-report-toc.ts                 # 尽调报告目录生成
│   ├── dd-segment-default-templates.ts  # 报告分节默认模板（含快速体检全文模板）
│   └── generated/prisma/               # Prisma 自动生成（勿手动编辑）
├── components/
│   ├── ui/                             # shadcn/ui 基础组件
│   ├── app-chrome.tsx                  # 应用 Shell
│   ├── site-header.tsx
│   └── site-footer.tsx
├── prisma/
│   └── schema.prisma                   # 数据模型（见下）
├── public/
│   └── questionnaire.json              # 问卷结构配置（多章节）
├── uploads/                            # 附件运行时存储目录
├── next.config.ts
├── tsconfig.json                       # 路径别名：@/* → ./
└── .env / .env.example
```

---

## 数据模型（Prisma）

```
Checkup（问卷）
  ├── CheckupAttachment[]（上传附件：preliminary 三方速查 / detailed 详细材料）
  ├── CheckupWorkspace?（律师工作区）
  │   ├── CheckupSectionDraft[]（报告分节草稿）
  │   └── CheckupFinalReport?（终稿）
  └── QuickExamReportJob[]（异步报告生成任务）
```

**关键枚举：**
- `CheckupStatus`: `draft` | `submitted`
- `CheckupAttachmentKind`: `preliminary`（三方速查）| `detailed`（详细材料）
- `QuickExamJobStatus`: `pending` | `running` | `success` | `failed`

---

## 已完成功能

### 企业端
- [x] 多章节问卷填写（单选/多选/文本，含其他选项）
- [x] 客户端自动保存草稿（localStorage）
- [x] 服务端保存 + 提交（token 隔离）
- [x] 问卷进度追踪

### 律师端
- [x] 问卷列表 + 状态管理（待处理/处理中/已完成）
- [x] 查看企业问卷答案（按章节展开）
- [x] 附件上传（PDF/DOCX，含文本提取）
- [x] 附件删除、下载
- [x] LLM 提供商配置（DeepSeek / 通义千问 / 智谱 GLM / Moonshot / 自定义）
- [x] LLM 连通性测试

### 快速体检报告（核心功能）
- [x] **同步模式**：附件总量 ≤ 48,000 字符且 ≤ 12 个文件时，单次 LLM 调用直接生成
- [x] **异步分块模式**：超出阈值时，分三阶段执行（分块摘要 → 合并 → 终稿）
- [x] 数据库 Job 追踪（支持断点轮询续传）
- [x] 报告 Markdown 预览（含 GFM 表格）
- [x] 导出 Word（.docx）/ PDF
- [x] 自定义 prompt 模板 + output 模板（含版本化强制刷新机制）

### 尽调工作区
- [x] 分节草稿生成（AI）
- [x] 律师手动编辑审阅
- [x] 纳入/排除各节控制
- [x] 终稿保存

---

## 快速体检管道架构

```
请求到达 /api/lawyer/checkups/[token]/quick-exam-report
          │
          ▼
shouldUseSyncPipeline() 判断
          │
    ┌─────┴─────┐
  同步路径      异步路径
  文件少/小     文件多/大
    │             │
    │         createAsyncQuickExamJob()  ← 写 DB Job
    │             │
    │         stepQuickExamJob()  ← 前端轮询，每次推进 N 块
    │             │
    │    [chunks阶段] extractOneChunkSummary() × N（每次 HTTP 处理 CHUNKS_PER_STEP 块）
    │             │
    │    [final阶段]  mergePreliminarySummaries() + generateFinalReportText()
    │             │
    └──────┬──────┘
           ▼
      reportText（Markdown）
           │
    QuickExamReportMarkdown.tsx 预览
           │
    export-quick-exam-report.ts → Word / PDF
```

**关键常量（可通过 env 覆盖）：**
- `QUICK_EXAM_SYNC_MAX_TOTAL_CHARS`：默认 48,000（超过走异步）
- `QUICK_EXAM_SYNC_MAX_FILES`：默认 12
- `QUICK_EXAM_CHUNK_TARGET_CHARS`：默认 7,000（单块目标字符数）
- `QUICK_EXAM_CHUNKS_PER_STEP`：默认 2（每次轮询处理的块数）

---

## 快速体检报告：期望输出结构

参考模版：`企业快速法律体检报告_优化版.docx`（项目根目录，不纳入 git）

```
## 企业法律快速体检报告

委托方 / 出具单位 / 出具日期

### 报告摘要
2–4 句综合评估，点出核心风险领域

### 一、（领域名称）模块    优先级：高/中高/中/低
一句话核心结论
背景说明段落（1–2段）
1. **建议标题**
   建议说明段落
2. **建议标题** ...

（通常 3–6 个模块，从以下领域按需选取：
 人力资源 / 股权投融资 / 税收法律 / 知识产权 /
 婚家传承 / 国际商事 / 商业刑事 / 困境挽救）

### 重点整改顺序建议
**第一阶段（1 个月内）**：...
**第二阶段（2–3 个月内）**：...
**第三阶段（3–6 个月内）**：...

### 免责声明
```

**重要约束：**
- 全文不使用 Markdown 表格
- 建议均为有序编号列表（Word 导出后数字显示为金色 `#B8982A`，正文为深蓝 `#1A2E4A`）
- 无实质风险的领域模块直接跳过，不强行生成

---

## Word 导出样式规范

参考文件：`企业快速法律体检报告_优化版.docx`

| 元素 | 规格 |
|------|------|
| 正文字体 | Arial 11pt |
| 页边距 | 上/左/右 2.12 cm，下 2.54 cm |
| 行距 | 1.5 倍 |
| H2（##） | Arial，加粗，蓝色 `#2E74B5` |
| H3（###） | Arial，加粗，深蓝 `#1F4D78` |
| 有序列表数字 | 金色 `#B8982A` |
| 有序列表正文 | 深海蓝 `#1A2E4A` |
| 表格边框 | 单线 1pt，灰色 `#AAAAAA` |
| 表头背景 | 灰色 `#D9D9D9`，加粗 |

样式实现位置：
- `lib/quick-exam-markdown-docx.ts`：Markdown AST → docx 段落/表格，含有序列表配色
- `app/lawyer/checkups/lexcheck/export-quick-exam-report.ts`：Document 样式定义（字体、页边距、标题颜色）

---

## 快速体检模板系统

**存储位置：** localStorage，键名 `lexcheck:dd-segment:{token}:lexcheck_quick_exam_report:{prompt|output}`

**版本机制：** `lib/dd-segment-default-templates.ts` 中的 `QUICK_EXAM_TEMPLATE_VERSION` 常量控制。
每次更新内置模板时递增版本号（当前 `"v3"`），页面刷新后自动用新模板覆盖旧 localStorage。

**更新内置模板的步骤：**
1. 修改 `dd-segment-default-templates.ts` 中的 `QUICK_EXAM_REPORT_DEFAULT`
2. 将 `QUICK_EXAM_TEMPLATE_VERSION` 改为下一个版本（如 `"v3"` → `"v4"`）
3. 刷新浏览器，模板自动更新

**子节模板（总体判断 / 主要风险 / 建议）说明：**
子节模板（`outputSubsections`）仅用于**尽调详细报告**分节生成，与快速体检无关。
快速体检始终使用全文模板（`outputFull`），`outputSubsections` 对快速体检保持为空数组。

---

## 快速体检管道提示词

`lib/quick-exam-pipeline.ts` 中的 `FINAL_SYSTEM` 是系统级提示词，在所有 LLM 调用中注入，规定：
- 模块化报告结构（报告摘要 → N 个领域模块 → 重点整改建议 → 免责声明）
- 禁止使用表格
- 每个模块格式：标题行（含优先级）→ 核心结论段 → 背景说明 → 编号建议列表
- 每条建议：加粗标题另起一行 + 说明段落

与 `FINAL_SYSTEM` 并列的还有用户在 UI 设置的 `prompt.md`（角色/约束）和 `output.md`（骨架），三者共同注入请求。

---

## 当前未提交改动（截至 2026-05-04）

以下文件均已修改但**尚未 commit / push**，迁移到新电脑后需先确认效果再部署：

| 文件 | 改动摘要 |
|------|----------|
| `lib/quick-exam-markdown-docx.ts` | 表格边框/表头样式；有序列表数字金色 `#B8982A`，正文深蓝 `#1A2E4A` |
| `app/lawyer/checkups/lexcheck/export-quick-exam-report.ts` | 正文 Arial 11pt；页边距 2.12/2.54 cm；H2 `#2E74B5`，H3 `#1F4D78`；`fixGfmTablesForDocx()` |
| `lib/dd-segment-default-templates.ts` | 快速体检模板重写为模块化结构（v3）；子节清空；版本常量 `QUICK_EXAM_TEMPLATE_VERSION = "v3"` |
| `lib/quick-exam-pipeline.ts` | `FINAL_SYSTEM` 更新：禁表格、模块化报告格式、编号建议列表 |
| `app/lawyer/checkups/lexcheck/LexcheckWorkspaceRightPanel.tsx` | `ensureQuickExamTemplateSeeded` 加版本检查，版本变更时强制刷新 localStorage |
| `CLAUDE.md` | 本文件（项目文档全量更新） |

**下一步：**
1. 新电脑上 `npm install` + 配置 `.env`
2. `npm run dev` 启动，生成一份测试报告并导出 Word，确认样式和内容结构
3. 确认无误后 `git add` + `git commit` + `git push master` → 自动触发 GitHub Actions 部署

---

## 路径别名

`tsconfig.json` 中配置 `@/*` 指向 `./`，即项目根目录。
例：`import { prisma } from "@/lib/prisma"`。

---

## 注意事项

- `uploads/` 目录为运行时附件存储，需确保服务器写权限，生产环境建议迁移至对象存储
- 问卷结构在 `public/questionnaire.json` 中定义，修改结构需同步更新 `lib/questionnaire-types.ts`
- API 路由 `maxDuration = 300`（5分钟），已为长 LLM 调用优化
- 律师端目前无严格鉴权，生产上线前需补充
- `fixGfmTablesForDocx()` 函数（在 `export-quick-exam-report.ts`）在导出前自动修复 LLM 输出的 GFM 表格格式问题（补全缺失分隔行）
