import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { loadCities } from "@/lib/fixtures";
import { OnboardingForm } from "./OnboardingForm";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/");
  if (session.user.isAdmin) redirect("/admin");

  const expert = await prisma.expert.findUnique({ where: { id: session.user.id } });
  if (!expert) redirect("/");
  if (expert.consentedAt) redirect("/dashboard");

  const cities = loadCities().map((c) => ({
    cityId: c.cityId,
    displayName: c.displayName,
    displayNameEn: c.displayNameEn,
    region: c.region,
    regionEn: c.regionEn,
    dominantSector: dominantSectorOf(c.sectorEmissions),
  }));

  return (
    <OnboardingForm
      expert={{
        id: expert.id,
        email: expert.email,
        fullName: expert.fullName,
        sectorSpecialization: expert.sectorSpecialization,
      }}
      cities={cities}
    />
  );
}

function dominantSectorOf(s: {
  stationaryEnergy: number;
  transportation: number;
  waste: number;
  ippu: number | null;
  afolu: number | null;
}): string {
  const entries: [string, number][] = [
    ["stationaryEnergy", s.stationaryEnergy],
    ["transportation", s.transportation],
    ["waste", s.waste],
  ];
  if (s.ippu != null) entries.push(["ippu", s.ippu]);
  if (s.afolu != null) entries.push(["afolu", s.afolu]);
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}
