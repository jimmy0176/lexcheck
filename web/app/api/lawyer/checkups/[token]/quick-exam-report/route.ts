import { NextResponse } from "next/server";
import {
  createAsyncQuickExamJob,
  runQuickExamSync,
  shouldUseSyncPipeline,
  stepQuickExamJob,
  type QuickExamMeta,
  type QuickExamProgressJson,
  type QuickExamRunStats,
} from "@/lib/quick-exam-pipeline";
import { loadPreliminaryAttachmentBodies } from "@/lib/quick-exam-preliminary";
import { getProviderById } from "@/lib/llm-providers";

export const runtime = "nodejs";
/** Vercel 等平台上的路由最长执行时间；自建 Node 仍需调大 Nginx/网关超时。 */
export const maxDuration = 300;

function normalizeBase(url: string) {
  return url.trim().replace(/\/+$/, "");
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  try {
    const body = (await req.json()) as {
      jobId?: string;
      /** 兼容旧字段 */
      prompt?: string;
      outputFull?: string;
      promptMd?: string;
      outputMd?: string;
      providerId?: string;
      model?: string;
      apiKey?: string;
      baseUrlOverride?: string;
    };
    const promptMd = (body.promptMd ?? body.prompt ?? "").trim();
    const outputMd = (body.outputMd ?? body.outputFull ?? "").trim();
    const providerId = (body.providerId ?? "").trim();
    const model = (body.model ?? "").trim();
    const apiKey = (body.apiKey ?? "").trim();
    const baseUrlOverride = (body.baseUrlOverride ?? "").trim();
    const jobId = (body.jobId ?? "").trim();

    const provider = getProviderById(providerId);
    const base = normalizeBase(baseUrlOverride || provider?.baseUrl || "");
    if (!base) {
      return NextResponse.json(
        { error: "bad_request", message: "未配置可用 Base URL，请先在大模型设置中保存" },
        { status: 400 }
      );
    }
    if (!model) {
      return NextResponse.json(
        { error: "bad_request", message: "未配置模型名称，请先在大模型设置中保存" },
        { status: 400 }
      );
    }
    if (!apiKey) {
      return NextResponse.json(
        { error: "bad_request", message: "未配置 API Key，请先在大模型设置中保存" },
        { status: 400 }
      );
    }
    if (providerId === "custom" && !baseUrlOverride.trim()) {
      return NextResponse.json(
        { error: "bad_request", message: "当前供应商为自定义，请先填写并保存 Base URL" },
        { status: 400 }
      );
    }

    const { prisma } = await import("@/lib/prisma");
    const checkup = await prisma.checkup.findUnique({ where: { token } });
    if (!checkup) return NextResponse.json({ error: "not_found" }, { status: 404 });

    if (jobId) {
      const step = await stepQuickExamJob({
        prisma,
        token,
        jobId,
        promptMd,
        outputMd,
        base,
        apiKey,
        model,
        providerId,
      });
      const payload: {
        ok: boolean;
        async: true;
        done: boolean;
        jobId: string;
        reportText?: string;
        progress?: QuickExamProgressJson;
        error?: string;
        status: string;
        runStats: QuickExamRunStats;
      } = {
        ok: true,
        async: true,
        done: step.done,
        jobId,
        progress: step.progress,
        status: step.status,
        runStats: step.runStats,
      };
      if (step.reportText) payload.reportText = step.reportText;
      if (step.error) payload.error = step.error;
      return NextResponse.json(payload);
    }

    const preliminaryAtts = await prisma.checkupAttachment.findMany({
      where: { checkupId: checkup.id, kind: "preliminary" },
      orderBy: { createdAt: "asc" },
      select: { fileName: true, storagePath: true },
    });
    const files = await loadPreliminaryAttachmentBodies(preliminaryAtts);

    if (shouldUseSyncPipeline(files)) {
      const { reportText, meta, runStats } = await runQuickExamSync({
        prisma,
        token,
        promptMd,
        outputMd,
        base,
        apiKey,
        model,
      });
      return NextResponse.json({
        ok: true,
        async: false,
        reportText,
        meta,
        runStats,
      });
    }

    const { jobId: newJobId, progress } = await createAsyncQuickExamJob({
      prisma,
      checkupId: checkup.id,
    });

    const first = await stepQuickExamJob({
      prisma,
      token,
      jobId: newJobId,
      promptMd,
      outputMd,
      base,
      apiKey,
      model,
      providerId,
    });

    const resBody: {
      ok: boolean;
      async: true;
      done: boolean;
      jobId: string;
      reportText?: string;
      progress: QuickExamProgressJson;
      error?: string;
      status: string;
      meta: QuickExamMeta;
      runStats: QuickExamRunStats;
    } = {
      ok: true,
      async: true,
      done: first.done,
      jobId: newJobId,
      progress: first.progress,
      status: first.status,
      runStats: first.runStats,
      meta: {
        mode: "async_chunk",
        fileCount: progress.fileCount,
        totalChunks: progress.totalChunks,
        usedChunkPipeline: true,
        files: progress.files,
        preliminaryInputKind: "merged_summaries",
      },
    };
    if (first.reportText) resBody.reportText = first.reportText;
    if (first.error) resBody.error = first.error;
    return NextResponse.json(resBody);
  } catch (e) {
    const msg = String(e);
    if (msg === "Error: not_found") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    if (msg.includes("job_not_found")) {
      return NextResponse.json({ error: "bad_request", message: "任务不存在" }, { status: 400 });
    }
    return NextResponse.json({ error: "server_error", message: msg }, { status: 500 });
  }
}
