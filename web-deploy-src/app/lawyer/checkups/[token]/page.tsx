import Link from "next/link";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import type { Answers, QuestionnaireConfig } from "@/lib/questionnaire-types";
import { AnswerSectionsClient } from "./AnswerSectionsClient";
import { LawyerAiPanel } from "./LawyerAiPanel";

type CheckupDetail = {
  id: string;
  token: string;
  companyName: string | null;
  status: "draft" | "submitted";
  savedAt: Date;
  submittedAt: Date | null;
  answersJson: unknown;
};

async function readQuestionnaireConfig() {
  const filePath = path.join(process.cwd(), "public", "questionnaire.json");
  const raw = await readFile(filePath, "utf-8");
  return JSON.parse(raw) as QuestionnaireConfig;
}

export default async function LawyerCheckupDetailPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  let checkup: CheckupDetail | null = null;
  let config: QuestionnaireConfig | null = null;
  try {
    const { prisma } = await import("@/lib/prisma");
    checkup = await prisma.checkup.findUnique({ where: { token } });
    config = await readQuestionnaireConfig();
  } catch {
    return (
      <main className="min-h-dvh bg-background">
        <div className="mx-auto w-full max-w-6xl px-6 py-10">
          <div className="text-sm text-muted-foreground">律师端 / 体检单详情</div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">数据库暂不可用</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            请先启动 PostgreSQL 并执行 Prisma 迁移。
          </p>
        </div>
      </main>
    );
  }
  if (!checkup) notFound();
  if (!config) notFound();

  const answers = (checkup.answersJson ?? {}) as Answers;

  return (
    <main className="min-h-dvh bg-background">
      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        <div className="mb-4">
          <Link
            href="/lawyer/checkups"
            className="text-sm text-primary underline underline-offset-4"
          >
            返回体检单列表
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-sm text-muted-foreground">律师端 / 体检单详情</div>
          <Badge variant={checkup.status === "submitted" ? "default" : "secondary"}>
            {checkup.status === "submitted" ? "已提交" : "草稿"}
          </Badge>
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          公司名称：{checkup.companyName?.trim() ? checkup.companyName : "未填写公司名称"}
        </h1>
        <div className="mt-2 text-sm text-muted-foreground">token: {checkup.token}</div>
        <div className="mt-2 text-sm text-muted-foreground">
          保存时间：{checkup.savedAt.toLocaleString()}{" "}
          {checkup.submittedAt ? `· 提交时间：${checkup.submittedAt.toLocaleString()}` : ""}
        </div>

        <AnswerSectionsClient sections={config.sections} answers={answers} />

        <LawyerAiPanel token={checkup.token} />
      </div>
    </main>
  );
}

