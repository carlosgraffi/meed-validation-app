"use client";

import { useState } from "react";
import { Building2, TrendingDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmissionsChart } from "./EmissionsChart";
import { CityContextSheet } from "./CityContextSheet";
import { useT, useLang, useCityText } from "@/app/LangProvider";
import { cn, formatNumber, formatEmissions } from "@/lib/utils";
import type { City, CityIndicator } from "@/lib/fixtures";

/**
 * Desktop sidebar — summarized view of the city context. Pinned to the left
 * column at lg+ breakpoints. Shows:
 *   - City name + region
 *   - Total emissions with a "net sink" callout when negative
 *   - The emissions-by-sector chart
 *   - 4 hand-picked "headline" indicators (income, indigenous, dominant land
 *     use, electricity access) that tell the story of the city at a glance
 *   - A "View full context" button that opens the full <CityContextSheet>
 *
 * Mobile renders <CityContextBanner> instead — same data, vertical layout.
 */
export function CityContextSidebar({ city }: { city: City }) {
  const t = useT();
  const [lang] = useLang();
  const ct = useCityText();
  const [sheetOpen, setSheetOpen] = useState(false);

  const isNetSink = city.totalEmissions < 0;

  const sectors = [
    { key: "stationaryEnergy", value: city.sectorEmissions.stationaryEnergy },
    { key: "transportation", value: city.sectorEmissions.transportation },
    { key: "waste", value: city.sectorEmissions.waste },
    { key: "ippu", value: city.sectorEmissions.ippu },
    { key: "afolu", value: city.sectorEmissions.afolu },
  ];

  const headline = pickHeadlineIndicators(city.cityIndicators);

  return (
    <>
      <aside className="rounded-lg border bg-card text-card-foreground shadow-sm">
        <div className="p-5 space-y-5">
          <header className="space-y-1 pb-3 border-b">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" aria-hidden />
              <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                {t("evaluate.cityContextBannerLabel")}
              </span>
            </div>
            <h2 className="text-xl font-semibold leading-tight">{ct.displayName(city)}</h2>
            <p className="text-sm text-muted-foreground">{ct.region(city)}</p>
          </header>

          {/* Headline facts */}
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                {lang === "en" ? "Population" : "Población"}
              </span>
              <span className="text-base font-semibold tabular-nums">
                {formatNumber(city.population)}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                {lang === "en" ? "Total emissions" : "Emisiones totales"}
              </span>
              <span
                className={cn(
                  "text-base font-semibold tabular-nums flex items-center gap-1.5",
                  isNetSink && "text-primary"
                )}
              >
                {isNetSink && <TrendingDown className="h-3.5 w-3.5" aria-hidden />}
                {formatEmissions(Math.abs(city.totalEmissions))}
              </span>
            </div>
            {isNetSink && (
              <Badge variant="default" className="w-full justify-center gap-1 text-[10px] uppercase tracking-wide">
                <TrendingDown className="h-3 w-3" />
                {lang === "en" ? "Net carbon sink" : "Sumidero neto de carbono"}
              </Badge>
            )}
          </div>

          {/* Emissions chart */}
          <section>
            <h3 className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-3">
              {t("evaluate.emissionsTitle")}
            </h3>
            <EmissionsChart
              sectors={sectors.map((s) => ({
                key: s.key,
                label: t(`sectors.${s.key}` as never),
                value: s.value,
              }))}
            />
          </section>

          {/* Headline indicators (4 picks) */}
          {headline.length > 0 && (
            <section>
              <h3 className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-3">
                {lang === "en" ? "Key indicators" : "Indicadores clave"}
              </h3>
              <ul className="space-y-2">
                {headline.map((ind) => (
                  <li key={ind.key} className="grid grid-cols-[1fr_auto] gap-2 items-baseline">
                    <span className="text-sm leading-tight">
                      {lang === "en" ? ind.labelEn : ind.labelEs}
                    </span>
                    <span className="text-sm font-medium tabular-nums text-right whitespace-nowrap">
                      {formatIndicatorValue(ind.value, ind.units, lang)}
                      <CategoryDot category={ind.category} />
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <Button
            type="button"
            variant="outline"
            className="w-full justify-between gap-2"
            onClick={() => setSheetOpen(true)}
          >
            {lang === "en" ? "View full context" : "Ver contexto completo"}
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </aside>
      <CityContextSheet city={city} open={sheetOpen} onOpenChange={setSheetOpen} />
    </>
  );
}

/**
 * Pick 4 differentiating indicators — one per group — for the summary view.
 * - economy: median household income (always informative)
 * - people: indigenous identification (key differentiator between the 3 cities)
 * - land: the LARGEST land-use share for this city (Valdivia → silviculture,
 *         Paillaco → pasture, Lago Ranco → primary forest)
 * - infrastructure: electricity access
 */
function pickHeadlineIndicators(all: CityIndicator[]): CityIndicator[] {
  const find = (key: string) => all.find((i) => i.key === key);
  const dominantLand = all
    .filter((i) => i.group === "land")
    .slice()
    .sort((a, b) => b.value - a.value)[0];
  return [
    find("median_household_income"),
    find("indigenous_identification_rate"),
    dominantLand,
    find("electricity_access_rate"),
  ].filter(Boolean) as CityIndicator[];
}

function formatIndicatorValue(value: number, units: string, lang: "es" | "en"): string {
  if (units === "CLP") {
    return new Intl.NumberFormat(lang === "en" ? "en-US" : "es-CL", {
      style: "currency",
      currency: "CLP",
      maximumFractionDigits: 0,
    }).format(value);
  }
  if (units === "percent") return `${value.toFixed(1)}%`;
  if (units === "persons") {
    return new Intl.NumberFormat(lang === "en" ? "en-US" : "es-CL", {
      maximumFractionDigits: 0,
    }).format(value);
  }
  if (units === "years") return `${value.toFixed(1)} ${lang === "en" ? "yr" : "años"}`;
  return `${value} ${units}`;
}

const CATEGORY_TONE: Record<string, string> = {
  "very high": "bg-emerald-500",
  high: "bg-emerald-400",
  medium: "bg-amber-400",
  low: "bg-orange-400",
  "very low": "bg-rose-400",
};
function CategoryDot({ category }: { category: string }) {
  const tone = CATEGORY_TONE[category] ?? "bg-muted-foreground";
  return (
    <span
      className={cn("inline-block ml-2 h-2 w-2 rounded-full align-middle", tone)}
      aria-label={category}
      title={category}
    />
  );
}
