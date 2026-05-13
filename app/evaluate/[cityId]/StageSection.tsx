"use client";

import { useState } from "react";
import { Check, ChevronDown, ChevronUp, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Wraps each stage of the evaluation flow with a distinct, color-accented
 * header so the expert can tell which stage they're in at a glance.
 *
 * - `active`: rendered normally, color-accented border, prominent header
 * - `complete`: collapsed by default, color-accented border, "completada"
 *   badge + summary text; expandable on click for review
 * - `future`: not rendered at all (parent controls this)
 *
 * Color accent is per-stage to disambiguate Stage 1 (top-3 set membership)
 * from Stage 2 (top-10 set membership) visually — both look very similar
 * card-wise, so the colored header is the primary cue.
 */
export type StageState = "active" | "complete";

const STAGE_ACCENT: Record<string, string> = {
  stage1: "border-l-primary",
  stage2: "border-l-sky-500",
  sectionC: "border-l-neutral-400",
  stage3: "border-l-accent",
  sectionE: "border-l-neutral-400",
};

const STAGE_DOT: Record<string, string> = {
  stage1: "bg-primary",
  stage2: "bg-sky-500",
  sectionC: "bg-neutral-400",
  stage3: "bg-accent",
  sectionE: "bg-neutral-400",
};

export function StageSection({
  stageKey,
  state,
  title,
  subtitle,
  badge,
  summary,
  children,
}: {
  stageKey: "stage1" | "stage2" | "sectionC" | "stage3" | "sectionE";
  state: StageState;
  title: string;
  subtitle?: string;
  /** Top-right badge: e.g. "Etapa 1 de 3" for active, "Completada" for complete */
  badge: string;
  /** Subtitle shown below the title when collapsed — usually completion summary */
  summary?: string;
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const isComplete = state === "complete";
  const showBody = state === "active" || expanded;
  const accent = STAGE_ACCENT[stageKey] ?? "border-l-muted";
  const dot = STAGE_DOT[stageKey] ?? "bg-muted-foreground";

  return (
    <section
      className={cn(
        "rounded-lg border bg-card border-l-4 transition-colors",
        accent,
        state === "active" && "shadow-sm"
      )}
    >
      <header
        className={cn(
          "flex items-center justify-between gap-3 px-5 py-3",
          isComplete && "cursor-pointer hover:bg-muted/30",
          showBody && "border-b"
        )}
        onClick={isComplete ? () => setExpanded((v) => !v) : undefined}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span
            className={cn(
              "inline-flex h-7 w-7 items-center justify-center rounded-full text-white text-xs font-semibold shrink-0",
              dot
            )}
            aria-hidden
          >
            {isComplete ? <Check className="h-4 w-4" /> : badgeNumber(stageKey)}
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold leading-tight truncate">{title}</h2>
            {subtitle && state === "active" && (
              <p className="text-xs text-muted-foreground leading-snug mt-0.5">
                {subtitle}
              </p>
            )}
            {summary && isComplete && (
              <p className="text-xs text-muted-foreground leading-snug mt-0.5">{summary}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isComplete ? (
            <>
              <Badge variant="muted" className="gap-1">
                <Lock className="h-3 w-3" />
                {badge}
              </Badge>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                aria-label={expanded ? "Contraer" : "Expandir"}
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded((v) => !v);
                }}
              >
                {expanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </>
          ) : (
            <Badge variant="accent">{badge}</Badge>
          )}
        </div>
      </header>
      {showBody && <div className="p-5">{children}</div>}
    </section>
  );
}

function badgeNumber(stageKey: string): string {
  switch (stageKey) {
    case "stage1":
      return "1";
    case "stage2":
      return "2";
    case "stage3":
      return "3";
    case "sectionC":
      return "·";
    case "sectionE":
      return "·";
    default:
      return "·";
  }
}
