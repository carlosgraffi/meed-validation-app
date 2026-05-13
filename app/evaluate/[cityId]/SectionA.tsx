"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatNumber, formatEmissions, t } from "@/lib/utils";
import type { City } from "@/lib/fixtures";
import { EmissionsChart } from "./EmissionsChart";

export function SectionA({ city, onContinue }: { city: City; onContinue: () => void }) {
  const total = city.totalEmissions;
  const sectors = [
    { key: "stationaryEnergy", value: city.sectorEmissions.stationaryEnergy },
    { key: "transportation", value: city.sectorEmissions.transportation },
    { key: "waste", value: city.sectorEmissions.waste },
    { key: "ippu", value: city.sectorEmissions.ippu },
    { key: "afolu", value: city.sectorEmissions.afolu },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <CardTitle className="text-2xl">{city.displayName}</CardTitle>
          <Badge variant="muted">{city.region}</Badge>
        </div>
        <CardDescription>{t("evaluate.sectionAsubtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid sm:grid-cols-2 gap-4">
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

        <div>
          <h3 className="text-sm font-medium mb-1">{t("evaluate.emissionsTitle")}</h3>
          <p className="text-xs text-muted-foreground mb-3">
            {t("evaluate.emissionsSubtitle", { units: t("units.tCO2eq") })}
          </p>
          <EmissionsChart
            sectors={sectors.map((s) => ({
              key: s.key,
              label: t(`sectors.${s.key}` as never),
              value: s.value,
            }))}
          />
          <p className="text-xs text-muted-foreground mt-2">
            {t("common.totalEmissionsLine", { emissions: formatEmissions(total) })}
          </p>
        </div>

        {city.statedSectorPriority ? (
          <div className="rounded-md border border-accent/50 bg-accent/5 p-3 text-sm">
            {t("evaluate.statedPriorityCallout", {
              sector: t(`sectors.${city.statedSectorPriority}` as never),
            })}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">
            {t("evaluate.noStatedPriority")}
          </div>
        )}

        <div className="pt-2">
          <Button onClick={onContinue}>{t("evaluate.continueToEvaluation")} ↓</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{label}</div>
      <div className="text-sm font-medium">{children}</div>
    </div>
  );
}
