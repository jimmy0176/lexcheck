import path from "node:path";
import { readFile } from "node:fs/promises";
import type { PrismaClient } from "@prisma/client";
import type { QuestionnaireConfig } from "@/lib/questionnaire-types";

const LEGACY_TEMPLATE_NAME = "企业法律顾问体检问卷260628";

async function readLegacyQuestionnaireConfig(): Promise<QuestionnaireConfig> {
  const filePath = path.join(process.cwd(), "public", "questionnaire.json");
  const raw = await readFile(filePath, "utf-8");
  return JSON.parse(raw) as QuestionnaireConfig;
}

/**
 * 幂等初始化：首次调用时把 public/questionnaire.json 建成一个默认模板，
 * 并把历史遗留（templateId 为空）的 Checkup 回填指向它。可在任意请求路径上重复调用。
 */
export async function ensureDefaultQuestionnaireTemplate(prisma: PrismaClient): Promise<void> {
  const count = await prisma.questionnaireTemplate.count();
  if (count > 0) return;

  const legacyConfig = await readLegacyQuestionnaireConfig();
  const template = await prisma.questionnaireTemplate.create({
    data: {
      name: LEGACY_TEMPLATE_NAME,
      content: legacyConfig as unknown as object,
    },
  });
  await prisma.checkup.updateMany({
    where: { templateId: null },
    data: { templateId: template.id },
  });
}

/** 按 Checkup 关联的模板读取其问卷结构；找不到模板时兜底读旧版静态文件（正常情况下不应发生）。 */
export async function readQuestionnaireConfigForCheckup(
  prisma: PrismaClient,
  checkup: { templateId: string | null }
): Promise<QuestionnaireConfig> {
  if (checkup.templateId) {
    const template = await prisma.questionnaireTemplate.findUnique({ where: { id: checkup.templateId } });
    if (template) {
      const config = template.content as unknown as QuestionnaireConfig;
      return { ...config, formKey: template.id };
    }
  }
  return readLegacyQuestionnaireConfig();
}
