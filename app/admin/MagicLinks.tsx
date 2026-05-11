"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { ExpertRow, MagicLinkRow } from "./AdminDashboard";

export function MagicLinks({
  initial,
  experts,
}: {
  initial: MagicLinkRow[];
  experts: ExpertRow[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const generate = async (expertId: string) => {
    setBusy(expertId);
    await fetch("/api/admin/magic-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expertId }),
    });
    setBusy(null);
    router.refresh();
  };

  const generateAll = async () => {
    setBusy("__all__");
    await fetch("/api/admin/magic-link/all", { method: "POST" });
    setBusy(null);
    router.refresh();
  };

  const copy = async (url: string, key: string) => {
    await navigator.clipboard.writeText(url);
    setCopied(key);
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
  };

  const linkByExpert: Record<string, MagicLinkRow | undefined> = {};
  for (const l of initial) linkByExpert[l.expertId] = l;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Magic links (for manual send)</CardTitle>
            <CardDescription>
              Generate a single-use login link per expert. Carlos pastes the URL into the invitation
              email he sends from his own account. Links expire after 7 days by default.
            </CardDescription>
          </div>
          <Button variant="outline" onClick={generateAll} disabled={busy === "__all__"}>
            {busy === "__all__" ? "Generating…" : "Generate links for everyone"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b">
              <th className="py-2 pr-4">Expert</th>
              <th className="py-2 pr-4">Email</th>
              <th className="py-2 pr-4">Link</th>
              <th className="py-2 pr-4">Expires</th>
              <th className="py-2 pr-4"></th>
            </tr>
          </thead>
          <tbody>
            {experts.map((e) => {
              const link = linkByExpert[e.expertId];
              return (
                <tr key={e.expertId} className="border-b last:border-b-0">
                  <td className="py-2 pr-4 font-medium">{e.fullName}</td>
                  <td className="py-2 pr-4 text-muted-foreground">{e.email}</td>
                  <td className="py-2 pr-4">
                    {link ? (
                      <code className="text-xs bg-muted px-2 py-1 rounded break-all max-w-md inline-block">
                        {link.url}
                      </code>
                    ) : (
                      <span className="text-xs text-muted-foreground">— no active link —</span>
                    )}
                  </td>
                  <td className="py-2 pr-4 text-xs text-muted-foreground">
                    {link ? new Date(link.expiresAt).toLocaleString() : "—"}
                  </td>
                  <td className="py-2 pr-4">
                    <div className="flex items-center gap-2">
                      {link && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copy(link.url, e.expertId)}
                        >
                          {copied === e.expertId ? "Copied ✓" : "Copy"}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => generate(e.expertId)}
                        disabled={busy === e.expertId}
                      >
                        {busy === e.expertId ? "…" : link ? "Regenerate" : "Generate"}
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
