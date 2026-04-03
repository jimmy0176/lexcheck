import { QuestionnaireClient } from "./QuestionnaireClient";

export default async function QuestionnairePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <QuestionnaireClient token={token} />;
}

