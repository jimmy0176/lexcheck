import type { Paragraph as DocxParagraph, Table as DocxTable } from "docx";
import { markdownToDocxChildren } from "@/lib/quick-exam-markdown-docx";

/** 与登录页右侧品牌区（深藏青底 + 蓝色点缀波纹，见 components/hero-waves.tsx）同一套配色，用于封面兜底方案（背景图加载失败时）。 */
const COVER_NAVY = "0B1958";

/** 封面背景图，A4 比例（1055×1491px，约等于 210×297mm），public 目录下的静态资源。 */
const COVER_BG_PUBLIC_PATH = "/assets/report-cover-bg.png";
/** A4 页面在 96dpi 下的像素尺寸，用于把背景图铺满整页（含页边距，出血到纸张边缘）。 */
const COVER_BG_PAGE_WIDTH_PX = 794;
const COVER_BG_PAGE_HEIGHT_PX = 1123;

/** 封面日期行格式：2026.7.18（不带"出具日期"字样、不补零，直接呈现落款日期）。 */
function formatCoverIssueDate(date: Date): string {
  return `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()}`;
}

/**
 * 封面背景图字节：服务端直接读 public 目录下的文件（不经过 HTTP，邮件发送等服务端场景不依赖网络），
 * 浏览器端用 fetch 拉取同一份静态资源。任一环节失败都返回 null，调用方据此回退到纯色封面，
 * 不能因为背景图加载失败导致整份报告生成不出来。
 */
async function loadCoverBackgroundBytes(): Promise<Uint8Array | null> {
  try {
    if (typeof window === "undefined") {
      const { readFile } = await import("node:fs/promises");
      const path = await import("node:path");
      const buf = await readFile(path.join(process.cwd(), "public", COVER_BG_PUBLIC_PATH));
      return new Uint8Array(buf);
    }
    const res = await fetch(COVER_BG_PUBLIC_PATH);
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}

/**
 * Word 报告封面：优先用真实背景图（深藏青底 + 蓝色波纹线条，设计稿见 public/assets/report-cover-bg.png，
 * 视觉上呼应登录页右侧背景/工作台左栏），以浮动图片铺满整页、置于文字下方；图片加载失败时（比如部署环境
 * 缺这个静态文件）回退成纯色块封面，保证报告仍然能正常生成。
 * 文字布局：正中偏上两行标题（报告标题+委托方名称），中间偏下两行品牌落款（HE PARTNERS+出具日期）。
 */
async function buildCoverSectionChildren(opts: {
  companyName: string;
  issueDate: string;
}): Promise<(DocxParagraph | DocxTable)[]> {
  const {
    Paragraph,
    Table,
    TableRow,
    TableCell,
    TextRun,
    ImageRun,
    AlignmentType,
    WidthType,
    BorderStyle,
    ShadingType,
    TextWrappingType,
    HorizontalPositionAlign,
    VerticalPositionAlign,
    HorizontalPositionRelativeFrom,
    VerticalPositionRelativeFrom,
  } = await import("docx");

  const coverFont = { name: "Arial", eastAsia: "Arial" };
  const titleParagraphs = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 4400, after: 0 },
      children: [new TextRun({ text: "企业法律体检报告", bold: true, color: "FFFFFF", size: 64, font: coverFont })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 260, after: 0 },
      children: [new TextRun({ text: opts.companyName, bold: true, color: "FFFFFF", size: 40, font: coverFont })],
    }),
    new Paragraph({ spacing: { before: 4000, after: 0 }, children: [new TextRun({ text: "" })] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 0 },
      children: [new TextRun({ text: "HE PARTNERS", bold: true, color: "FFFFFF", size: 32, font: coverFont })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 0 },
      children: [new TextRun({ text: opts.issueDate, color: "FFFFFF", size: 26, font: coverFont })],
    }),
  ];

  const bgBytes = await loadCoverBackgroundBytes();
  if (bgBytes) {
    const bgParagraph = new Paragraph({
      children: [
        new ImageRun({
          type: "png",
          data: bgBytes,
          transformation: { width: COVER_BG_PAGE_WIDTH_PX, height: COVER_BG_PAGE_HEIGHT_PX },
          floating: {
            horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, align: HorizontalPositionAlign.CENTER },
            verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, align: VerticalPositionAlign.TOP },
            behindDocument: true,
            wrap: { type: TextWrappingType.NONE },
          },
        }),
      ],
    });
    return [bgParagraph, ...titleParagraphs];
  }

  // 兜底：背景图加载失败时用纯色块模拟封面，保证报告仍能正常生成。
  const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };
  const cell = new TableCell({
    shading: { type: ShadingType.SOLID, color: COVER_NAVY, fill: COVER_NAVY },
    borders: noBorders,
    margins: { top: 200, bottom: 200, left: 500, right: 500 },
    children: titleParagraphs,
  });
  const row = new TableRow({ cantSplit: true, height: { value: 12000, rule: "atLeast" }, children: [cell] });
  const table = new Table({
    rows: [row],
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { ...noBorders, insideHorizontal: noBorder, insideVertical: noBorder },
  });
  return [table];
}

/**
 * 修复 LLM 常见 GFM 表格输出问题，在转 Word 前运行：
 * 1. 表头后缺少分隔行 → 自动插入
 * 2. 分隔行格式不规范（只有 --- 没有 |）→ 补全竖线
 */
export function fixGfmTablesForDocx(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    const trimmed = line.trim();
    // 判断是否是表格行：以 | 开头或结尾
    if (trimmed.startsWith("|") || (trimmed.includes("|") && !trimmed.startsWith("#"))) {
      const isTableRow = trimmed.startsWith("|");
      if (isTableRow) {
        // 收集连续的表格行
        const block: string[] = [line];
        i++;
        while (i < lines.length && lines[i]!.trim().startsWith("|")) {
          block.push(lines[i]!);
          i++;
        }
        // 检查第二行是否是有效分隔行（含 --- 或 :---:）
        const sepPattern = /^\|[\s|:\-]+\|$/;
        const hasSep = block.length >= 2 && sepPattern.test(block[1]!.trim());
        if (!hasSep && block.length >= 1) {
          // 根据表头列数生成分隔行
          const cols = (block[0]!.match(/(?<!\|)\|(?!\|)/g) ?? []).length - 1;
          const colCount = Math.max(cols, 1);
          const sep = "| " + Array(colCount).fill("---").join(" | ") + " |";
          block.splice(1, 0, sep);
        }
        out.push(...block);
        continue;
      }
    }
    out.push(line);
    i++;
  }
  return out.join("\n");
}

/**
 * 构建报告正文对应的 docx Document 对象；供客户端导出（Packer.toBlob）和服务端邮件附件（Packer.toBuffer）共用。
 * 第一页是封面（独立 section，深藏青底 + 品牌名/标题/委托方/日期），第二页起是原有的正文内容，不受影响。
 */
export async function buildReportDocxDocument(
  text: string,
  opts: { companyName?: string | null; issueDate?: Date } = {}
) {
  const { Document, Paragraph, TextRun } = await import("docx");
  const fixed = fixGfmTablesForDocx(text);
  const { children, stats } = markdownToDocxChildren(fixed);
  const useChildren =
    stats.parseOk && children.length > 0
      ? children
      : fixed.split(/\n/).map(
          (line) =>
            new Paragraph({
              children: [new TextRun({ text: line.length > 0 ? line : " " })],
            })
        );
  if (stats.usedFallback || !stats.parseOk) {
    if (process.env.NODE_ENV === "development") {
      console.info("[report-docx] fallback to line paragraphs", stats);
    }
  }
  const coverChildren = await buildCoverSectionChildren({
    companyName: opts.companyName?.trim() || "（未填写公司名称）",
    issueDate: formatCoverIssueDate(opts.issueDate ?? new Date()),
  });
  return new Document({
    styles: {
      default: {
        document: {
          run: {
            font: { name: "Arial" },
            size: 22,
          },
          paragraph: {
            spacing: { line: 360, lineRule: "auto" as const },
          },
        },
        // 一级标题现在专用于报告正文最顶部的文档标题（全文仅此一处，居中，见 markdownToDocxChildren 里
        // depth===1 时的居中处理），字号必须明显大于二级/三级，避免看起来和下面的编号小标题混在一层。
        heading1: {
          run: { font: { name: "Arial", eastAsia: "黑体" }, size: 40, bold: true, color: "1F4D78" },
          paragraph: { spacing: { before: 0, after: 200, line: 360, lineRule: "auto" as const } },
        },
        heading2: {
          run: { font: { name: "Arial", eastAsia: "黑体" }, size: 28, bold: true, color: COVER_NAVY },
          paragraph: { spacing: { before: 200, after: 100, line: 360, lineRule: "auto" as const } },
        },
        heading3: {
          run: { font: { name: "Arial", eastAsia: "黑体" }, size: 24, bold: true, color: "2E74B5" },
          paragraph: { spacing: { before: 160, after: 80, line: 360, lineRule: "auto" as const } },
        },
        // 现在正文最深只用到三级标题（见下方 markdownToDocxChildren 的调用方），四级只是预留兜底，
        // 字号必须小于三级，避免出现更深层级反而字号更大的层级反转。
        heading4: {
          run: { font: { name: "Arial", eastAsia: "黑体" }, size: 20, bold: true, color: "1A2E4A" },
          paragraph: { spacing: { before: 140, after: 60, line: 360, lineRule: "auto" as const }, keepNext: true },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, bottom: 720, left: 720, right: 720 },
          },
        },
        children: coverChildren,
      },
      {
        properties: {
          page: {
            margin: { top: 1202, bottom: 1440, left: 1202, right: 1202 },
          },
        },
        children: useChildren,
      },
    ],
  });
}

/** 服务端生成 docx 二进制，用于邮件附件等不经过浏览器的场景。 */
export async function buildReportDocxBuffer(
  text: string,
  opts: { companyName?: string | null; issueDate?: Date } = {}
): Promise<Buffer> {
  const { Packer } = await import("docx");
  const doc = await buildReportDocxDocument(text, opts);
  return Packer.toBuffer(doc);
}
