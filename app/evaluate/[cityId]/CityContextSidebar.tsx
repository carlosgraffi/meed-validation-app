"use client";

import { Building2 } from "lucide-react";
import { CityPreferences } from "./CityPreferences";
import { EmissionsChart } from "./EmissionsChart";
import { useT } from "@/app/LangProvider";
import { formatNumber, formatEmissions } from "@/lib/utils";
import type { City } from "@/lib/fixtures";

/**
 * Desktop-only sidebar variant of the city context. Always-expanded — no
 * collapse toggles — because the sidebar lives in its own column with
 * enough vertical space to show everything.
 *
 * On mobile, the parent (EvaluationForm) renders <CityContextBanner>
 * instead. The two components carry the same information in different
 * layouts; do not mount both at once.
 */
export function CityContextSidebar({ city }: { city: City }) {
  const t = useT();
  const sectors = [
    { key: "stationaryEnergy", value: city.sectorEmissions.stationaryEnergy },
    { key: "transportation", value: city.sectorEmissions.transportation },
    { key: "waste", value: city.sectorEmissions.waste },
    { key: "ippu", value: city.sectorEmissions.ippu },
    { key: "afolu", value: city.sectorEmissions.afolu },
  ];

  return (
    <aside className="rounded-lg border bg-card text-card-foreground shadow-sm">
      <div className="p-5 space-y-5 text-sm">
        <header className="space-y-1 pb-3 border-b">
          <div className="flex items-center gap-2">
            <Building2 className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
              {t("evaluate.cityContextBannerLabel")}
            </span>
          </div>
          <h2 className="text-base font-semibold leading-tight">{city.displayName}</h2>
          <p className="text-xs text-muted-foreground">{city.region}</p>
        </header>

        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Stat label={t("evaluate.populationLabel")}>
            {formatNumber(city.population)} {t("units.people")}
          </Stat>
          <Stat label={t("evaluate.populationDensityLabel")}>
            {formatNumber(city.populationDensity, { maximumFractionDigits: 0 })}{" "}
            {t("units.peoplePerKm2")}
          </Stat>
          <Stat label={t("evaluate.biomeLabel")}>{city.biome}</Stat>
          <Stat label={t("evaluate.elevationLabel")}>
            {formatNumber(city.elevationM)} {t("units.meters")}
          </Stat>
        </div>

        <section>
          <h3 className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">
            {t("evaluate.emissionsTitle")}
          </h3>
          <EmissionsChart
            sectors={sectors.map((s) => ({
              key: s.key,
              label: t(`sectors.${s.key}` as never),
              value: s.value,
            }))}
          />
          <p className="text-[11px] mt-2 text-muted-foreground">
            {t("common.totalEmissionsLine", {
              emissions: formatEmissions(city.totalEmissions),
            })}
          </p>
        </section>

        <CityPreferences request={city.cityRequest} variant="block" />
      </div>
    </aside>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-medium mt-0.5 leading-tight">{children}</div>
    </div>
  );
}
