"use client";

import { motion } from "motion/react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/app/LangProvider";

/**
 * Three-step pagination indicator: Top 3 → Top 10 → Order.
 *
 * Implementation note: do NOT put `layout` on the indicators. The current
 * step has an infinite scale pulse, and `layout` interprets every pulse
 * frame as a layout change to animate against — visually that came out as
 * the number sliding sideways endlessly.
 */
const STAGE_COLORS = ["primary", "sky", "accent"] as const;

const COLOR_CLASSES: Record<
  (typeof STAGE_COLORS)[number],
  { bg: string; ring: string; text: string }
> = {
  primary: { bg: "bg-primary", ring: "ring-primary/30", text: "text-primary" },
  sky: { bg: "bg-sky-500", ring: "ring-sky-500/30", text: "text-sky-600" },
  accent: { bg: "bg-accent", ring: "ring-accent/30", text: "text-accent-foreground" },
};

export function StageStepper({ current }: { current: 1 | 2 | 3 }) {
  const t = useT();
  const labels = [t("evaluate.stepperLabel1"), t("evaluate.stepperLabel2"), t("evaluate.stepperLabel3")];
  return (
    <div className="flex items-center gap-2 w-full max-w-sm">
      {labels.map((label, idx) => {
        const stepNum = idx + 1;
        const state =
          stepNum < current ? "past" : stepNum === current ? "current" : "future";
        const color = STAGE_COLORS[idx];
        const cls = COLOR_CLASSES[color];
        return (
          <div key={label} className="flex items-center flex-1 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <Indicator state={state} stepNum={stepNum} cls={cls} />
              <span
                className={cn(
                  "text-xs font-medium truncate transition-colors",
                  state === "future" && "text-muted-foreground",
                  state === "current" && cls.text,
                  state === "past" && "text-muted-foreground"
                )}
              >
                {label}
              </span>
            </div>
            {idx < labels.length - 1 && (
              <div className="flex-1 mx-2 h-px bg-border relative overflow-hidden">
                <motion.div
                  className={cn("absolute inset-y-0 left-0", cls.bg)}
                  initial={false}
                  animate={{ width: state === "past" ? "100%" : "0%" }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Indicator({
  state,
  stepNum,
  cls,
}: {
  state: "past" | "current" | "future";
  stepNum: number;
  cls: { bg: string; ring: string; text: string };
}) {
  if (state === "past") {
    return (
      <div
        className={cn(
          "h-6 w-6 rounded-full flex items-center justify-center text-white shrink-0",
          cls.bg
        )}
      >
        <Check className="h-3.5 w-3.5" />
      </div>
    );
  }
  if (state === "current") {
    return (
      <div
        className={cn(
          "h-6 w-6 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0 ring-4",
          cls.bg,
          cls.ring
        )}
      >
        {stepNum}
      </div>
    );
  }
  return (
    <div className="h-6 w-6 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center text-muted-foreground text-xs font-medium shrink-0">
      {stepNum}
    </div>
  );
}
