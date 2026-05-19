"use client";

import { Badge } from "@/components/ui/badge";
import { useT } from "@/app/LangProvider";
import { cn } from "@/lib/utils";
import type { CityRequest } from "@/lib/fixtures";

/**
 * Surfaces what the city declared as priorities when it asked the model
 * for recommendations. Sectors / Timeframes / Co-benefits / Excluded actions.
 *
 * Two layouts:
 *  - `variant="block"`: full card with labeled rows (used in Section A)
 *  - `variant="inline"`: compact chips row (used in the sticky banner)
 */
export function CityPreferences({
  request,
  variant = "block",
  className,
}: {
  request: CityRequest;
  variant?: "block" | "inline";
  className?: string;
}) {
  const t = useT();
  const empty =
    request.preferredSectors.length === 0 &&
    request.preferredTimeframes.length === 0 &&
    request.preferredCoBenefits.length === 0 &&
    request.excludedActionIds.length === 0;

  if (variant === "inline") {
    return (
      <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs", className)}>
        <span className="text-muted-foreground">{t("evaluate.cityRequestTitle")}:</span>
        {request.preferredSectors.map((s) => (
          <Badge key={`s-${s}`} variant="default" className="text-[10px]">
            {t(`sectors.${s}` as never)}
          </Badge>
        ))}
        {request.preferredTimeframes.map((tf) => (
          <Badge key={`t-${tf}`} variant="muted" className="text-[10px]">
            {timeframeLabel(t, tf)}
          </Badge>
        ))}
        {request.preferredCoBenefits.map((cb) => (
          <Badge key={`c-${cb}`} variant="accent" className="text-[10px]">
            {t(`cobenefits.${cb}` as never)}
          </Badge>
        ))}
      </div>
    );
  }

  return (
    <section
      className={cn(
        "rounded-lg border bg-card px-4 py-3 space-y-2",
        className
      )}
      aria-label={t("evaluate.cityRequestTitle")}
    >
      <div>
        <h3 className="text-sm font-semibold">{t("evaluate.cityRequestTitle")}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {t("evaluate.cityRequestSubtitle")}
        </p>
      </div>
      {empty ? (
        <p className="text-xs text-muted-foreground">{t("evaluate.cityRequestNone")}</p>
      ) : (
        <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 pt-1">
          <Row label={t("evaluate.cityRequestSectorsLabel")}>
            {request.preferredSectors.length === 0
              ? muted(t("evaluate.cityRequestNone"))
              : request.preferredSectors.map((s) => (
                  <Badge key={s} variant="default" className="text-xs">
                    {t(`sectors.${s}` as never)}
                  </Badge>
                ))}
          </Row>
          <Row label={t("evaluate.cityRequestTimeframesLabel")}>
            {request.preferredTimeframes.length === 0
              ? muted(t("evaluate.cityRequestNone"))
              : request.preferredTimeframes.map((tf) => (
                  <Badge key={tf} variant="muted" className="text-xs">
                    {timeframeLabel(t, tf)}
                  </Badge>
                ))}
          </Row>
          <Row label={t("evaluate.cityRequestCoBenefitsLabel")}>
            {request.preferredCoBenefits.length === 0
              ? muted(t("evaluate.cityRequestNone"))
              : request.preferredCoBenefits.map((cb) => (
                  <Badge key={cb} variant="accent" className="text-xs">
                    {t(`cobenefits.${cb}` as never)}
                  </Badge>
                ))}
          </Row>
          <Row label={t("evaluate.cityRequestExcludedLabel")}>
            {request.excludedActionIds.length === 0 ? (
              muted("—")
            ) : (
              <span className="text-xs text-muted-foreground">
                {request.excludedActionIds.length}
              </span>
            )}
          </Row>
        </dl>
      )}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
        {label}
      </dt>
      <dd className="flex flex-wrap gap-1.5">{children}</dd>
    </div>
  );
}

function muted(s: string) {
  return <span className="text-xs text-muted-foreground">{s}</span>;
}

function timeframeLabel(t: ReturnType<typeof useT>, tf: string): string {
  if (tf === "short") return t("evaluate.timeframeShort");
  if (tf === "medium") return t("evaluate.timeframeMedium");
  if (tf === "long") return t("evaluate.timeframeLong");
  return tf;
}
