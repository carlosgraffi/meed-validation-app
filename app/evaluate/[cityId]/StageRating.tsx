"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useT, useActionText } from "@/app/LangProvider";
import { SECTOR_COLOR, sectorKeyFromName } from "@/lib/sector-colors";
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
export type RatingMap = Record<
  string,
  { likert: number; notSure: boolean; comment?: string }
>;

export function StageRating({
  question,
  focusActions,
  contextActions,
  ratings,
  onRatingChange,
  onNotSureChange,
  onCommentBlur,
  readOnly,
}: {
  question: "top3" | "top10";
  focusActions: RankedAction[];
  contextActions: Action[];
  ratings: RatingMap;
  onRatingChange: (actionId: string, modelRank: number, likert: number) => void;
  onNotSureChange: (actionId: string, modelRank: number, notSure: boolean) => void;
  /** Persist an optional free-text comment alongside the rating. Called on blur. */
  onCommentBlur: (actionId: string, modelRank: number, comment: string) => void;
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
                  onCommentBlur={(c) => onCommentBlur(r.action.actionId, r.rank, c)}
                  disabled={readOnly}
                  context={false}
                />
              </li>
            ))}
          </ol>
        </section>

        {/* Context group — read-only, no Likert. The divider needs to be
            unmistakable so the expert doesn't accidentally treat the
            reference actions as more actions-to-rate. */}
        {contextActions.length > 0 && (
          <section className="space-y-4 mt-6">
            <div
              className="relative flex items-center gap-3 my-2"
              aria-hidden="true"
            >
              <span className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
              <span className="rounded-full border bg-muted/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("evaluate.contextActionBadge")}
              </span>
              <span className="h-px flex-1 bg-gradient-to-l from-transparent via-border to-transparent" />
            </div>
            <header className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-muted-foreground">
                  {t("evaluate.contextActionsHeader")}
                </h3>
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
                    onCommentBlur={() => {}}
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
  onCommentBlur,
  disabled,
  context,
}: {
  action: Action;
  rating?: { likert: number; notSure: boolean; comment?: string };
  promptKey: string;
  onChange: (likert: number) => void;
  onNotSureChange: (b: boolean) => void;
  onCommentBlur: (comment: string) => void;
  disabled?: boolean;
  /** When true, the card is rendered as read-only context (no Likert). */
  context: boolean;
}) {
  const t = useT();
  const at = useActionText();
  const subsector = at.subsector(action);
  const sectorKey = sectorKeyFromName(action.sector) ?? sectorKeyFromName(action.sectorEn);
  const sectorColor = sectorKey ? SECTOR_COLOR[sectorKey] : null;
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
          {at.name(action)}
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{at.description(action)}</p>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge
            variant="muted"
            style={
              sectorColor
                ? { backgroundColor: `${sectorColor}1f`, color: sectorColor, borderColor: `${sectorColor}33` }
                : undefined
            }
          >
            {sectorColor && (
              <span
                aria-hidden
                className="inline-block h-2 w-2 rounded-full mr-1.5"
                style={{ backgroundColor: sectorColor }}
              />
            )}
            {t("evaluate.sectorLabel")}: {at.sector(action)}
          </Badge>
          {subsector && (
            <Badge
              variant="muted"
              style={
                sectorColor
                  ? { backgroundColor: `${sectorColor}14`, color: sectorColor, borderColor: `${sectorColor}26` }
                  : undefined
              }
            >
              {t("evaluate.subsectorLabel")}: {subsector}
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
          <RatingComment
            actionId={action.actionId}
            promptKey={promptKey}
            value={rating?.comment ?? ""}
            onBlur={onCommentBlur}
            disabled={!!disabled}
          />
        </fieldset>
      )}
    </div>
  );
}

/**
 * Optional free-text the expert can leave alongside each action's Likert.
 * Stage 1 and Stage 2 each get their own row in the Rating table (symmetric
 * questioning), so comments are scoped per (action, question) — leaving a
 * comment on the top-3 question does not back-fill the top-10 question.
 *
 * Persisted on blur (same shape as the reorder and agreement comments).
 */
function RatingComment({
  actionId,
  promptKey,
  value,
  onBlur,
  disabled,
}: {
  actionId: string;
  promptKey: string;
  value: string;
  onBlur: (next: string) => void;
  disabled: boolean;
}) {
  const t = useT();
  const [local, setLocal] = useState(value);
  useEffect(() => {
    setLocal(value);
  }, [value]);
  const MAX = 1000;
  // Unique id so the label/textarea pairing is correct across the two
  // possible stages in which this card can render (top3 vs top10).
  const id = `rc-${actionId}-${promptKey}`;
  return (
    <div className="mt-4 space-y-1.5">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {t("evaluate.ratingCommentLabel")}
      </label>
      <textarea
        id={id}
        value={local}
        onChange={(e) => setLocal(e.target.value.slice(0, MAX))}
        onBlur={() => {
          if (local !== value) onBlur(local);
        }}
        disabled={disabled}
        placeholder={t("evaluate.ratingCommentPlaceholder")}
        rows={2}
        className={cn(
          "w-full rounded-md border bg-background px-3 py-2 text-sm leading-relaxed",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-60"
        )}
      />
      <p className="text-[10px] text-muted-foreground text-right">
        {t("evaluate.characterCount", { count: local.length, max: MAX })}
      </p>
    </div>
  );
}
