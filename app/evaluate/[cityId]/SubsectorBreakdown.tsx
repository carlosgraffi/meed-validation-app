"use client";

import { cn, formatEmissions } from "@/lib/utils";
import {
  SECTOR_COLOR,
  SECTOR_KEYS,
  SINK_COLOR,
  GPC_SUBSECTORS,
  sectorForGpcCode,
  type SectorKey,
} from "@/lib/sector-colors";

/**
 * Subsector emissions, grouped by parent GPC sector and colored to match the
 * sector bar chart. Shows the human-readable subsector name first, with the
 * GPC code as a secondary monospace label, so reviewers can see at a glance
 * e.g. "Agriculture, forestry & fishing — large positive" for Paillaco vs
 * near-zero for Lago Ranco, instead of squinting at "I.6" codes.
 *
 * Two variants:
 *   - `compact` (sidebar): no card chrome, sector header is a small inline
 *     row, rows wrap tightly. Designed to sit directly below the sector
 *     chart in the always-visible context sidebar.
 *   - default (sheet/drawer): each sector becomes its own bordered card.
 */
export function SubsectorBreakdown({
  subsectorEmissions,
  lang,
  compact = false,
}: {
  subsectorEmissions: Record<string, number>;
  lang: "es" | "en";
  compact?: boolean;
}) {
  const groups: Record<SectorKey, Array<{ code: string; value: number }>> = {
    stationaryEnergy: [],
    transportation: [],
    waste: [],
    ippu: [],
    afolu: [],
  };
  const unknown: Array<{ code: string; value: number }> = [];
  for (const [code, value] of Object.entries(subsectorEmissions)) {
    const sector = sectorForGpcCode(code);
    if (sector) groups[sector].push({ code, value });
    else unknown.push({ code, value });
  }
  for (const sector of SECTOR_KEYS) {
    groups[sector].sort((a, b) => a.code.localeCompare(b.code));
  }

  const sectorLabels: Record<SectorKey, { es: string; en: string }> = {
    stationaryEnergy: { es: "Energía estacionaria", en: "Stationary energy" },
    transportation: { es: "Transporte", en: "Transportation" },
    waste: { es: "Residuos", en: "Waste" },
    ippu: { es: "IPPU", en: "IPPU" },
    afolu: { es: "AFOLU", en: "AFOLU" },
  };

  return (
    <div className={cn(compact ? "space-y-3" : "space-y-3")}>
      {SECTOR_KEYS.map((sector) => {
        const items = groups[sector];
        if (items.length === 0) return null;
        const color = SECTOR_COLOR[sector];
        return (
          <div
            key={sector}
            className={cn(
              compact ? "pl-2.5" : "rounded-md border p-3",
              !compact && undefined
            )}
            style={
              compact
                ? { borderLeft: `2px solid ${color}` }
                : { borderLeft: `3px solid ${color}` }
            }
          >
            <div className={cn("flex items-center gap-2", compact ? "mb-1" : "mb-2")}>
              <span
                aria-hidden
                className={cn(
                  "inline-block rounded-full",
                  compact ? "h-2 w-2" : "h-2.5 w-2.5"
                )}
                style={{ backgroundColor: color }}
              />
              <span
                className={cn(
                  "font-semibold uppercase tracking-wide",
                  compact ? "text-[10px]" : "text-xs"
                )}
              >
                {sectorLabels[sector][lang]}
              </span>
            </div>
            <ul className={compact ? "space-y-0.5" : "space-y-1.5"}>
              {items.map(({ code, value }) => {
                const meta = GPC_SUBSECTORS[code];
                const name = meta ? meta[lang] : code;
                const isSink = value < 0;
                return (
                  <li
                    key={code}
                    className="grid grid-cols-[1fr_auto] gap-2 items-baseline"
                  >
                    <span
                      className={cn("leading-tight", compact ? "text-xs" : "text-sm")}
                    >
                      {name}
                      <span
                        className={cn(
                          "ml-1.5 font-mono text-muted-foreground",
                          compact ? "text-[9px]" : "text-[10px]"
                        )}
                      >
                        {code}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "font-medium tabular-nums text-right whitespace-nowrap",
                        compact ? "text-xs" : "text-sm"
                      )}
                      style={isSink ? { color: SINK_COLOR } : undefined}
                    >
                      {formatEmissions(value)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
      {unknown.length > 0 && (
        <div className={compact ? "pl-2.5" : "rounded-md border p-3"}>
          <div
            className={cn(
              "font-semibold uppercase tracking-wide text-muted-foreground",
              compact ? "text-[10px] mb-1" : "text-xs mb-2"
            )}
          >
            {lang === "en" ? "Other" : "Otros"}
          </div>
          <ul className={compact ? "space-y-0.5" : "space-y-1.5"}>
            {unknown
              .sort((a, b) => a.code.localeCompare(b.code))
              .map(({ code, value }) => (
                <li
                  key={code}
                  className="grid grid-cols-[1fr_auto] gap-2 items-baseline"
                >
                  <span
                    className={cn("font-mono", compact ? "text-xs" : "text-sm")}
                  >
                    {code}
                  </span>
                  <span
                    className={cn(
                      "font-medium tabular-nums text-right whitespace-nowrap",
                      compact ? "text-xs" : "text-sm"
                    )}
                    style={value < 0 ? { color: SINK_COLOR } : undefined}
                  >
                    {formatEmissions(value)}
                  </span>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}
