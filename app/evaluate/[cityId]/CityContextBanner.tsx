"use client";

import { useState } from "react";
import { Building2, TrendingDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CityContextSheet } from "./CityContextSheet";
import { useT, useLang, useCityText } from "@/app/LangProvider";
import { cn, formatEmissions } from "@/lib/utils";
import type { City } from "@/lib/fixtures";

/**
 * Mobile-only sticky banner that pins below the page header. Always-compact;
 * the full context lives behind a "View full context" button that opens the
 * <CityContextSheet> drawer. Mirrors the desktop sidebar's API.
 */
export function CityContextBanner({ city }: { city: City }) {
  const t = useT();
  const [lang] = useLang();
  const ct = useCityText();
  const [sheetOpen, setSheetOpen] = useState(false);
  const isNetSink = city.totalEmissions < 0;

  return (
    <>
      <div className="sticky top-0 z-30 -mx-6 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b">
        <div className="max-w-4xl mx-auto px-6 py-2.5">
          <div className="flex items-center gap-3 flex-wrap">
            <Building2 className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2 flex-wrap">
                <h2 className="text-sm font-semibold truncate">{ct.displayName(city)}</h2>
                <span className="text-xs text-muted-foreground">·</span>
                <span className="text-xs text-muted-foreground truncate">{ct.region(city)}</span>
              </div>
              <div className="mt-0.5 flex items-center gap-2 flex-wrap">
                <span
                  className={cn(
                    "text-xs tabular-nums flex items-center gap-1",
                    isNetSink ? "text-primary font-medium" : "text-muted-foreground"
                  )}
                >
                  {isNetSink && <TrendingDown className="h-3 w-3" aria-hidden />}
                  {formatEmissions(Math.abs(city.totalEmissions))} CO₂eq/
                  {lang === "en" ? "yr" : "año"}
                </span>
                {isNetSink && (
                  <Badge variant="default" className="text-[10px]">
                    {lang === "en" ? "Net sink" : "Sumidero neto"}
                  </Badge>
                )}
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSheetOpen(true)}
              className="h-7 gap-1 text-xs shrink-0"
            >
              {t("evaluate.cityContextBannerExpand")}
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </Button>
          </div>
        </div>
      </div>
      <CityContextSheet city={city} open={sheetOpen} onOpenChange={setSheetOpen} />
    </>
  );
}
