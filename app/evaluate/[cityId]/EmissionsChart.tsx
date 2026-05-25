"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { formatEmissions } from "@/lib/utils";
import { useT, useLang } from "@/app/LangProvider";

const PALETTE = ["#0f766e", "#0e7490", "#65a30d", "#a16207", "#7c3aed"];
// Distinct hue for sequestration (negative-value) sectors — slightly muted
// emerald so it reads as "carbon sink" rather than "another emission source".
const SINK_COLOR = "#10b981";

export function EmissionsChart({
  sectors,
}: {
  sectors: { key: string; label: string; value: number | null }[];
}) {
  const t = useT();
  const [lang] = useLang();
  // Use the sum of ABSOLUTE values as the denominator so the chart still
  // renders for net-sink cities (Paillaco, Lago Ranco) where the signed
  // total is negative or near zero. For balanced positive-only inventories
  // this collapses to the same value as `sum(sectors)`, so no regression.
  const absSum = sectors.reduce(
    (acc, s) => acc + (typeof s.value === "number" ? Math.abs(s.value) : 0),
    0
  );
  const knownSectors = sectors.filter((s) => typeof s.value === "number");
  const nullSectors = sectors.filter((s) => s.value == null);

  const data = knownSectors.map((s) => {
    const value = s.value as number;
    const isSink = value < 0;
    return {
      name: isSink ? `${s.label} (${lang === "en" ? "sink" : "sumidero"})` : s.label,
      value,
      pct: absSum > 0 ? (Math.abs(value) / absSum) * 100 : 0,
      isSink,
    };
  });

  return (
    <div className="space-y-3">
      <div style={{ width: "100%", height: 60 + data.length * 34 }}>
        <ResponsiveContainer>
          <BarChart layout="vertical" data={data} margin={{ left: 8, right: 24 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
            <XAxis type="number" tickFormatter={(v) => `${v.toFixed(0)}%`} fontSize={11} stroke="hsl(var(--muted-foreground))" />
            <YAxis type="category" dataKey="name" width={120} fontSize={12} stroke="hsl(var(--foreground))" interval={0} />
            <Tooltip
              cursor={{ fill: "hsl(var(--muted))" }}
              formatter={(_v, _n, item) => {
                const p = item?.payload as { value: number; pct: number } | undefined;
                if (!p) return "";
                return [
                  `${formatEmissions(p.value)} CO₂eq (${p.pct.toFixed(1)}%)`,
                  "",
                ];
              }}
              contentStyle={{
                borderRadius: 6,
                border: "1px solid hsl(var(--border))",
                background: "hsl(var(--card))",
                fontSize: 12,
              }}
            />
            <Bar dataKey="pct" radius={[0, 4, 4, 0]}>
              {data.map((d, i) => (
                <Cell key={i} fill={d.isSink ? SINK_COLOR : PALETTE[i % PALETTE.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {nullSectors.length > 0 && (
        <ul className="text-xs text-muted-foreground space-y-1">
          {nullSectors.map((s) => (
            <li key={s.key}>
              · {s.label}: {t("evaluate.emissionsNullSector")}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
