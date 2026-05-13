"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useT } from "@/app/LangProvider";
import type { Action } from "@/lib/fixtures";
import type { RankedAction } from "./page";

/**
 * Shared component for Stages 1 and 2.
 *
 * Same card design as the old SectionB, with two important differences:
 *   - The rank badge and "Recomendación principal" tag are NEVER shown here.
 *     Ranks are revealed only in Stage 3 (reorder).
 *   - The Likert prompt is the question-specific one (top3 or top10), not the
 *     old positional prompt.
 */
export type RatingMap = Record<string, { likert: number; notSure: boolean }>;

export function StageRating({
  question,
  actions,
  ratings,
  onRatingChange,
  onNotSureChange,
  readOnly,
}: {
  question: "top3" | "top10";
  actions: RankedAction[];
  ratings: RatingMap;
  onRatingChange: (actionId: string, modelRank: number, likert: number) => void;
  onNotSureChange: (actionId: string, modelRank: number, notSure: boolean) => void;
  readOnly?: boolean;
}) {
  const t = useT();
  const titleKey = question === "top3" ? "evaluate.stage1Title" : "evaluate.stage2Title";
  const introKey = question === "top3" ? "evaluate.stage1Intro" : "evaluate.stage2Intro";
  const promptKey =
    question === "top3" ? "evaluate.likertPromptTop3" : "evaluate.likertPromptTop10";

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t(titleKey as never)}</CardTitle>
        <CardDescription className="leading-relaxed">{t(introKey as never)}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ol className="space-y-4">
          {actions.map((r) => (
            <li key={r.action.actionId}>
              <ActionCard
                action={r.action}
                rating={ratings[r.action.actionId]}
                promptKey={promptKey}
                onChange={(l) => onRatingChange(r.action.actionId, r.rank, l)}
                onNotSureChange={(b) => onNotSureChange(r.action.actionId, r.rank, b)}
                disabled={readOnly}
              />
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

function ActionCard({
  action,
  rating,
  promptKey,
  onChange,
  onNotSureChange,
  disabled,
}: {
  action: Action;
  rating?: { likert: number; notSure: boolean };
  promptKey: string;
  onChange: (likert: number) => void;
  onNotSureChange: (b: boolean) => void;
  disabled?: boolean;
}) {
  const t = useT();
  return (
    <div className="rounded-lg border border-input bg-card p-5">
      <div className="space-y-3">
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

      <fieldset className="mt-4 pt-4 border-t" disabled={disabled}>
        <legend className="text-sm font-medium mb-3">{t(promptKey as never)}</legend>
        <RadioGroup
          value={rating?.likert?.toString() ?? ""}
          onValueChange={(v) => onChange(parseInt(v, 10))}
          className="grid sm:grid-cols-5 gap-2"
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <div key={n} className="flex items-center gap-2">
              <RadioGroupItem
                value={n.toString()}
                id={`r-${action.actionId}-${promptKey}-${n}`}
                disabled={disabled}
              />
              <Label
                htmlFor={`r-${action.actionId}-${promptKey}-${n}`}
                className="text-xs cursor-pointer"
              >
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
