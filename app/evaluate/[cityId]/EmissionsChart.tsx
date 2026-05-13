"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { formatEmissions } from "@/lib/utils";
import { useT } from "@/app/LangProvider";

const PALETTE = ["#0f766e", "#0e7490", "#65a30d", "#a16207", "#7c3aed"];

export function EmissionsChart({
  sectors,
}: {
  sectors: { key: string; label: string; value: number | null }[];
}) {
  const t = useT();
  const total = sectors.reduce(
    (acc, s) => acc + (typeof s.value === "number" ? s.value : 0),
    0
  );
  const knownSectors = sectors.filter((s) => typeof s.value === "number");
  const nullSectors = sectors.filter((s) => s.value == null);

  const data = knownSectors.map((s) => ({
    name: s.label,
    value: s.value as number,
    pct: total > 0 ? ((s.value as number) / total) * 100 : 0,
  }));

  return (
    <div className="space-y-3">
      <div style={{ width: "100%", height: 60 + data.length * 28 }}>
        <ResponsiveContainer>
          <BarChart layout="vertical" data={data} margin={{ left: 8, right: 24 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
            <XAxis type="number" tickFormatter={(v) => `${v.toFixed(0)}%`} fontSize={11} stroke="hsl(var(--muted-foreground))" />
            <YAxis type="category" dataKey="name" width={140} fontSize={12} stroke="hsl(var(--foreground))" />
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
              {data.map((_, i) => (
                <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
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
