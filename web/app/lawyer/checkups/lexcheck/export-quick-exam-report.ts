"use client";

import { markdownToDocxChildren } from "@/lib/quick-exam-markdown-docx";

function triggerDownload(blob: Blob, filename: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function safeBaseName(raw: string) {
  const t = raw.trim().replace(/[/\\?%*:|"<>]/g, "_").slice(0, 80);
  return t || "快速体检报告";
}

export function downloadQuickExamMarkdown(text: string, baseName: string) {
  const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
  triggerDownload(blob, `${safeBaseName(baseName)}.md`);
}

export async function downloadQuickExamDocx(text: string, baseName: string) {
  const { Document, Packer, Paragraph, TextRun } = await import("docx");
  const { children, stats } = markdownToDocxChildren(text);
  const useChildren =
    stats.parseOk && children.length > 0
      ? children
      : text.split(/\n/).map(
          (line) =>
            new Paragraph({
              children: [new TextRun({ text: line.length > 0 ? line : " " })],
            })
        );
  if (stats.usedFallback || !stats.parseOk) {
    if (process.env.NODE_ENV === "development") {
      console.info("[quick-exam-docx] fallback to line paragraphs", stats);
    }
  }
  const doc = new Document({
    sections: [
      {
        children: useChildren,
      },
    ],
  });
  const blob = await Packer.toBlob(doc);
  triggerDownload(blob, `${safeBaseName(baseName)}.docx`);
}

/** 将报告区域截图为多页 PDF（支持中文显示） */
export async function downloadQuickExamPdf(
  element: HTMLElement | null,
  baseName: string
) {
  if (!element) throw new Error("无可导出的内容");
  const html2canvas = (await import("html2canvas")).default;
  const { jsPDF } = await import("jspdf");
  const canvas = await html2canvas(element, {
    scale: 1.25,
    useCORS: true,
    logging: false,
    width: element.scrollWidth,
    height: element.scrollHeight,
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
  });
  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "p" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const imgW = pageW;
  const imgH = (canvas.height * imgW) / canvas.width;
  let heightLeft = imgH;
  let position = 0;
  pdf.addImage(imgData, "PNG", 0, position, imgW, imgH);
  heightLeft -= pageH;
  while (heightLeft >= 0) {
    position = heightLeft - imgH;
    pdf.addPage();
    pdf.addImage(imgData, "PNG", 0, position, imgW, imgH);
    heightLeft -= pageH;
  }
  pdf.save(`${safeBaseName(baseName)}.pdf`);
}
