"use client";

import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";
import { useT } from "@/app/LangProvider";
import { useLang } from "@/app/LangProvider";
import type { RankedAction } from "./page";

/**
 * Reveal stage: shown AFTER the expert has finished every blind round
 * (Stage 1 → Stage 2 → Section C → Stage 3 reorder). Exposes the model's
 * ranked order plus the LLM-authored, rank-positioning explanation for each
 * action, and asks the expert to rate overall agreement with the ranking
 * on a 1–5 Likert.
 *
 * Methodological role: lets us measure "informed agreement" — i.e. how
 * persuasive the model's reasoning is once seen — separately from the
 * blind P@3 / P@10 / Spearman ρ signals collected upstream. By gating the
 * LLM rationale until after Stage 3 we keep all three headline metrics
 * untouched by rationale-driven anchoring.
 *
 * IMPORTANT: this component shows the LLM `explanation*` fields, which are
 * rank-positioning by design ("ranks first because…"). Never render this
 * during Stage 1, Stage 2, Section C, or Stage 3 — only on the dedicated
 * reveal stages, which the state machine places at the end of the pipeline.
 */
export function RevealStage({
  actions,
  agreement,
  onChange,
  readOnly,
}: {
  /** Actions in the model's rank order (1, 2, 3, … N). */
  actions: RankedAction[];
  /** Current Likert value, or null if the expert hasn't answered yet. */
  agreement: number | null;
  /** Persist a new Likert. Called with 1–5. */
  onChange: (likert: number) => void;
  /** When the stage has been advanced past — display, no inputs. */
  readOnly: boolean;
}) {
  const t = useT();
  const [lang] = useLang();

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card/50 p-4 flex items-start gap-3">
        <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" aria-hidden />
        <p className="text-sm leading-relaxed">{t("evaluate.revealIntro")}</p>
      </div>

      <ol className="space-y-3">
        {actions.map((r) => {
          const explanation =
            lang === "en"
              ? r.explanationEn ?? r.rationaleEn
              : r.explanationEs ?? r.rationaleEs;
          const name = lang === "en" ? r.action.nameEn : r.action.nameEs;
          return (
            <li
              key={r.action.actionId}
              className="rounded-lg border bg-background p-4 flex gap-4"
            >
              <div className="shrink-0 h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-base font-semibold">
                {r.rank}
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                <h4 className="text-sm font-semibold leading-snug">{name}</h4>
                <p className="text-xs leading-relaxed text-foreground/85">
                  {explanation}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      <fieldset
        className={cn(
          "rounded-lg border p-5 space-y-3",
          readOnly ? "bg-muted/20" : "bg-card"
        )}
      >
        <legend className="px-2 text-sm font-medium">
          {t("evaluate.revealAgreementQuestion")}
        </legend>
        <p className="text-xs text-muted-foreground -mt-1.5">
          {t("evaluate.revealAgreementHelp")}
        </p>
        <LikertRow value={agreement} onChange={onChange} disabled={readOnly} />
      </fieldset>
    </div>
  );
}

/**
 * 5-point Likert (Strongly disagree → Strongly agree). Renders five radio-style
 * buttons with current selection visually distinct. Single value, controlled.
 */
function LikertRow({
  value,
  onChange,
  disabled,
}: {
  value: number | null;
  onChange: (v: number) => void;
  disabled: boolean;
}) {
  const t = useT();
  // 1 → strongly disagree, 5 → strongly agree
  const labels = [
    t("evaluate.likertStronglyDisagree"),
    t("evaluate.likertDisagree"),
    t("evaluate.likertNeutral"),
    t("evaluate.likertAgree"),
    t("evaluate.likertStronglyAgree"),
  ];
  return (
    <div className="grid grid-cols-5 gap-2">
      {labels.map((label, idx) => {
        const v = idx + 1;
        const selected = value === v;
        return (
          <button
            key={v}
            type="button"
            disabled={disabled}
            onClick={() => onChange(v)}
            aria-pressed={selected}
            className={cn(
              "flex flex-col items-center justify-center gap-1 rounded-md border px-2 py-3 text-center transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              disabled && "cursor-not-allowed opacity-60",
              !disabled && "hover:bg-muted",
              selected && "bg-primary text-primary-foreground border-primary hover:bg-primary"
            )}
          >
            <span className="text-base font-semibold leading-none">{v}</span>
            <span className="text-[10px] leading-tight">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
