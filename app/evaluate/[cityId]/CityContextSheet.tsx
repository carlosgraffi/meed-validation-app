"use client";

import { Building2, TrendingDown } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { EmissionsChart } from "./EmissionsChart";
import { CityPreferences } from "./CityPreferences";
import { SubsectorBreakdown } from "./SubsectorBreakdown";
import { useT, useLang, useCityText } from "@/app/LangProvider";
import { cn, formatNumber, formatEmissions } from "@/lib/utils";
import type { City, CityIndicator } from "@/lib/fixtures";

/**
 * Full city-context drawer. Opened from the Sidebar / Banner "View full context"
 * action. Shows every indicator the global-API returned for this city, the full
 * emissions breakdown (sector AND subsector), and the city's declared
 * preferences (empty arrays in the current dataset, but the slot is here for
 * when SSG provides real values).
 */
export function CityContextSheet({
  city,
  open,
  onOpenChange,
}: {
  city: City;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const t = useT();
  const [lang] = useLang();
  const ct = useCityText();

  const isNetSink = city.totalEmissions < 0;
  const indicatorsByGroup: Record<CityIndicator["group"], CityIndicator[]> = {
    people: [],
    economy: [],
    land: [],
    infrastructure: [],
  };
  for (const ind of city.cityIndicators) indicatorsByGroup[ind.group].push(ind);

  const groupLabels: Record<CityIndicator["group"], { es: string; en: string }> = {
    people: { es: "Personas", en: "People" },
    economy: { es: "Economía", en: "Economy" },
    land: { es: "Uso del suelo", en: "Land use" },
    infrastructure: { es: "Infraestructura", en: "Infrastructure" },
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={ct.displayName(city)}>
      <div className="p-5 space-y-6">
        {/* Header card */}
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" aria-hidden />
            <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
              {t("evaluate.cityContextBannerLabel")}
            </span>
          </div>
          <h3 className="text-2xl font-semibold leading-tight">{ct.displayName(city)}</h3>
          <p className="text-sm text-muted-foreground">{ct.region(city)}</p>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <Badge variant={isNetSink ? "default" : "muted"} className="gap-1">
              {isNetSink && <TrendingDown className="h-3 w-3" aria-hidden />}
              {formatEmissions(Math.abs(city.totalEmissions))} CO₂eq/{lang === "en" ? "yr" : "año"}
              {isNetSink && (
                <span className="ml-1 uppercase tracking-wide text-[10px]">
                  {lang === "en" ? "net sink" : "sumidero neto"}
                </span>
              )}
            </Badge>
            {city.area_km2 != null && (
              <Badge variant="muted">
                {formatNumber(city.area_km2)} km²
              </Badge>
            )}
            <Badge variant="muted">
              {formatNumber(city.population)} {t("units.people")}
            </Badge>
          </div>
        </section>

        {/* Emissions chart */}
        <section className="space-y-2">
          <h4 className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
            {t("evaluate.emissionsTitle")}
          </h4>
          <EmissionsChart
            sectors={[
              { key: "stationaryEnergy", label: t(`sectors.stationaryEnergy` as never), value: city.sectorEmissions.stationaryEnergy },
              { key: "transportation", label: t(`sectors.transportation` as never), value: city.sectorEmissions.transportation },
              { key: "waste", label: t(`sectors.waste` as never), value: city.sectorEmissions.waste },
              { key: "ippu", label: t(`sectors.ippu` as never), value: city.sectorEmissions.ippu },
              { key: "afolu", label: t(`sectors.afolu` as never), value: city.sectorEmissions.afolu },
            ]}
          />
        </section>

        {city.subsectorEmissions && Object.keys(city.subsectorEmissions).length > 0 && (
          <section className="space-y-3">
            <h4 className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
              {lang === "en" ? "Emissions by subsector" : "Emisiones por subsector"}
            </h4>
            <SubsectorBreakdown
              subsectorEmissions={city.subsectorEmissions}
              lang={lang}
            />
          </section>
        )}

        {/* Indicator groups */}
        {(Object.keys(indicatorsByGroup) as CityIndicator["group"][]).map((group) => {
          const inds = indicatorsByGroup[group];
          if (inds.length === 0) return null;
          return (
            <section key={group} className="space-y-2">
              <h4 className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                {groupLabels[group][lang]}
              </h4>
              <ul className="space-y-2">
                {inds.map((ind) => (
                  <li key={ind.key} className="grid grid-cols-[1fr_auto] gap-3 items-baseline">
                    <span className="text-sm">{lang === "en" ? ind.labelEn : ind.labelEs}</span>
                    <span className="text-sm font-medium tabular-nums text-right">
                      {formatIndicatorValue(ind.value, ind.units, lang)}
                      <CategoryDot category={ind.category} />
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}

        {/* City preferences (empty for the current dataset, slot kept for SSG) */}
        <section className="space-y-2 pb-6">
          <h4 className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
            {t("evaluate.cityRequestTitle")}
          </h4>
          <CityPreferences request={city.cityRequest} variant="block" />
        </section>
      </div>
    </Sheet>
  );
}

function formatIndicatorValue(value: number, units: string, lang: "es" | "en"): string {
  // Currency
  if (units === "CLP") {
    return new Intl.NumberFormat(lang === "en" ? "en-US" : "es-CL", {
      style: "currency",
      currency: "CLP",
      maximumFractionDigits: 0,
    }).format(value);
  }
  if (units === "percent") {
    return `${value.toFixed(1)}%`;
  }
  if (units === "persons") {
    return new Intl.NumberFormat(lang === "en" ? "en-US" : "es-CL", {
      maximumFractionDigits: 0,
    }).format(value);
  }
  if (units === "years") {
    return `${value.toFixed(1)} ${lang === "en" ? "yr" : "años"}`;
  }
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
