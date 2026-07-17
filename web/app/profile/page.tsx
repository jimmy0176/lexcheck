import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { ProfileForm } from "./ProfileForm";

export default async function ProfilePage() {
  const user = await getSessionUser();
  if (!user) redirect("/?next=%2Fprofile");

  return (
    <main className="min-h-dvh bg-background">
      <div className="mx-auto w-full max-w-lg px-6 py-16">
        <h1 className="text-2xl font-semibold tracking-tight">个人资料</h1>
        <div className="mt-6">
          <ProfileForm
            initialName={user.name ?? ""}
            role={user.role}
            companyName={user.companyName}
            phone={user.phone}
            email={user.email}
            hasPassword={Boolean(user.passwordHash)}
          />
        </div>
      </div>
    </main>
  );
}
