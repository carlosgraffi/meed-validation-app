"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronDown, ChevronUp, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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
  badge: string;
  summary?: string;
  children: React.ReactNode;
}) {
  // For completed stages, default-collapse; user can toggle to expand.
  const [expanded, setExpanded] = useState(false);
  const isComplete = state === "complete";
  const showBody = state === "active" || expanded;
  const accent = STAGE_ACCENT[stageKey] ?? "border-l-muted";
  const dot = STAGE_DOT[stageKey] ?? "bg-muted-foreground";

  return (
    <motion.section
      layout
      className={cn(
        "rounded-lg border bg-card border-l-4 overflow-hidden",
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
      <AnimatePresence initial={false} mode="wait">
        {showBody && (
          <motion.div
            key={`${stageKey}-body`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0, x: -40 }}
            transition={{
              height: { duration: 0.32, ease: [0.4, 0, 0.2, 1] },
              opacity: { duration: 0.2 },
              x: { duration: 0.32, ease: [0.4, 0, 0.2, 1] },
            }}
            style={{ overflow: "hidden" }}
          >
            <div className="p-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
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
    default:
      return "·";
  }
}
