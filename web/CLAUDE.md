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
│   │       ├── CheckupPromptEditor.tsx      # 单栏内容编辑器（内置默认只读 + 律师自建模版），被上者复用
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
| 高级模式 | `CHECKUP_REPORT_ADVANCED_SECTION_KEY` | `mode=advanced` | AI 一次性生成「摘要 → 各模块 → 整改建议」整段 Markdown，模块顺序/分组/取舍均可由提示词控制；页头信息与免责声明仍由代码固定拼接 |
| 三方报告提取 | `CHECKUP_REPORT_THIRDPARTY_SECTION_KEY` | 不属于上面三种模式，是一个独立的前置步骤 | 从上传的三方背景报告原文提炼 `companyInfo`/`highlights`，随报告开头一并插入，结果按附件缓存 |
| 免责声明 | `CHECKUP_REPORT_DISCLAIMER_SECTION_KEY` | 不经过大模型 | 报告末尾固定文本，律师可完全自由改写，逐字插入报告，没有护栏 |

**前四个标签页的系统提示词分两层，都在 `lib/dd-segment-default-templates.ts` 里定义：**
- `CHECKUP_REPORT_GUARDRAILS[sectionKey]`：**护栏**，硬性约束（JSON 输出契约/键名、禁止编造、融合模式"风险与建议不能只留一半"等），代码固定拼接在 system 提示词最前面，页面上只读展示，律师不能编辑。免责声明没有对应护栏条目（不经过大模型），`CheckupPromptEditor` 的 `guardrail` 传空字符串时不渲染护栏区块。
- `CHECKUP_REPORT_PROMPT_DEFAULTS[sectionKey]`：**效果文案的内置默认值**（五个标签都有，免责声明这一条就是文档正文本身），语气、结构、分段规则等与生成效果直接相关的部分，律师可在页面上整段改写、另存为自定义模版、选择"启用"生效。

`lib/checkup-report-generate.ts` 里的 `buildSystemPrompt(sectionKey, effectiveText)` 负责把"护栏 + 律师保存的效果文案（为空则用内置默认）"拼成最终 system 消息；免责声明不走这个函数，是直接把律师保存的文本（为空则用内置默认）逐字拼进 `reportText`。

**存储位置：** localStorage，键名同尽调报告那套，仍是 `lexcheck:dd-segment:{token}:{sectionKey}:prompt`（不再有 `:output` 这个键——五个标签页均已合并为单栏文本框），按 token 隔离；律师自建的模版库存 `lexcheck:checkup-report:saved-prompts:v1`（每条含 sectionKey，五个标签共用同一个库、按 sectionKey 过滤）。

**版本机制：** `CHECKUP_REPORT_PROMPT_VERSION`（当前 `"v1"`）控制五个标签统一强制刷新；改了任意一个 `CHECKUP_REPORT_PROMPT_DEFAULTS` 的内置默认文案后，把这个常量改成下一个版本号即可让所有 token 的 localStorage 用新默认覆盖旧值。

**局部失败提示：** `generateCheckupReport()` 返回值里的 `degraded` 字段——summary/actionPlan 落到占位文案、融合模式某模块退回规则拼装、或高级模式返回内容缺少「### 报告摘要」「### 重点整改顺序建议」等结构标志时会置为 `true`，前端 `CheckupReportPanel.tsx` 据此在生成成功但内容不完整时额外提示"部分内容未完全生成，已用预设内容兜底，建议人工核对"，与"未使用大模型"（`usedAi: false`）的整体失败提示区分开。

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
- 报告正文落库在 `CheckupFinalReport.reportText`，不再只存在 localStorage / React state 里（localStorage 仍保留，作为"最近一次生成但未保存"的兜底，优先级低于数据库里的已保存版本）。
- `finalizedAt` 非空即代表"已定稿"：定稿后编辑区、保存、重新生成按钮全部禁用，需先点"取消定稿"解锁。服务端 `POST /api/lawyer/checkups/[token]/report` 也会拒绝对已定稿报告的保存请求（不是纯前端限制）。
- `emailSentAt`/`emailSentTo` 记录最近一次发送邮件的时间与收件地址，供界面展示。

**三个新路由（`app/api/lawyer/checkups/[token]/report/`）：**
- `POST report`：保存人工编辑后的报告正文（`upsert` 到 `CheckupFinalReport`，已定稿时返回 400）。
- `PATCH report`：定稿 / 取消定稿（`{finalize: boolean}`），定稿前必须已保存过一次。
- `POST report/send-email`：把已保存的报告正文转成 Word 附件（`lib/report-docx.ts` 的 `buildReportDocxBuffer()`，服务端用 `docx` 包的 `Packer.toBuffer()`，和客户端导出共用同一份 `buildReportDocxDocument()` 排版逻辑，只是产出 Buffer 而非 Blob）发送邮件；收件地址默认取该问卷关联客户账号的 `email`，也可在发送前手动改写；邮件正文/主题留空时会自动生成。发送前必须已保存报告（未保存直接拒绝）。

**编辑体验：** 报告预览默认是渲染后的 Markdown（`QuickExamReportMarkdown`），点"编辑"切换成纯文本 `<textarea>` 直接改 `reportText`；"保存"按钮只在内容和已保存版本不一致时可点，未保存的修改会在状态栏提示"有未保存的修改"。

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
