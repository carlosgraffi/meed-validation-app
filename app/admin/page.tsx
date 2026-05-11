import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { loadCities, loadExperts } from "@/lib/fixtures";
import { AdminDashboard } from "./AdminDashboard";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.isAdmin) redirect("/");

  const cities = loadCities();
  const fixtureExperts = loadExperts();
  const experts = await prisma.expert.findMany({
    where: { id: { in: fixtureExperts.map((e) => e.expertId) } },
    include: { assignments: true, evaluations: true },
    orderBy: { id: "asc" },
  });

  const cityRows = cities.map((c) => {
    const assigned = experts.filter((e) => e.assignments.some((a) => a.cityId === c.cityId));
    const started = experts.filter((e) =>
      e.evaluations.some((ev) => ev.cityId === c.cityId)
    );
    const completed = experts.filter((e) =>
      e.evaluations.some((ev) => ev.cityId === c.cityId && ev.submittedAt)
    );
    return {
      cityId: c.cityId,
      displayName: c.displayName,
      assigned: assigned.length,
      started: started.length,
      completed: completed.length,
    };
  });

  const expertRows = experts.map((e) => {
    const lastEvalDate = e.evaluations
      .map((ev) => ev.submittedAt ?? ev.startedAt)
      .filter(Boolean)
      .map((d) => (d as Date).getTime())
      .sort((a, b) => b - a)[0];
    return {
      expertId: e.id,
      fullName: e.fullName,
      email: e.email,
      sectorSpecialization: e.sectorSpecialization,
      consentedAt: e.consentedAt?.toISOString() ?? null,
      assigned: e.assignments.length,
      started: e.evaluations.length,
      completed: e.evaluations.filter((ev) => ev.submittedAt).length,
      preferredCityIds: e.preferredCityIds,
      lastActivityAt: lastEvalDate ? new Date(lastEvalDate).toISOString() : null,
    };
  });

  // Active magic tokens — for the copy-paste sender list
  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
  const baseUrl = process.env.NEXTAUTH_URL ?? "";

  const activeTokens = await prisma.magicToken.findMany({
    where: { usedAt: null, expiresAt: { gt: new Date() } },
    include: { expert: true },
    orderBy: { createdAt: "desc" },
  });
  const magicLinks = activeTokens
    .filter((t) => t.expert.email.toLowerCase() !== adminEmail)
    .map((t) => ({
      tokenId: t.id,
      expertId: t.expertId,
      expertName: t.expert.fullName,
      expertEmail: t.expert.email,
      url: `${baseUrl}/auth/magic/${t.token}`,
      expiresAt: t.expiresAt.toISOString(),
      createdAt: t.createdAt.toISOString(),
    }));

  return (
    <AdminDashboard
      cityRows={cityRows}
      expertRows={expertRows}
      magicLinks={magicLinks}
      cities={cities.map((c) => ({ cityId: c.cityId, displayName: c.displayName }))}
    />
  );
}
