import { NextResponse } from "next/server";
import { requireLawyerApi } from "@/lib/auth";
import { resolveLlmProfiles } from "@/lib/llm-resolve";

export const runtime = "nodejs";

/** 生成报告时给律师选择用哪个已配置的模型（自用/共用/共用备用），只返回来源和模型名，不暴露 apiKey/baseUrl。 */
export async function GET() {
  const lawyer = await requireLawyerApi();
  if (!lawyer) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const profiles = await resolveLlmProfiles(lawyer.id);
  return NextResponse.json({
    profiles: profiles.map((p) => ({ source: p.source, model: p.model })),
  });
}
