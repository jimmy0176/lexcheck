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
| 邮件 | nodemailer（SMTP），配置存于 `AuthSettings`；用于登录验证码、换绑邮箱验证码、体检报告发送，见下方对应说明 |
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
│   │   └── lexcheck/                    # 法律体检工作区（总览/报告制作/问卷管理/AI配置）
│   │       ├── page.tsx
│   │       ├── CheckupReportPanel.tsx       # 报告制作（问卷详情/报告制作/历史报告三个子标签）
│   │       ├── PromptConfigPanel.tsx        # AI配置页：拼装/融合/高级/三方报告提取/免责声明五个标签页
│   │       ├── CheckupPromptEditor.tsx      # 单栏内容编辑器（默认版只读 + 律师自建模版），被上者复用
│   │       ├── QuickExamReportMarkdown.tsx  # 报告 Markdown 预览
│   │       ├── export-quick-exam-report.ts      # 导出（Word/PDF）+ GFM 表格修复
│   │       └── ThirdPartyReportBox.tsx      # 三方报告上传与预览
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
| H1（#，仅法律体检报告最顶部文档标题一处，居中） | Arial，加粗，深蓝 `#1F4D78`，40pt |
| H2（##，法律体检报告各章节标题/尽调应用模块标题） | Arial，加粗，深藏青 `#0B1958` |
| H3（###，法律体检报告高级模式风险主题标题，如"### 1. 主题名"） | Arial，加粗，蓝色 `#2E74B5` |
| H4（####，预留未使用） | Arial，加粗，深蓝 `#1A2E4A`，20pt（明确小于 H3，避免层级越深字号反而越大），段前带 `keepNext` |
| 有序列表数字 | 金色 `#B8982A` |
| 有序列表正文 | 深海蓝 `#1A2E4A` |
| 表格边框 | 单线 1pt，灰色 `#AAAAAA` |
| 表头背景 | 灰色 `#D9D9D9`，加粗 |
| 表格行 | `cantSplit: true`，禁止单行跨页拆分 |

样式实现位置：
- `lib/quick-exam-markdown-docx.ts`：Markdown AST → docx 段落/表格，含有序列表配色、表格 `cantSplit`。`tableCellToDocx()` 要注意 mdast 的 `TableCell.children` 直接是 `PhrasingContent[]`（text/strong/...），不会像普通块级内容那样包一层 `paragraph` 节点——按 `paragraph` 类型过滤会导致所有表格单元格永远匹配不到内容，全部渲染成空白（曾经出现过的真实 bug）
- `lib/report-docx.ts`：法律体检应用（lexcheck）报告导出的 `Document` 样式定义（字体、页边距、标题颜色，含 H4）与封面页构建，客户端导出（`Packer.toBlob`）和服务端邮件附件（`Packer.toBuffer`）共用同一个 `buildReportDocxDocument()`
- `app/lawyer/checkups/dd-report/export-quick-exam-report.ts`：尽调报告应用（非优先维护）另有一份几乎相同的独立实现，两者不共用

**Word 封面页（`lib/report-docx.ts` 的 `buildCoverSectionChildren()`）：** 报告 docx 的第一个 section 是独立封面页，用真实设计稿背景图（`web/public/assets/report-cover-bg.png`，深藏青底 + 蓝色波纹线条，A4 比例 1055×1491px）铺满整页，不再是早期版本用纯色块+直线模拟波纹的方案。图片以 `ImageRun` 的 `floating`（`behindDocument: true`、`relative: PAGE`、`wrap: NONE`）方式实现"整页出血背景图 + 文字浮在上面"的效果，尺寸按 A4 在 96dpi 下的像素值（794×1123px）铺满、不拉伸变形。文字布局：正中偏上两行（"企业法律体检报告" + 委托方公司名，均白色），中间偏下两行（"HE PARTNERS" 品牌落款 + 日期，格式为 `2026.7.18` 这种点分不补零格式，不带"出具日期"字样，由 `formatCoverIssueDate()` 生成）。四行文字全部显式指定 `font: { name: "Arial", eastAsia: "Arial" }`（避免中文字符走文档主题默认的等线字体），字号 64/40/32/26；上方标题两行 `spacing.before` 收紧到 4400，下方品牌落款两行前的间隔加大到 4000，整体视觉上"标题偏上、落款偏下"。

背景图加载分两条路径：服务端（邮件发送等场景）直接 `fs.readFile` 读 `public` 目录下的文件，不经过网络；浏览器端（客户端导出）用 `fetch("/assets/report-cover-bg.png")` 拉取同一份静态资源。**任一路径加载失败都会返回 `null`，此时自动回退成纯色块封面**（复用旧版设计的深藏青 `#0B1958` 单元格表格 + 同样的文字），保证背景图缺失（比如某个部署环境没同步这个静态文件）不会导致整份报告生成失败。第二个 section 才是原有正文（页边距不变）。`buildReportDocxDocument(text, { companyName, issueDate })`/`buildReportDocxBuffer(text, opts)` 都有这两个可选参数，客户端导出（`export-quick-exam-report.ts` 的 `downloadQuickExamDocx`）和邮件发送（`report/send-email/route.ts`）两处调用都已经传入对应的公司名和生成时间。

---

## 快速体检模板系统（尽调报告应用内的旧功能，UI 已更名为"体检报告"）

> **命名澄清（重要）**：本节描述的是**尽调报告应用**（`/lawyer/checkups/dd-report`）工作区右侧面板里的一个标签页，
> 代码内部标识仍是 `quickExam`/`LEXCHECK_QUICK_EXAM_SECTION_KEY`，但该标签页在 UI 上已统一改称"体检报告"，
> 不再使用"快速体检"这个说法，以免与下面《体检报告提示词架构》一节描述的**法律体检应用**（`/lawyer/checkups/lexcheck`）
> 的"报告制作"功能混淆——两者是完全独立的两套代码、两套数据，只是恰好显示名称相同。
> 尽调报告应用目前非优先维护对象，这里只做了文案改名，管道/存储 key/版本机制均未改动。

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

## 体检报告提示词架构（法律体检应用「报告制作」，主力维护对象）

律师端「AI配置」页面（`app/lawyer/checkups/lexcheck/PromptConfigPanel.tsx`，页面标题/二级导航项均为"AI配置"）对应的是**这一套**——
和上面《快速体检模板系统》一节描述的尽调报告应用旧功能是两套独立代码，不要混用两边的 section key。

**五个标签页，各自独立配置：**

| 标签 | Section Key | 对应生成模式 | 说明 |
|------|-------------|-------------|------|
| 拼装模式 | `CHECKUP_REPORT_CONCAT_SECTION_KEY` | `mode=concat` | AI 只写「报告摘要」+「重点整改顺序建议」，模块正文 100% 规则拼装 |
| 融合模式 | `CHECKUP_REPORT_FUSION_SECTION_KEY` | `mode=fusion` | AI 额外整合润色每个模块的风险+建议正文（逐模块粒度兜底：某模块未返回时该模块单独退回规则拼装） |
| 高级模式 | `CHECKUP_REPORT_ADVANCED_SECTION_KEY` | `mode=advanced` | AI 一次性生成固定六章节结构（均为二级标题 `##`）：「报告基础与分析口径 → 公司总体法律风险画像 → 评分与重点风险概览（含两张表格：模块评分表 + 重点风险概览表）→ 专项风险分析与律师建议（5-8 个归并后的综合风险主题，`### 主题名` 三级标题，v6 起不再编号）→ 90日整改工作安排（含表格）→ 结论」；页头信息与免责声明仍由代码固定拼接。**没有护栏，整段全部开放给律师编辑**；不再要求逐问卷模块单独开标题——模块由模型自行归并成"综合风险主题"。v7 起新增大量"避免过度推断"的护栏内容：区分问卷"未填写"与"明确触发风险"、区分三方报告"当前/历史""有效/无效""本企业/关联主体"、限制诉讼/重组/家族信托等重大措施的建议尺度、正文列表统一用无序列表（不用阿拉伯数字编号，避免和之前"标题编号"是同一类"不同层级序号重复"的观感问题） |
| 三方报告提取 | `CHECKUP_REPORT_THIRDPARTY_SECTION_KEY` | 不属于上面三种模式，是一个独立的前置步骤 | **仅拼装/融合模式使用**：从上传的三方背景报告原文提炼 `companyInfo`/`highlights`，随报告开头一并插入，结果按附件缓存。高级模式不走这条路径，见下方说明 |
| 免责声明 | `CHECKUP_REPORT_DISCLAIMER_SECTION_KEY` | 不经过大模型 | 报告末尾固定文本，律师可完全自由改写，逐字插入报告，没有护栏 |

**拼装/融合/三方报告提取这三个标签页的系统提示词分两层，都在 `lib/dd-segment-default-templates.ts` 里定义：**
- `CHECKUP_REPORT_GUARDRAILS[sectionKey]`：**护栏**，硬性约束（JSON 输出契约/键名、禁止编造、融合模式"风险与建议不能只留一半"等），代码固定拼接在 system 提示词最前面，页面上只读展示，律师不能编辑。高级模式和免责声明都没有对应护栏条目，`CheckupPromptEditor` 的 `guardrail` 传空字符串时不渲染护栏区块。
- `CHECKUP_REPORT_PROMPT_DEFAULTS[sectionKey]`：**效果文案的默认版内容**（五个标签都有，免责声明这一条就是文档正文本身，高级模式这一条额外并入了原本的护栏硬性约束），语气、结构、分段规则等与生成效果直接相关的部分，律师可在页面上整段改写、另存为自定义模版、选择"启用"生效。

`CheckupPromptEditor.tsx` 页面布局：模版名称在最上面，其次是护栏展示区（无护栏则不渲染），最后是可编辑正文；左侧模版列表第一项固定是"默认版"（只读，对应 `CHECKUP_REPORT_PROMPT_DEFAULTS[sectionKey]`）。

`lib/checkup-report-generate.ts` 里的 `buildSystemPrompt(sectionKey, effectiveText)` 负责把"护栏 + 律师保存的效果文案（为空则用内置默认）"拼成最终 system 消息；免责声明不走这个函数，是直接把律师保存的文本（为空则用内置默认）逐字拼进 `reportText`。

**高级模式的问卷数据与三方报告输入（与拼装/融合模式不同）：** 拼装/融合模式给 LLM 的"模块事实"只包含扣分题（`assembleAllModules`，满分题连同整节满分的章节都会被过滤掉，不会出现在 payload 里），三方报告则由 `getThirdPartyReportSection()` 单独起一次独立的 LLM 调用先压缩成 `companyInfo`/`highlights` 两段摘要、缓存后直接拼进最终文档，写报告正文的那次调用完全看不到三方报告的任何内容。高级模式改用 `assembleAllModulesFull()`（`lib/checkup-report-assemble.ts`），把每道单选题（不管是否扣分）的题目、客户实际选中的选项、得分、预设风险描述与建议全部列出；三方报告内容和问卷全量数据放进同一条 user 消息，由同一次生成调用综合判断——是否要在正文里体现三方报告内容、体现到什么程度，完全由律师在"AI配置→高级模式"里保存的 prompt 自行决定（当前默认版要求把三方报告和问卷相互印证、篇幅不超过正文约 20%，不再有代码固定拼接的「三方背景信息」小节）。高级模式的 `max_tokens` 是 6500（其余模式仍是各自原值），比默认版要求的 3500-5500 中文字符输出留了余量，避免长报告在结尾被截断。

**三方报告原文过长时的降级链路（`lib/checkup-report-generate.ts`）：** 原文提取阶段有硬截断（`lib/extract-attachment-text.ts` 的 `MAX_EXTRACTED_CHARS`，当前 100,000 字，超出部分直接丢弃），这个数字纯粹是代码里写死的上限，不是 pdf-parse/mammoth 本身的限制；仍然不支持表格结构还原与扫描件 OCR。`extractAttachmentText()` 返回 `{ text, truncated, originalLength }`，写入 `CheckupAttachment.extractedTextTruncated`/`extractedTextOriginalLength` 并透传到 `/api/lawyer/checkups/[token]/third-party-report` 的响应，`ThirdPartyReportBox.tsx` 据此展示"原文约 N 字，超出部分未纳入分析"的提示。截断上限之内的原文如果本身仍然很长，和问卷全量数据、system prompt 一起提交高级模式主调用时仍可能超出模型的上下文窗口——由于律师的模型配置是纯 BYOK（任意 OpenAI 兼容 endpoint + 任意 model 字符串，`lib/llm-resolve.ts` 完全不做 token 计数或上下文窗口感知），无法精确判断"会不会超"，因此这里只按一个面向主流国内大模型（旗舰/长文本档位通常至少 32K～128K tokens）设定的经验字符阈值 `ADVANCED_THIRDPARTY_DETAIL_TRIGGER_CHARS`（当前 85,000 字，不考虑上下文窗口很小的模型）触发降级：
- 三方报告原文长度 ≤ 阈值：直接用原文（现状不变）。
- 超过阈值：改用 `getThirdPartyDetailedExtract()` 单独一次 LLM 调用生成的"详细摘要"（`CHECKUP_REPORT_THIRDPARTY_DETAILED_PROMPT`，`lib/dd-segment-default-templates.ts`）——这个 prompt 不是律师可编辑的效果文案，没有 section key，不在 AI配置 页面出现，只在这条降级链路内部使用；它和拼装/融合模式用的 `CHECKUP_REPORT_THIRDPARTY_DEFAULT`（两三句话概述）不同，要求尽量保留案号、金额、日期、当事人等具体细节，控制在 8000-15000 字，供高级模式主调用当作三方报告内容使用。摘要结果缓存在 `CheckupAttachment.parsedSummaryJson.detailedExtract`。
- 预处理时机：`third-party-report` 的 `POST`（上传接口）里，原文超过阈值就会立即尝试生成一次详细摘要并缓存，尽力而为、失败不阻塞上传；真正生成报告时 `getThirdPartyContentForAdvanced()` 还会按需补一次（未缓存成功时现场生成）。
- 兜底重试：高级模式主调用如果失败，且当时用的是原文（未走详细摘要）、原文长度 > 20,000 字，会自动换成详细摘要重试一次——不解析具体报错原因（不同供应商措辞不一致，判断不可靠），只要值得重试就试；重试后仍失败，`noAiFallback()` 的降级提示会替换成提示"可能是内容超出模型上下文，建议精简内容或换更大上下文的模型"的专门文案，和"账号/Key 均不可用"的通用提示区分开。
- 前端提示：`ThirdPartyReportBox.tsx` 除了截断提示，还会在原文超过阈值时展示"字数超长，已自动预提取摘要/正在预提取摘要"（`attachment.willUseDetailedExtract`/`hasDetailedExtract`，由 GET/POST 响应带出）。
- 模型建议：`LlmSettingsPanel.tsx`（律师本人 Key）和 `AdminAccountsClient.tsx`（管理员共用/共用备用 Key）的模型配置页都加了一句提示，建议优先选择旗舰/长文本档位模型；`lib/llm-providers.ts` 里各供应商的 `models` 预置列表本身也已包含这类档位（如 `qwen-max`/`qwen-plus`、`deepseek-v4-pro`、`glm-5.2`、`moonshot-v1-128k`）。

**报告头部（`generateCheckupReport()` 里的 `headerLines`，三种模式共用，代码固定拼接，不经过大模型改写）：** 一级标题"{委托方}法律体检报告"（居中），下接报告编号、报告日期、体检对象、统一社会信用代码、企业类型、所属行业六行。报告编号由 `buildReportNo(token, issueDate)` 纯前端派生（`LX-{年月日}-{token 哈希取模三位数字}`），同一份体检每次生成都得到相同编号，不需要额外的序号表。统一社会信用代码/企业类型/所属行业来自 `getHeaderCompanyInfo()`——单独一次轻量 LLM 调用（`temperature: 0`），只从三方报告原文里提取这三个结构化短字段，与高级模式主调用的"综合分析报告正文"职责分开；结果缓存在 `CheckupAttachment.parsedSummaryJson.headerFields`，避免每次生成都重新调用。没有三方报告、未启用三方报告或提取失败时，对应字段显示"未提供"。**这六行的粗体标签冒号必须写在闭合 `**` 外面**（`**报告编号**：值`，不能写成 `**报告编号：**值`）——CommonMark 强调分隔符的 flanking 规则下，闭合 `**` 前一个字符是标点（冒号）、后一个字符又紧跟非空白内容时，不构成有效右侧定界符，整行会被解析成纯文本、字面显示 `**`（真实出现过的 bug，`**问题依据：**\n正文` 这类后面紧跟换行的用法不受影响，只有"标签+冒号+值在同一行、值前没有换行或空格"这种模式会触发）。

**存储位置：** localStorage，键名同尽调报告那套，仍是 `lexcheck:dd-segment:{token}:{sectionKey}:prompt`（不再有 `:output` 这个键——五个标签页均已合并为单栏文本框），按 token 隔离；律师自建的模版库存 `lexcheck:checkup-report:saved-prompts:v1`（每条含 sectionKey，五个标签共用同一个库、按 sectionKey 过滤）。

**版本机制：** `CHECKUP_REPORT_PROMPT_VERSION`（当前 `"v7"`）控制五个标签统一强制刷新；改了任意一个 `CHECKUP_REPORT_PROMPT_DEFAULTS` 的默认版文案后，把这个常量改成下一个版本号即可让所有 token 的 localStorage 用新默认覆盖旧值——**注意这是五个标签共用一个版本号，一旦触发会把所有 token 下这五个标签已经"启用"的内容（包括律师自己编辑并启用过的自定义正文）一并覆盖回新默认版，不是只刷新改动的那一个标签**，改动前需要评估是否有律师已经在生产环境自定义并启用过其他标签的内容。

**局部失败提示：** `generateCheckupReport()` 返回值里的 `degraded` 字段——summary/actionPlan 落到占位文案、融合模式某模块退回规则拼装、或高级模式返回内容缺少固定小节标题时会置为 `true`，前端 `CheckupReportPanel.tsx` 据此在生成成功但内容不完整时额外提示"部分内容未完全生成，已用预设内容兜底，建议人工核对"，与"未使用大模型"（`usedAi: false`）的整体失败提示区分开。高级模式的完整性检查在 `assessAdvancedOutput()`：必须同时出现「## 报告基础与分析口径」「## 公司总体法律风险画像」「## 评分与重点风险概览」「## 专项风险分析与律师建议」「## 90日整改工作安排」「## 结论」这六个固定二级标题，且至少出现一个三级标题（`###`）——v6 起风险主题标题不再要求编号（`### 1. xxx`），因为编号和正文"律师建议的近期动作"里的阿拉伯数字编号列表放在一起容易混淆到底是标题序号还是列表序号，所以干脆去掉标题编号，靠标题本身的字号/颜色区分层级，检查逻辑相应放宽成"至少出现一个三级标题"。标题级别正则用 `(?!#)` 卡住层级（如 `##(?!#)`），避免"检查 `##`"时把文中出现的 `###` 也算命中。

**生成报告时手动选择模型来源：** `CheckupReportPanel.tsx` 的"报告制作"标签页在模式下拉框（默认 `"advanced"`，即高级模式，之前默认融合模式）和"生成报告"按钮之间加了第二个下拉框，选项来自 `GET /api/lawyer/llm/profiles`（`resolveLlmProfiles(lawyer.id)` 去掉 `apiKey`/`base` 后原样返回 `{source, model}` 列表），显示成"{model}-自用/共用/共用备用"；默认选中"自动（按默认顺序）"（对应不传 `llmSource`，走原有级联）。选中具体来源后，前端把 `llmSource` 带进 `POST checkup-report` 请求体，一路透传进 `generateCheckupReport(opts.llmSource)`，再传给 `resolveLlmProfiles(lawyerId, preferredSource)`——传了 `preferredSource` 时直接把候选列表过滤成那一个来源，不会再退回级联（该来源当时恰好失效也不会静默换成别的来源，而是按"无可用档案"处理），报告正文调用和三方报告相关的几次辅助调用（`getHeaderCompanyInfo`/`getThirdPartyReportSection`/`getThirdPartyDetailedExtract`）都会带上同一个 `llmSource`，保持一次生成过程里用的是同一个模型来源。

**导出 md：** "导出 Word"按钮左边新增"导出 md"，调用 `export-quick-exam-report.ts` 里早就存在但之前没在这个面板接入过的 `downloadQuickExamMarkdown(text, baseName)`——直接把 `reportText` 状态包成 `Blob` 触发下载，不经过 docx 转换。

---

## 账号体系（邮箱为主，手机号为辅）

`User` 表：`email`（唯一，主账号标识，新账号必填）、`passwordHash`（可选，未设置时只能用邮箱验证码登录）、`phone`（唯一，可选，短信服务商未接入前仍可用共享临时验证码登录，作为辅助方式保留）。

**登录方式（`app/api/auth/verify/route.ts` 的 `method` 字段区分）：**
- `email_code`：邮箱验证码登录/注册。验证码由 `lib/auth.ts` 的 `createEmailVerificationCode()` 生成（6 位数字，10 分钟有效，存 `EmailVerificationCode` 表，一次性消费），通过 `lib/email.ts` 的 `sendSystemEmail()` 用后台配置的系统邮箱真实发出——与旧的手机号"共享静态码"机制不同，这是每次都不一样的真实验证码。未注册邮箱走该接口会自动创建 **客户账号**（律师账号只能由管理员在后台添加），可选填手机号。
- `email_password`：邮箱+密码登录。未设置过密码的账号会被拒绝并提示改用验证码登录。
- `phone_code`（默认，向后兼容）：手机号 + 共享临时验证码（`AuthSettings.tempCode`），机制未变。

**密码管理：** `POST /api/auth/set-password`（已登录态自助设置/修改，首次设置不需要旧密码，已有密码则必须提供正确旧密码）。密码用 Node 内置 `crypto.scryptSync` 加盐哈希（`salt:hash` 存于 `passwordHash`），未引入 bcrypt 等第三方依赖。因为验证码登录随时可用，不需要单独做"忘记密码"邮件找回流程——忘记密码时改用验证码登录，登录后在「个人资料」重新设置即可。

**换绑邮箱：** `POST /api/auth/change-email`，`step=request` 先向新邮箱发验证码，`step=confirm` 校验后才真正更新，防止误填/盗用他人邮箱。入口在「个人资料」页（`app/profile/ProfileForm.tsx`）。

**账号创建入口（后台管理"账号管理"、律师端"客户管理"）：** 邮箱必填、手机号可选，两个唯一性都在对应 API 路由（`app/api/admin/users/*`、`app/api/lawyer/clients/*`）里各自校验。

**首页即登录页：** `app/page.tsx` 不再是营销落地页（原"关于/团队/应用/资源"板块已删除），改为左右分屏——左侧欢迎语 + `LoginForm`（通过 `app/HomeLoginPanel.tsx` 包一层处理登录成功后的跳转），右侧深蓝渐变 + SVG 波浪装饰 + "HE Partners" 大字。已登录用户访问 `/` 会被服务端直接重定向到工作台/问卷页；`/login`、`/login/lawyer`、`/login/user` 三个旧路由全部重定向到 `/`。全局 `AppChrome` 在 `/` 上隐藏 `SiteHeader`/`SiteFooter`（这个页面自带极简的品牌区/联系方式，不需要通用站头）。`SiteHeader` 里原本指向首页各板块锚点的导航（关于/团队/应用/资源/联系我们）随之整体移除。

**登录 UI：** `components/auth/LoginForm.tsx`——单一账号输入框（不再分邮箱/手机号标签），根据输入内容自动识别类型（含 `@` 判为邮箱，匹配手机号正则判为手机号）决定登录方式：邮箱可选验证码/密码，手机号固定验证码。注册页固定"邮箱必填 + 手机号选填"两个字段（不随登录框的识别结果变化），统一走 `method: "email_code"`。`LoginDialog.tsx`、`/login` 两处入口都直接渲染这一个组件。

**客户端问卷相关页面（`/q`、`/q/new`、`/q/[token]`）未登录时的处理：** 不再各自内嵌一份登录表单（旧的 `ClientAuthGate` 组件已删除），统一 `redirect` 到首页并带上 `?next=<原始路径>`；首页 `app/page.tsx` 登录成功后会优先跳回 `next` 指定的地址（校验必须是站内相对路径，防止开放重定向），没有 `next` 时才按角色跳到默认落地页。这样任何入口触发的登录都只有首页这一套外观，避免出现新旧两套登录界面混杂、还带着全局页头页脚的观感割裂问题。

---

## 体检报告：手动编辑 / 保存 / 定稿 / 发送客户邮箱

律师端「报告制作」（`CheckupReportPanel.tsx`）在 AI 生成报告之后，新增了脱离"生成即结束"的后续处理能力，复用了原本只给尽调报告应用用的 `CheckupFinalReport` 表（1:1 挂在 `CheckupWorkspace` 下）。

**存储与状态：**
- 报告正文落库在 `CheckupFinalReport.reportText`，不再只存在 localStorage / React state 里；localStorage 仍保留一份"最近一次生成结果"（`checkupReportStorageKey`，`{text, generatedAt}` 结构，`writeCachedReport()`/`readCachedReport()`），但**不是**简单地"数据库有保存过就永远优先用数据库"——那样会导致律师生成了新报告但忘了点"保存"，刷新页面后反而看到更早保存的旧版本（真实出现过的问题）。实际逻辑是 `resolveLatestReportText()`：比较本地缓存的 `generatedAt` 和 `CheckupFinalReport.updatedAt`，谁的时间更新就展示谁；页面初次挂载和"返回最新"（从历史版本切回来）都走这个函数，保持一致。旧版本 localStorage 里的纯文本（没有时间戳）会被当作很旧的缓存处理，不会错误覆盖数据库版本。
- `finalizedAt` 非空即代表"已定稿"：定稿后编辑区、保存、重新生成按钮全部禁用，需先点"取消定稿"解锁。服务端 `POST /api/lawyer/checkups/[token]/report` 也会拒绝对已定稿报告的保存请求（不是纯前端限制）。
- `emailSentAt`/`emailSentTo` 记录最近一次发送邮件的时间与收件地址，供界面展示。

**三个新路由（`app/api/lawyer/checkups/[token]/report/`）：**
- `POST report`：保存人工编辑后的报告正文（`upsert` 到 `CheckupFinalReport`，已定稿时返回 400）。
- `PATCH report`：定稿 / 取消定稿（`{finalize: boolean}`），定稿前必须已保存过一次。
- `POST report/send-email`：把已保存的报告正文转成 Word 附件（`lib/report-docx.ts` 的 `buildReportDocxBuffer()`，服务端用 `docx` 包的 `Packer.toBuffer()`，和客户端导出共用同一份 `buildReportDocxDocument()` 排版逻辑，只是产出 Buffer 而非 Blob）发送邮件；收件地址默认取该问卷关联客户账号的 `email`，也可在发送前手动改写；邮件正文/主题留空时会自动生成。发送前必须已保存报告（未保存直接拒绝）。

**编辑体验：** 报告预览默认是渲染后的 Markdown（`QuickExamReportMarkdown`），点"编辑"切换成纯文本 `<textarea>` 直接改 `reportText`；"保存"按钮只在内容和已保存版本不一致时可点，未保存的修改会在状态栏提示"有未保存的修改"。

**生成中的进度提示：** 高级模式是单次调用直接产出完整正文，不存在"先写摘要、再写整改建议"这种分步骤过程，`generateReport()` 里两段延时提示文案按 `reportMode` 分开措辞，不再对高级模式也显示"正在生成开头概述与整改顺序建议"这种只适用于拼装/融合模式的说法。另外每次成功生成（`usedAi !== false`）会把耗时记进 `localStorage`（`genDurationStorageKey(mode)`，按模式分别存，只保留最近 10 次），生成中时状态栏会显示"该模式近期平均约 X"，作为等待时长的参考，不追求准确复刻真实后端阶段。

---

## 系统邮箱（SMTP）配置

后台管理「系统邮箱」标签页（`app/lawyer/admin/AdminAccountsClient.tsx`）配置全局共用的 SMTP 发信账号，用于后续向客户发送报告等系统邮件。

**存储位置：** 数据库 `AuthSettings` 单例表的 `smtpHost`/`smtpPort`/`smtpSecure`/`smtpUser`/`smtpPass`/`smtpFromName` 字段（与共用大模型 Key 同一张表），通过 `app/api/admin/settings` 的 GET/PATCH 读写，仅管理员可访问。

**连通性测试：** `app/api/admin/email/test-send/route.ts`（仅管理员）用 `nodemailer.createTransport()` 直接拿表单里尚未保存的值发一封测试邮件，不落库、不依赖已保存的设置，与「公用大模型」标签页的「检测连通性」是同一种"先测后存"模式。

**已接入：** 「体检报告：手动编辑 / 保存 / 定稿 / 发送客户邮箱」一节里的"发送客户邮箱"功能直接复用这里的 `AuthSettings.smtp*` 字段（通过 `lib/email.ts` 的 `sendSystemEmail()`），不需要额外的邮件配置入口。

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
