"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SignOutLink } from "../dashboard/SignOutLink";
import { ReassignDialog } from "./ReassignDialog";
import { MetricsPreview } from "./MetricsPreview";
import { MagicLinks } from "./MagicLinks";

export type CityRow = {
  cityId: string;
  displayName: string;
  assigned: number;
  started: number;
  completed: number;
};
export type ExpertRow = {
  expertId: string;
  fullName: string;
  email: string;
  sectorSpecialization: string | null;
  consentedAt: string | null;
  assigned: number;
  started: number;
  completed: number;
  preferredCityIds: string | null;
  lastActivityAt: string | null;
};
export type MagicLinkRow = {
  tokenId: string;
  expertId: string;
  expertName: string;
  expertEmail: string;
  url: string;
  expiresAt: string;
  createdAt: string;
};

export function AdminDashboard({
  cityRows,
  expertRows,
  magicLinks,
  cities,
}: {
  cityRows: CityRow[];
  expertRows: ExpertRow[];
  magicLinks: MagicLinkRow[];
  cities: { cityId: string; displayName: string }[];
}) {
  const router = useRouter();
  const [stratConfirm, setStratConfirm] = useState(false);
  const [stratifying, setStratifying] = useState(false);
  const [stratError, setStratError] = useState<string | null>(null);

  const runStratification = async () => {
    setStratifying(true);
    setStratError(null);
    const res = await fetch("/api/admin/stratify", { method: "POST" });
    setStratifying(false);
    setStratConfirm(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setStratError(data.error ?? "Stratification failed.");
      return;
    }
    router.refresh();
  };

  const downloadExport = async () => {
    window.location.href = "/api/admin/export";
  };

  return (
    <main className="min-h-screen p-6 max-w-6xl mx-auto space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold">MEED+ — Admin</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Coverage, expert progress, manual reassignment, and live metric preview.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={downloadExport}>
            Download all data as JSON
          </Button>
          <SignOutLink />
        </div>
      </header>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Stratification</CardTitle>
              <CardDescription>
                Run the deterministic algorithm to (re)assign cities to experts. Skips experts
                whose evaluations have already started.
              </CardDescription>
            </div>
            <Button
              variant={stratConfirm ? "destructive" : "default"}
              onClick={() => (stratConfirm ? runStratification() : setStratConfirm(true))}
              disabled={stratifying}
            >
              {stratifying
                ? "Running…"
                : stratConfirm
                ? "Confirm: run stratification"
                : "Run stratification"}
            </Button>
            {stratConfirm && (
              <Button variant="ghost" size="sm" onClick={() => setStratConfirm(false)}>
                Cancel
              </Button>
            )}
          </div>
        </CardHeader>
        {stratError && (
          <CardContent>
            <p className="text-sm text-destructive">{stratError}</p>
          </CardContent>
        )}
      </Card>

      <MetricsPreview />

      <Card>
        <CardHeader>
          <CardTitle>City coverage</CardTitle>
          <CardDescription>
            Cities below 5 completed evaluations are highlighted in red. Target is 5–6 per city.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b">
                <th className="py-2 pr-4">City</th>
                <th className="py-2 pr-4">Assigned</th>
                <th className="py-2 pr-4">Started</th>
                <th className="py-2 pr-4">Completed</th>
              </tr>
            </thead>
            <tbody>
              {cityRows.map((c) => (
                <tr key={c.cityId} className="border-b last:border-b-0">
                  <td className="py-2 pr-4 font-medium">{c.displayName}</td>
                  <td className="py-2 pr-4">{c.assigned}</td>
                  <td className="py-2 pr-4">{c.started}</td>
                  <td
                    className={
                      c.completed < 5 ? "py-2 pr-4 text-destructive font-semibold" : "py-2 pr-4"
                    }
                  >
                    {c.completed}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Expert progress</CardTitle>
              <CardDescription>13 experts × cities assigned / started / completed. Last activity per expert.</CardDescription>
            </div>
            <ReassignDialog cities={cities} experts={expertRows} />
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b">
                <th className="py-2 pr-4">Expert</th>
                <th className="py-2 pr-4">Email</th>
                <th className="py-2 pr-4">Sector</th>
                <th className="py-2 pr-4">Consent</th>
                <th className="py-2 pr-4">Assigned</th>
                <th className="py-2 pr-4">Started</th>
                <th className="py-2 pr-4">Completed</th>
                <th className="py-2 pr-4">Last activity</th>
              </tr>
            </thead>
            <tbody>
              {expertRows.map((e) => (
                <tr key={e.expertId} className="border-b last:border-b-0">
                  <td className="py-2 pr-4 font-medium">{e.fullName}</td>
                  <td className="py-2 pr-4 text-muted-foreground">{e.email}</td>
                  <td className="py-2 pr-4">{e.sectorSpecialization ?? "—"}</td>
                  <td className="py-2 pr-4">
                    {e.consentedAt ? (
                      <Badge variant="default">yes</Badge>
                    ) : (
                      <Badge variant="muted">no</Badge>
                    )}
                  </td>
                  <td className="py-2 pr-4">{e.assigned}</td>
                  <td className="py-2 pr-4">{e.started}</td>
                  <td className="py-2 pr-4">{e.completed}</td>
                  <td className="py-2 pr-4 text-xs text-muted-foreground">
                    {e.lastActivityAt ? new Date(e.lastActivityAt).toLocaleString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <MagicLinks initial={magicLinks} experts={expertRows} />
    </main>
  );
}
