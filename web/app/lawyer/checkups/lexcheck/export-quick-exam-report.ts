"use client";

import { buildReportDocxDocument } from "@/lib/report-docx";

function triggerDownload(blob: Blob, filename: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function safeBaseName(raw: string) {
  const t = raw.trim().replace(/[/\\?%*:|"<>]/g, "_").slice(0, 80);
  return t || "体检报告";
}

function timeSuffix(d: Date) {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `_${mm}-${dd}_${hh}-${min}`;
}

export function downloadQuickExamMarkdown(text: string, baseName: string) {
  const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
  triggerDownload(blob, `${safeBaseName(baseName)}.md`);
}

export async function downloadQuickExamDocx(text: string, baseName: string, generatedAt: Date = new Date()) {
  const { Packer } = await import("docx");
  const doc = await buildReportDocxDocument(text);
  const blob = await Packer.toBlob(doc);
  triggerDownload(blob, `${safeBaseName(baseName)}${timeSuffix(generatedAt)}.docx`);
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
