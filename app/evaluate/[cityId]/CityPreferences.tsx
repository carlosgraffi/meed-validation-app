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
 *  - `variant="block"`: full card with labeled rows (used in Section A + sidebar)
 *  - `variant="inline"`: compact chips row (used in the mobile sticky banner)
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
          <Badge key={`s-${s}`} variant="default" className="text-[11px]">
            {t(`sectors.${s}` as never)}
          </Badge>
        ))}
        {request.preferredTimeframes.map((tf) => (
          <Badge key={`t-${tf}`} variant="muted" className="text-[11px]">
            {timeframeLabel(t, tf)}
          </Badge>
        ))}
        {request.preferredCoBenefits.map((cb) => (
          <Badge key={`c-${cb}`} variant="accent" className="text-[11px]">
            {t(`cobenefits.${cb}` as never)}
          </Badge>
        ))}
      </div>
    );
  }

  return (
    <section
      className={cn("rounded-lg border bg-muted/30 px-4 py-4 space-y-3", className)}
      aria-label={t("evaluate.cityRequestTitle")}
    >
      <div>
        <h3 className="text-base font-semibold">{t("evaluate.cityRequestTitle")}</h3>
        <p className="text-sm text-muted-foreground mt-1 leading-snug">
          {t("evaluate.cityRequestSubtitle")}
        </p>
      </div>
      {empty ? (
        <p className="text-sm text-muted-foreground">{t("evaluate.cityRequestNone")}</p>
      ) : (
        <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-4 pt-1">
          <Row label={t("evaluate.cityRequestSectorsLabel")}>
            {request.preferredSectors.length === 0
              ? muted(t("evaluate.cityRequestNone"))
              : request.preferredSectors.map((s) => (
                  <Badge key={s} variant="default">
                    {t(`sectors.${s}` as never)}
                  </Badge>
                ))}
          </Row>
          <Row label={t("evaluate.cityRequestTimeframesLabel")}>
            {request.preferredTimeframes.length === 0
              ? muted(t("evaluate.cityRequestNone"))
              : request.preferredTimeframes.map((tf) => (
                  <Badge key={tf} variant="muted">
                    {timeframeLabel(t, tf)}
                  </Badge>
                ))}
          </Row>
          <Row label={t("evaluate.cityRequestCoBenefitsLabel")}>
            {request.preferredCoBenefits.length === 0
              ? muted(t("evaluate.cityRequestNone"))
              : request.preferredCoBenefits.map((cb) => (
                  <Badge key={cb} variant="accent">
                    {t(`cobenefits.${cb}` as never)}
                  </Badge>
                ))}
          </Row>
          <Row label={t("evaluate.cityRequestExcludedLabel")}>
            {request.excludedActionIds.length === 0 ? (
              muted("—")
            ) : (
              <span className="text-sm text-muted-foreground">
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
      <dt className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-1.5">
        {label}
      </dt>
      <dd className="flex flex-wrap gap-1.5">{children}</dd>
    </div>
  );
}

function muted(s: string) {
  return <span className="text-sm text-muted-foreground">{s}</span>;
}

function timeframeLabel(t: ReturnType<typeof useT>, tf: string): string {
  if (tf === "short") return t("evaluate.timeframeShort");
  if (tf === "medium") return t("evaluate.timeframeMedium");
  if (tf === "long") return t("evaluate.timeframeLong");
  return tf;
}
