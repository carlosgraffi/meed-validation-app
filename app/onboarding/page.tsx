import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { OnboardingForm } from "./OnboardingForm";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/");
  if (session.user.isAdmin) redirect("/admin");

  const expert = await prisma.expert.findUnique({ where: { id: session.user.id } });
  if (!expert) redirect("/");
  if (expert.consentedAt) redirect("/dashboard");

  // The onboarding form no longer asks for city preferences (we only have 3
  // cities and every expert evaluates all of them), so the cities fixture
  // isn't loaded here anymore.
  return (
    <OnboardingForm
      expert={{
        id: expert.id,
        email: expert.email,
        fullName: expert.fullName,
        sectorSpecialization: expert.sectorSpecialization,
      }}
    />
  );
}
