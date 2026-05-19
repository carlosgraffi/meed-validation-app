"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Sparkles, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/app/LangProvider";
import { useLang } from "@/app/LangProvider";

/**
 * Surfaces the LLM-generated rationale that comes back with each ranked
 * action from HIAP-MEED+. Collapsed by default — keeps the action card
 * compact when the expert is in scan mode, but is one click away from
 * the model's own reasoning when they want context.
 *
 * No numeric scores are revealed; the rationale is qualitative-only.
 */
export function ActionRationale({
  rationaleEs,
  rationaleEn,
}: {
  rationaleEs: string;
  rationaleEn: string;
}) {
  const t = useT();
  const [lang] = useLang();
  const [open, setOpen] = useState(false);
  const text = lang === "en" ? rationaleEn : rationaleEs;

  return (
    <div className="border-t border-dashed pt-3 mt-3">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        className="h-auto p-1 -ml-1 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <Sparkles className="h-3.5 w-3.5" aria-hidden />
        <span>{open ? t("evaluate.rationaleHide") : t("evaluate.rationaleShow")}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </Button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: "hidden" }}
          >
            <div className="mt-2 rounded-md bg-muted/40 p-3">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                {t("evaluate.rationaleLabel")}
              </div>
              <p className="text-xs leading-relaxed italic">{text}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
