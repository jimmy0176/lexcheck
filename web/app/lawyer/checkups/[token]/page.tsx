import { redirect } from "next/navigation";

export default async function LawyerCheckupDetailPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  redirect(`/lawyer/checkups/lexcheck?token=${encodeURIComponent(token)}`);
}

