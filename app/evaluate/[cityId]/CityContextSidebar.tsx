"use client";

import { Building2 } from "lucide-react";
import { CityPreferences } from "./CityPreferences";
import { EmissionsChart } from "./EmissionsChart";
import { useT, useCityText } from "@/app/LangProvider";
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
  const ct = useCityText();
  const sectors = [
    { key: "stationaryEnergy", value: city.sectorEmissions.stationaryEnergy },
    { key: "transportation", value: city.sectorEmissions.transportation },
    { key: "waste", value: city.sectorEmissions.waste },
    { key: "ippu", value: city.sectorEmissions.ippu },
    { key: "afolu", value: city.sectorEmissions.afolu },
  ];

  return (
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

        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Stat label={t("evaluate.populationLabelShort")}>
            {formatNumber(city.population)}
            <Unit>{t("units.people")}</Unit>
          </Stat>
          <Stat label={t("evaluate.populationDensityLabelShort")}>
            {formatNumber(city.populationDensity, { maximumFractionDigits: 0 })}
            <Unit>{t("units.peoplePerKm2")}</Unit>
          </Stat>
          <Stat label={t("evaluate.biomeLabelShort")}>{ct.biome(city)}</Stat>
          <Stat label={t("evaluate.elevationLabelShort")}>
            {formatNumber(city.elevationM)}
            <Unit>m</Unit>
          </Stat>
        </div>

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
          <p className="text-xs mt-2 text-muted-foreground">
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
      <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
        {label}
      </div>
      <div className="text-base font-semibold mt-0.5 leading-tight">{children}</div>
    </div>
  );
}

function Unit({ children }: { children: React.ReactNode }) {
  return (
    <span className="ml-1 text-xs font-normal text-muted-foreground">{children}</span>
  );
}
