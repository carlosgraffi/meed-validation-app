import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { signOut } from "next-auth/react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { loadCities } from "@/lib/fixtures";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/utils";
import { SignOutLink } from "./SignOutLink";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/");
  if (session.user.isAdmin) redirect("/admin");

  const expert = await prisma.expert.findUnique({
    where: { id: session.user.id },
    include: {
      assignments: true,
      evaluations: true,
    },
  });
  if (!expert) redirect("/");
  if (!expert.consentedAt) redirect("/onboarding");

  const allCities = loadCities();
  const cityMap = new Map(allCities.map((c) => [c.cityId, c]));

  const rows = expert.assignments
    .map((a) => {
      const c = cityMap.get(a.cityId);
      if (!c) return null;
      const ev = expert.evaluations.find((e) => e.cityId === a.cityId);
      const status: "not_started" | "in_progress" | "completed" = ev
        ? ev.submittedAt
          ? "completed"
          : "in_progress"
        : "not_started";
      return {
        cityId: c.cityId,
        displayName: c.displayName,
        region: c.region,
        dominantSector: dominantSectorOf(c.sectorEmissions),
        status,
      };
    })
    .filter(Boolean) as Array<{
    cityId: string;
    displayName: string;
    region: string;
    dominantSector: string;
    status: "not_started" | "in_progress" | "completed";
  }>;

  const done = rows.filter((r) => r.status === "completed").length;
  const total = rows.length;
  const remaining = total - done;

  // Spec: redirect to /complete after expert's last assigned city is submitted
  if (total > 0 && remaining === 0) {
    if (!expert.completedAt) {
      await prisma.expert.update({
        where: { id: expert.id },
        data: { completedAt: new Date() },
      });
    }
    redirect("/complete");
  }

  return (
    <main className="min-h-screen p-6 max-w-4xl mx-auto space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">
            {t("dashboard.greeting", { name: firstName(expert.fullName) })}
          </h1>
          <p className="text-muted-foreground mt-1">{t("dashboard.subtitle")}</p>
        </div>
        <SignOutLink />
      </header>

      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">
          {t("dashboard.progress", { done: done, total: total })}
        </p>
        {remaining > 0 && (
          <p className="text-xs text-muted-foreground">
            {t("dashboard.totalRemaining", { minutes: remaining * 10 })}
          </p>
        )}
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">{t("dashboard.noAssignments")}</p>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {rows.map((r) => (
            <li key={r.cityId}>
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle>{r.displayName}</CardTitle>
                      <CardDescription className="mt-1">{r.region}</CardDescription>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="muted">{t(`sectors.${r.dominantSector}` as never)}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {t("dashboard.estimatedTime")}
                    </span>
                  </div>
                  <Button asChild size="sm">
                    <Link href={`/evaluate/${r.cityId}`}>{actionLabel(r.status)}</Link>
                  </Button>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function firstName(full: string): string {
  return full.split(" ")[0] ?? full;
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

function StatusBadge({ status }: { status: "not_started" | "in_progress" | "completed" }) {
  if (status === "completed") return <Badge variant="default">{t("dashboard.statusCompleted")}</Badge>;
  if (status === "in_progress") return <Badge variant="accent">{t("dashboard.statusInProgress")}</Badge>;
  return <Badge variant="outline">{t("dashboard.statusNotStarted")}</Badge>;
}

function actionLabel(status: "not_started" | "in_progress" | "completed"): string {
  if (status === "completed") return t("dashboard.buttonReview");
  if (status === "in_progress") return t("dashboard.buttonContinue");
  return t("dashboard.buttonStart");
}
