import { NextResponse } from "next/server";
import {
  normalizeProgress,
  normalizeWorkspaceInput,
  REPORT_SECTIONS,
} from "@/lib/checkup-workflow";
import { DD_REPORT_SECTIONS } from "@/lib/dd-report-toc";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  try {
    const { prisma } = await import("@/lib/prisma");
    const checkup = await prisma.checkup.findUnique({
      where: { token },
      include: {
        attachments: {
          where: { kind: "detailed" },
          orderBy: { createdAt: "desc" },
        },
        workspace: {
          include: {
            sectionDrafts: { orderBy: { updatedAt: "desc" } },
            finalReport: true,
          },
        },
      },
    });
    if (!checkup) return NextResponse.json({ error: "not_found" }, { status: 404 });

    let workspace = checkup.workspace;
    if (!workspace) {
      workspace = await prisma.checkupWorkspace.create({
        data: { checkupId: checkup.id, progressJson: {} },
        include: {
          sectionDrafts: { orderBy: { updatedAt: "desc" } },
          finalReport: true,
        },
      });
    }

    return NextResponse.json({
      token: checkup.token,
      companyName: checkup.companyName,
      status: checkup.status,
      savedAt: checkup.savedAt,
      submittedAt: checkup.submittedAt,
      attachments: checkup.attachments.map((a) => ({
        id: a.id,
        fileName: a.fileName,
        extractedChars: (a.extractedText ?? "").trim().length,
        extractError: a.extractError ?? null,
        createdAt: a.createdAt,
      })),
      workspace: {
        id: workspace.id,
        projectStatus: workspace.projectStatus,
        ownerName: workspace.ownerName ?? "",
        promptTemplate: workspace.promptTemplate ?? "",
        reportTemplate: workspace.reportTemplate ?? "",
        progress: normalizeProgress(workspace.progressJson),
      },
      sectionTemplates: REPORT_SECTIONS,
      ddReportSections: DD_REPORT_SECTIONS,
      sectionDrafts: workspace.sectionDrafts.map((d) => ({
        id: d.id,
        sectionKey: d.sectionKey,
        sectionName: d.sectionName,
        draftText: d.draftText,
        reviewedText: d.reviewedText ?? "",
        included: d.included,
        updatedAt: d.updatedAt,
      })),
      finalReport: workspace.finalReport
        ? {
            id: workspace.finalReport.id,
            reportText: workspace.finalReport.reportText,
            notesText: workspace.finalReport.notesText ?? "",
            updatedAt: workspace.finalReport.updatedAt,
          }
        : null,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "server_error", message: String(e) },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  try {
    const body = (await req.json()) as {
      projectStatus?: string;
      ownerName?: string;
      promptTemplate?: string;
      reportTemplate?: string;
      progress?: Record<string, boolean>;
    };
    const { prisma } = await import("@/lib/prisma");
    const checkup = await prisma.checkup.findUnique({
      where: { token },
      include: { workspace: true },
    });
    if (!checkup) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const normalized = normalizeWorkspaceInput({
      projectStatus: body.projectStatus ?? checkup.workspace?.projectStatus ?? "待处理",
      ownerName: body.ownerName ?? checkup.workspace?.ownerName ?? "",
      promptTemplate: body.promptTemplate ?? checkup.workspace?.promptTemplate ?? "",
      reportTemplate: body.reportTemplate ?? checkup.workspace?.reportTemplate ?? "",
      progress:
        body.progress ??
        (checkup.workspace?.progressJson as Record<string, boolean> | undefined),
    });

    const workspace = await prisma.checkupWorkspace.upsert({
      where: { checkupId: checkup.id },
      create: {
        checkupId: checkup.id,
        projectStatus: normalized.projectStatus,
        ownerName: normalized.ownerName || null,
        promptTemplate: normalized.promptTemplate || null,
        reportTemplate: normalized.reportTemplate || null,
        progressJson: normalized.progress,
      },
      update: {
        projectStatus: normalized.projectStatus,
        ownerName: normalized.ownerName || null,
        promptTemplate: normalized.promptTemplate || null,
        reportTemplate: normalized.reportTemplate || null,
        progressJson: normalized.progress,
      },
    });

    return NextResponse.json({
      ok: true,
      workspace: {
        id: workspace.id,
        projectStatus: workspace.projectStatus,
        ownerName: workspace.ownerName ?? "",
        promptTemplate: workspace.promptTemplate ?? "",
        reportTemplate: workspace.reportTemplate ?? "",
        progress: normalizeProgress(workspace.progressJson),
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: "server_error", message: String(e) },
      { status: 500 }
    );
  }
}
