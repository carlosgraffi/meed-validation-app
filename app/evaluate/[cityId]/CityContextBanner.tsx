"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Building2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CityPreferences } from "./CityPreferences";
import { EmissionsChart } from "./EmissionsChart";
import { useT, useCityText } from "@/app/LangProvider";
import { cn, formatNumber, formatEmissions } from "@/lib/utils";
import type { City } from "@/lib/fixtures";

/**
 * Sticky two-row header that pins below the page header and stays visible
 * as the expert scrolls through stages. The compact row is always
 * visible (city name + region + total emissions + key request chips).
 * The expand button reveals a drawer with the full context — emissions
 * chart, biome, and complete preference block.
 *
 * Position-sticky inside the main scroll container; depends on the parent
 * not setting `overflow: hidden`.
 */
export function CityContextBanner({ city }: { city: City }) {
  const t = useT();
  const ct = useCityText();
  const [open, setOpen] = useState(false);
  const sectors = [
    { key: "stationaryEnergy", value: city.sectorEmissions.stationaryEnergy },
    { key: "transportation", value: city.sectorEmissions.transportation },
    { key: "waste", value: city.sectorEmissions.waste },
    { key: "ippu", value: city.sectorEmissions.ippu },
    { key: "afolu", value: city.sectorEmissions.afolu },
  ];

  return (
    <div className="sticky top-0 z-30 -mx-6 mb-2 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b">
      <div className="max-w-4xl mx-auto px-6 py-2.5">
        {/* Compact row — always visible */}
        <div className="flex items-center gap-3 flex-wrap">
          <Building2 className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
          <div className="min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <h2 className="text-sm font-semibold truncate">{ct.displayName(city)}</h2>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground truncate">{ct.region(city)}</span>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground">
                {t("common.totalEmissionsLine", { emissions: formatEmissions(city.totalEmissions) })}
              </span>
            </div>
            <div className="hidden sm:block">
              <CityPreferences request={city.cityRequest} variant="inline" className="mt-1" />
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setOpen((v) => !v)}
            className="ml-auto h-7 gap-1.5 text-xs"
            aria-expanded={open}
          >
            {open ? (
              <>
                {t("evaluate.cityContextBannerCollapse")}
                <ChevronUp className="h-3.5 w-3.5" aria-hidden />
              </>
            ) : (
              <>
                {t("evaluate.cityContextBannerExpand")}
                <ChevronDown className="h-3.5 w-3.5" aria-hidden />
              </>
            )}
          </Button>
        </div>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              style={{ overflow: "hidden" }}
            >
              <div className="pt-4 pb-2 space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <FactRow label={t("evaluate.populationLabel")}>
                    {formatNumber(city.population)} {t("units.people")}
                  </FactRow>
                  <FactRow label={t("evaluate.biomeLabel")}>{ct.biome(city)}</FactRow>
                  <FactRow label={t("evaluate.populationDensityLabel")}>
                    {formatNumber(city.populationDensity, { maximumFractionDigits: 0 })}{" "}
                    {t("units.peoplePerKm2")}
                  </FactRow>
                  <FactRow label={t("evaluate.elevationLabel")}>
                    {formatNumber(city.elevationM)} {t("units.meters")}
                  </FactRow>
                </div>

                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">
                    {t("evaluate.emissionsTitle")}
                  </div>
                  <EmissionsChart
                    sectors={sectors.map((s) => ({
                      key: s.key,
                      label: t(`sectors.${s.key}` as never),
                      value: s.value,
                    }))}
                  />
                </div>

                <CityPreferences request={city.cityRequest} variant="block" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function FactRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-medium mt-0.5">{children}</div>
    </div>
  );
}
