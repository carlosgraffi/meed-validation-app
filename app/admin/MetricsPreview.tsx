"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { MetricsOutput } from "@/lib/metrics";

export function MetricsPreview() {
  const [metrics, setMetrics] = useState<MetricsOutput | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/metric-preview", { cache: "no-store" });
    setLoading(false);
    if (!res.ok) return;
    setMetrics(await res.json());
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Live metric preview</CardTitle>
            <CardDescription>
              Top 3 / top 10 match rate across submitted evaluations. Click to compute.
            </CardDescription>
          </div>
          <Button variant="outline" onClick={refresh} disabled={loading}>
            {loading ? "Computing…" : "Compute headline metric"}
          </Button>
        </div>
      </CardHeader>
      {metrics && (
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Stat label="Overall Precision@3" value={pct(metrics.overall.top3MatchRate)} highlight />
            <Stat label="Overall Precision@10" value={pct(metrics.overall.top10MatchRate)} highlight />
            <Stat
              label="Cities passing P@3 (≥75%)"
              value={`${metrics.overall.citiesPassingTop3} / ${metrics.overall.citiesEvaluated}`}
            />
            <Stat
              label="Cities passing P@10 (≥75%)"
              value={`${metrics.overall.citiesPassingTop10} / ${metrics.overall.citiesEvaluated}`}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Precision@3 is the contract bar. Precision@10 is more statistically stable
            (per-city numbers are built from ~50 ratings vs ~15 for top-3) and reads
            the model better when interpreted alongside top-3. Both are collected
            BLIND — experts have not yet seen the model's rank order or rationale.
          </p>

          {/* Post-reveal "informed agreement" — captured AFTER the expert
              has seen the model's ranking + LLM rationale on the reveal
              stages. Reads on the same agreement axis (≥4 of 5) as P@N. */}
          <div className="mt-6">
            <h4 className="text-sm font-semibold mb-2">Post-reveal informed agreement</h4>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Stat
                label="Top-3 ranking agreement (mean Likert)"
                value={mean5(metrics.overall.top3AgreementMean)}
              />
              <Stat
                label="Top-3 agreement rate (≥4)"
                value={pct(metrics.overall.top3AgreementRate)}
              />
              <Stat
                label="Top-10 ranking agreement (mean Likert)"
                value={mean5(metrics.overall.top10AgreementMean)}
              />
              <Stat
                label="Top-10 agreement rate (≥4)"
                value={pct(metrics.overall.top10AgreementRate)}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Collected on Reveal-1 / Reveal-2, AFTER the binary P@3 / P@10
              ratings. Compare against P@N to see how much the model's reasoning
              moved expert agreement.
            </p>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b">
                  <th className="py-2 pr-4">City</th>
                  <th className="py-2 pr-4">Experts</th>
                  <th className="py-2 pr-4">P@3</th>
                  <th className="py-2 pr-4">P@10</th>
                  <th className="py-2 pr-4">Spearman top-5</th>
                  <th className="py-2 pr-4">Top-3 agree</th>
                  <th className="py-2 pr-4">Top-10 agree</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(metrics.perCity).map(([cityId, m]) => (
                  <tr key={cityId} className="border-b last:border-b-0">
                    <td className="py-2 pr-4 font-mono text-xs">{cityId}</td>
                    <td className="py-2 pr-4">{m.expertsCompleted}</td>
                    <td
                      className={
                        m.top3MatchRate != null && m.top3MatchRate >= 0.75
                          ? "py-2 pr-4 font-medium text-primary"
                          : "py-2 pr-4 font-medium text-destructive"
                      }
                    >
                      {pct(m.top3MatchRate)}
                    </td>
                    <td
                      className={
                        m.top10MatchRate != null && m.top10MatchRate >= 0.75
                          ? "py-2 pr-4 font-medium text-primary"
                          : "py-2 pr-4 font-medium text-destructive"
                      }
                    >
                      {pct(m.top10MatchRate)}
                    </td>
                    <td className="py-2 pr-4">{m.spearmanTop5 != null ? m.spearmanTop5.toFixed(2) : "—"}</td>
                    <td className="py-2 pr-4 text-xs">
                      {mean5(m.top3AgreementMean)}{" "}
                      <span className="text-muted-foreground">({pct(m.top3AgreementRate)})</span>
                    </td>
                    <td className="py-2 pr-4 text-xs">
                      {mean5(m.top10AgreementMean)}{" "}
                      <span className="text-muted-foreground">({pct(m.top10AgreementRate)})</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-xl font-semibold mt-1 ${highlight ? "text-primary" : ""}`}>{value}</div>
    </div>
  );
}

function pct(v: number | null): string {
  if (v == null) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

/** Format a 1..5 Likert mean as "x.xx / 5". */
function mean5(v: number | null): string {
  if (v == null) return "—";
  return `${v.toFixed(2)} / 5`;
}
