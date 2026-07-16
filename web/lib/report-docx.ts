import { markdownToDocxChildren } from "@/lib/quick-exam-markdown-docx";

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

/** 构建报告正文对应的 docx Document 对象；供客户端导出（Packer.toBlob）和服务端邮件附件（Packer.toBuffer）共用。 */
export async function buildReportDocxDocument(text: string) {
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
        heading1: {
          run: { font: { name: "Arial", eastAsia: "黑体" }, size: 34, bold: true },
          paragraph: { spacing: { before: 240, after: 120, line: 360, lineRule: "auto" as const } },
        },
        heading2: {
          run: { font: { name: "Arial", eastAsia: "黑体" }, size: 28, bold: true, color: "2E74B5" },
          paragraph: { spacing: { before: 200, after: 100, line: 360, lineRule: "auto" as const } },
        },
        heading3: {
          run: { font: { name: "Arial", eastAsia: "黑体" }, size: 24, bold: true, color: "1F4D78" },
          paragraph: { spacing: { before: 160, after: 80, line: 360, lineRule: "auto" as const } },
        },
      },
    },
    sections: [
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
export async function buildReportDocxBuffer(text: string): Promise<Buffer> {
  const { Packer } = await import("docx");
  const doc = await buildReportDocxDocument(text);
  return Packer.toBuffer(doc);
}
