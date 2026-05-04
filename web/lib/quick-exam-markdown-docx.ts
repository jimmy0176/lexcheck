import type {
  Content,
  PhrasingContent,
  Root,
  Table as MdTable,
  TableCell as MdTableCell,
  Paragraph as MdParagraph,
  Heading,
  Code,
  Blockquote,
  List,
  ListItem,
} from "mdast";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import type { IRunOptions } from "docx";
import {
  Paragraph as DocxParagraph,
  Table as DocxTable,
  TableRow,
  TableCell,
  TextRun,
  HeadingLevel,
  WidthType,
  BorderStyle,
  ShadingType,
  AlignmentType,
} from "docx";

export type QuickExamDocxBuildStats = {
  tablesDetected: number;
  tableRowCounts: number[];
  parseOk: boolean;
  usedFallback: boolean;
};

type TableStats = { tableRowCounts: number[] };

const HEADING_LEVELS = [
  HeadingLevel.HEADING_1,
  HeadingLevel.HEADING_2,
  HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4,
  HeadingLevel.HEADING_5,
  HeadingLevel.HEADING_6,
] as const;

function phrasingToPlain(nodes: readonly PhrasingContent[]): string {
  const parts: string[] = [];
  for (const n of nodes) {
    if (n.type === "text") parts.push(n.value);
    else if (n.type === "strong" || n.type === "emphasis" || n.type === "delete")
      parts.push(phrasingToPlain(n.children as PhrasingContent[]));
    else if (n.type === "inlineCode") parts.push(n.value);
    else if (n.type === "break") parts.push("\n");
    else if (n.type === "link") parts.push(phrasingToPlain(n.children as PhrasingContent[]));
    else parts.push("");
  }
  return parts.join("");
}

function phrasingToRuns(nodes: readonly PhrasingContent[], forceBold = false, color?: string): TextRun[] {
  const runs: TextRun[] = [];
  const walk = (list: readonly PhrasingContent[], bold: boolean, italics: boolean) => {
    for (const n of list) {
      if (n.type === "text") {
        const opts: IRunOptions = {
          text: n.value,
          ...(bold || forceBold ? { bold: true } : {}),
          ...(italics ? { italics: true } : {}),
          ...(color ? { color } : {}),
        };
        runs.push(new TextRun(opts));
      } else if (n.type === "strong") {
        walk(n.children as PhrasingContent[], true, italics);
      } else if (n.type === "emphasis") {
        walk(n.children as PhrasingContent[], bold, true);
      } else if (n.type === "inlineCode") {
        runs.push(new TextRun({ text: n.value, font: "Consolas", ...(forceBold ? { bold: true } : {}), ...(color ? { color } : {}) }));
      } else if (n.type === "break") {
        runs.push(new TextRun({ text: "\n" }));
      } else if (n.type === "link") {
        walk(n.children as PhrasingContent[], bold, italics);
      } else if (n.type === "delete") {
        walk(n.children as PhrasingContent[], bold, italics);
      }
    }
  };
  walk(nodes, false, false);
  return runs.length > 0 ? runs : [new TextRun({ text: " ", ...(forceBold ? { bold: true } : {}), ...(color ? { color } : {}) })];
}

function mdParagraphToDocx(p: MdParagraph): DocxParagraph {
  return new DocxParagraph({ children: phrasingToRuns(p.children as PhrasingContent[]) });
}

function mdHeadingToDocx(h: Heading): DocxParagraph {
  const level = Math.min(Math.max(h.depth, 1), 6) - 1;
  const hl = HEADING_LEVELS[level] ?? HeadingLevel.HEADING_6;
  return new DocxParagraph({
    heading: hl,
    children: phrasingToRuns(h.children as PhrasingContent[]),
  });
}

function mdCodeToDocx(c: Code): DocxParagraph {
  const t = c.value || " ";
  return new DocxParagraph({
    children: [new TextRun({ text: t, font: "Consolas" })],
  });
}

function mdBlockquoteToDocx(b: Blockquote, stats: TableStats): (DocxParagraph | DocxTable)[] {
  return b.children.flatMap((ch) => {
    if (ch.type === "paragraph") {
      const plain = phrasingToPlain(ch.children as PhrasingContent[]);
      return [
        new DocxParagraph({
          children: [new TextRun({ text: `「${plain}」` })],
        }),
      ];
    }
    return blockToDocx(ch as Content, stats);
  });
}

function mdListToDocx(list: List, depth: number, stats: TableStats): (DocxParagraph | DocxTable)[] {
  const out: (DocxParagraph | DocxTable)[] = [];
  let index = 1;
  for (const item of list.children) {
    const li = item as ListItem;
    const isOrdered = list.ordered;
    const prefix = isOrdered ? `${index++}. ` : "• ";
    const first = li.children[0] as Content | undefined;
    if (first && first.type === "paragraph") {
      let runs: TextRun[];
      if (isOrdered) {
        const numRun = new TextRun({ text: "  ".repeat(depth) + prefix, color: "B8982A" });
        const contentRuns = phrasingToRuns((first as MdParagraph).children as PhrasingContent[], false, "1A2E4A");
        runs = [numRun, ...contentRuns];
      } else {
        runs = phrasingToRuns((first as MdParagraph).children as PhrasingContent[]);
        runs.unshift(new TextRun({ text: "  ".repeat(depth) + prefix }));
      }
      out.push(new DocxParagraph({ children: runs }));
      for (let i = 1; i < li.children.length; i++) {
        const sub = li.children[i];
        if (sub.type === "list") {
          out.push(...mdListToDocx(sub as List, depth + 1, stats));
        } else {
          out.push(...blockToDocx(sub as Content, stats));
        }
      }
    } else if (first) {
      out.push(...blockToDocx(first as Content, stats));
    }
  }
  return out;
}

const TABLE_BORDER = { style: BorderStyle.SINGLE, size: 4, color: "AAAAAA" };
const TABLE_BORDERS = {
  top: TABLE_BORDER,
  bottom: TABLE_BORDER,
  left: TABLE_BORDER,
  right: TABLE_BORDER,
  insideHorizontal: TABLE_BORDER,
  insideVertical: TABLE_BORDER,
};

type GfmAlign = "left" | "center" | "right" | null;

function gfmAlignToDocx(a: GfmAlign): (typeof AlignmentType)[keyof typeof AlignmentType] {
  if (a === "center") return AlignmentType.CENTER;
  if (a === "right") return AlignmentType.RIGHT;
  return AlignmentType.LEFT;
}

function tableCellToDocx(cell: MdTableCell, isHeader: boolean, align: GfmAlign): TableCell {
  const paragraphs: DocxParagraph[] = [];
  for (const c of cell.children as unknown as readonly Content[]) {
    if (c.type === "paragraph") {
      paragraphs.push(
        new DocxParagraph({
          alignment: gfmAlignToDocx(align),
          children: phrasingToRuns((c as MdParagraph).children as PhrasingContent[], isHeader),
        })
      );
    }
  }
  if (paragraphs.length === 0) {
    paragraphs.push(
      new DocxParagraph({
        alignment: gfmAlignToDocx(align),
        children: [new TextRun({ text: " ", bold: isHeader })],
      })
    );
  }
  return new TableCell({
    children: paragraphs,
    shading: isHeader ? { type: ShadingType.SOLID, color: "D9D9D9", fill: "D9D9D9" } : undefined,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
  });
}

function mdTableToDocx(table: MdTable): { table: DocxTable; rowCount: number } {
  const aligns: GfmAlign[] = (table.align ?? []) as GfmAlign[];

  if (table.children.length === 0) {
    const row = new TableRow({
      children: [
        new TableCell({
          children: [new DocxParagraph({ children: [new TextRun({ text: " " })] })],
        }),
      ],
    });
    return {
      table: new DocxTable({
        rows: [row],
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: TABLE_BORDERS,
      }),
      rowCount: 1,
    };
  }

  const fixedRows = table.children.map((row, rowIdx) =>
    new TableRow({
      tableHeader: rowIdx === 0,
      children: row.children.map((cell, colIdx) =>
        tableCellToDocx(cell as MdTableCell, rowIdx === 0, aligns[colIdx] ?? null)
      ),
    })
  );

  const t = new DocxTable({
    rows: fixedRows,
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: TABLE_BORDERS,
  });
  return { table: t, rowCount: fixedRows.length };
}

function blockToDocx(node: Content, stats: TableStats): (DocxParagraph | DocxTable)[] {
  switch (node.type) {
    case "heading":
      return [mdHeadingToDocx(node)];
    case "paragraph":
      return [mdParagraphToDocx(node)];
    case "code":
      return [mdCodeToDocx(node)];
    case "blockquote":
      return mdBlockquoteToDocx(node, stats);
    case "list":
      return mdListToDocx(node, 0, stats);
    case "table": {
      const { table, rowCount } = mdTableToDocx(node);
      stats.tableRowCounts.push(rowCount);
      return [table];
    }
    case "thematicBreak":
      return [new DocxParagraph({ children: [new TextRun({ text: "—" })] })];
    default:
      return [new DocxParagraph({ children: [new TextRun({ text: " " })] })];
  }
}

/**
 * 将 Markdown（GFM）转为 docx 段落/表格列表；失败时由调用方回退为按行纯文本。
 */
export function markdownToDocxChildren(markdown: string): {
  children: (DocxParagraph | DocxTable)[];
  stats: QuickExamDocxBuildStats;
} {
  const tableStats: TableStats = { tableRowCounts: [] };
  try {
    const tree = unified().use(remarkParse).use(remarkGfm).parse(markdown) as Root;
    const children: (DocxParagraph | DocxTable)[] = [];
    for (const block of tree.children) {
      children.push(...blockToDocx(block, tableStats));
    }
    const tablesDetected = tableStats.tableRowCounts.length;
    if (process.env.NODE_ENV === "development") {
      console.info("[quick-exam-docx]", {
        tablesDetected,
        tableRowCounts: tableStats.tableRowCounts,
        parseOk: true,
      });
    }
    return {
      children,
      stats: {
        tablesDetected,
        tableRowCounts: tableStats.tableRowCounts,
        parseOk: true,
        usedFallback: false,
      },
    };
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[quick-exam-docx] parse failed, caller may fallback", e);
    }
    return {
      children: [],
      stats: {
        tablesDetected: 0,
        tableRowCounts: [],
        parseOk: false,
        usedFallback: true,
      },
    };
  }
}
