"use client";

import { Card, CardContent } from "@/components/ui/card";
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
 * Layout per stage:
 *   - Focus section: the actions the expert RATES (top 3 for Stage 1, top 10
 *     for Stage 2). Full Likert + "not sure" controls.
 *   - Context section: the next "almost made it" actions, shown read-only as
 *     reference. The expert doesn't rate them — they're there so the expert
 *     can see what's just outside the cut. Carlos's call: this gives experts
 *     a sense of how cleanly the focus set separates from runners-up.
 *
 * Ranks are NEVER shown in either group here. Stage 3 (reorder) is the only
 * place the model's ordering is revealed.
 */
export type RatingMap = Record<string, { likert: number; notSure: boolean }>;

export function StageRating({
  question,
  focusActions,
  contextActions,
  ratings,
  onRatingChange,
  onNotSureChange,
  readOnly,
}: {
  question: "top3" | "top10";
  focusActions: RankedAction[];
  contextActions: Action[];
  ratings: RatingMap;
  onRatingChange: (actionId: string, modelRank: number, likert: number) => void;
  onNotSureChange: (actionId: string, modelRank: number, notSure: boolean) => void;
  readOnly?: boolean;
}) {
  const t = useT();
  const promptKey =
    question === "top3" ? "evaluate.likertPromptTop3" : "evaluate.likertPromptTop10";
  const focusHintKey =
    question === "top3" ? "evaluate.focusActionsHintTop3" : "evaluate.focusActionsHintTop10";
  const contextHintKey =
    question === "top3" ? "evaluate.contextActionsHintTop3" : "evaluate.contextActionsHintTop10";

  return (
    <Card>
      <CardContent className="space-y-8 pt-6">
        {/* Focus group */}
        <section className="space-y-4">
          <header className="space-y-1">
            <h3 className="text-base font-semibold">{t("evaluate.focusActionsHeader")}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t(focusHintKey as never)}
            </p>
          </header>
          <ol className="space-y-4">
            {focusActions.map((r) => (
              <li key={r.action.actionId}>
                <ActionCard
                  action={r.action}
                  rating={ratings[r.action.actionId]}
                  promptKey={promptKey}
                  onChange={(l) => onRatingChange(r.action.actionId, r.rank, l)}
                  onNotSureChange={(b) => onNotSureChange(r.action.actionId, r.rank, b)}
                  disabled={readOnly}
                  context={false}
                />
              </li>
            ))}
          </ol>
        </section>

        {/* Context group — read-only, no Likert */}
        {contextActions.length > 0 && (
          <section className="space-y-4">
            <header className="space-y-1 pt-2 border-t">
              <div className="flex items-center gap-2 pt-4">
                <h3 className="text-base font-semibold text-muted-foreground">
                  {t("evaluate.contextActionsHeader")}
                </h3>
                <Badge variant="muted" className="text-[10px] uppercase tracking-wide">
                  {t("evaluate.contextActionBadge")}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t(contextHintKey as never)}
              </p>
            </header>
            <ol className="space-y-3">
              {contextActions.map((action) => (
                <li key={action.actionId}>
                  <ActionCard
                    action={action}
                    rating={undefined}
                    promptKey={promptKey}
                    onChange={() => {}}
                    onNotSureChange={() => {}}
                    disabled
                    context
                  />
                </li>
              ))}
            </ol>
          </section>
        )}
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
  context,
}: {
  action: Action;
  rating?: { likert: number; notSure: boolean };
  promptKey: string;
  onChange: (likert: number) => void;
  onNotSureChange: (b: boolean) => void;
  disabled?: boolean;
  /** When true, the card is rendered as read-only context (no Likert). */
  context: boolean;
}) {
  const t = useT();
  return (
    <div
      className={cn(
        "rounded-lg border p-5",
        context ? "bg-muted/20 border-dashed" : "bg-card border-input"
      )}
    >
      <div className="space-y-3">
        <h3
          className={cn(
            "text-base font-semibold leading-tight",
            context && "text-foreground/85"
          )}
        >
          {action.nameEs}
        </h3>
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

      {!context && (
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
      )}
    </div>
  );
}
