"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn, t } from "@/lib/utils";
import type { RankedAction } from "./EvaluationForm";

export function SectionB({
  rankedActions,
  ratings,
  onRatingChange,
  onNotSureChange,
  disabled,
}: {
  rankedActions: RankedAction[];
  ratings: Record<string, { likert: number; notSure: boolean }>;
  onRatingChange: (actionId: string, modelRank: number, likert: number) => void;
  onNotSureChange: (actionId: string, modelRank: number, notSure: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("evaluate.sectionBtitle")}</CardTitle>
        <CardDescription className="leading-relaxed">{t("evaluate.sectionBintro")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ol className="space-y-4">
          {rankedActions.map((r) => (
            <li key={r.action.actionId}>
              <ActionCard
                rank={r.rank}
                action={r.action}
                rating={ratings[r.action.actionId]}
                onChange={(l) => onRatingChange(r.action.actionId, r.rank, l)}
                onNotSureChange={(b) => onNotSureChange(r.action.actionId, r.rank, b)}
                disabled={disabled}
              />
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

function ActionCard({
  rank,
  action,
  rating,
  onChange,
  onNotSureChange,
  disabled,
}: {
  rank: number;
  action: import("@/lib/fixtures").Action;
  rating?: { likert: number; notSure: boolean };
  onChange: (likert: number) => void;
  onNotSureChange: (b: boolean) => void;
  disabled?: boolean;
}) {
  const isTop3 = rank <= 3;
  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-5",
        isTop3 ? "border-primary/60 ring-1 ring-primary/20" : "border-input"
      )}
    >
      <div className="flex items-start gap-4">
        <div
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-md text-lg font-bold",
            isTop3 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          )}
          aria-label={t("evaluate.actionRankLabel", { rank })}
        >
          #{rank}
        </div>
        <div className="flex-1 min-w-0 space-y-3">
          {isTop3 && (
            <Badge variant="accent" className="uppercase text-[10px] tracking-wider">
              {t("evaluate.mainRecommendationTag")}
            </Badge>
          )}
          <h3 className="text-base font-semibold leading-tight">{action.nameEs}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{action.descriptionEs}</p>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="muted">
              {t("evaluate.sectorLabel")}: {action.sector}
            </Badge>
            {action.subsector && (
              <Badge variant="muted">
                {t("evaluate.subsectorLabel")}: {action.subsector}
              </Badge>
            )}
            <Badge variant="outline">
              {t("evaluate.ghgBandLabel")}:{" "}
              {t(`evaluate.ghgBands.${action.ghgReductionBand}` as never)}
            </Badge>
            <Badge variant="outline">
              {t("evaluate.costBandLabel")}: {t(`evaluate.costBands.${action.costBand}` as never)}
            </Badge>
            <Badge variant="outline">
              {t("evaluate.timelineBandLabel")}:{" "}
              {t(`evaluate.timelineBands.${action.timelineBand}` as never)}
            </Badge>
          </div>

          {action.coBenefits.length > 0 && (
            <div className="text-xs">
              <span className="text-muted-foreground mr-2">{t("evaluate.coBenefitsLabel")}:</span>
              <span className="inline-flex flex-wrap gap-1.5">
                {action.coBenefits.map((cb) => (
                  <Badge key={cb} variant="default" className="text-[10px]">
                    {t(`cobenefits.${cb}` as never)}
                  </Badge>
                ))}
              </span>
            </div>
          )}
        </div>
      </div>

      <fieldset className="mt-4 pt-4 border-t" disabled={disabled}>
        <legend className="text-sm font-medium mb-3">{t("evaluate.likertPrompt")}</legend>
        <RadioGroup
          value={rating?.likert?.toString() ?? ""}
          onValueChange={(v) => onChange(parseInt(v, 10))}
          className="grid sm:grid-cols-5 gap-2"
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <div key={n} className="flex items-center gap-2">
              <RadioGroupItem
                value={n.toString()}
                id={`r-${action.actionId}-${n}`}
                disabled={disabled}
              />
              <Label htmlFor={`r-${action.actionId}-${n}`} className="text-xs cursor-pointer">
                {n}. {t(`evaluate.likert${n}` as never)}
              </Label>
            </div>
          ))}
        </RadioGroup>
        <label className="flex items-center gap-2 mt-4 text-xs cursor-pointer">
          <Checkbox
            checked={rating?.notSure ?? false}
            onCheckedChange={(v) => onNotSureChange(!!v)}
            disabled={disabled || !rating}
          />
          <span className={cn(!rating && "text-muted-foreground")}>{t("evaluate.notSureLabel")}</span>
        </label>
      </fieldset>
    </div>
  );
}
