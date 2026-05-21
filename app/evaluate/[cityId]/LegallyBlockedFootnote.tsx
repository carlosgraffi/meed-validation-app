"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Scale, ChevronDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useT, useLang, useActionText } from "@/app/LangProvider";
import type { DiscardedAction, Action } from "@/lib/fixtures";

/**
 * Footnote that surfaces actions blocked by Chilean legal assessment for
 * this city. Surfacing this closes the "where's action X?" confusion gap
 * and gives experts something concrete to flag if they disagree with the
 * legal filter.
 *
 * Collapsed by default (one-line summary), expandable to a list.
 */
export function LegallyBlockedFootnote({
  discarded,
  actionMap,
}: {
  discarded: DiscardedAction[];
  actionMap: Map<string, Action>;
}) {
  const t = useT();
  const [lang] = useLang();
  const at = useActionText();
  const [open, setOpen] = useState(false);

  if (discarded.length === 0) return null;

  return (
    <Card className="border-dashed">
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <Scale className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" aria-hidden />
            <div>
              <h3 className="text-sm font-medium">{t("evaluate.legallyBlockedTitle")}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("evaluate.legallyBlockedIntro", { count: discarded.length })}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setOpen((v) => !v)}
            className="shrink-0 gap-1.5 text-xs"
          >
            {open
              ? t("evaluate.legallyBlockedToggleHide")
              : t("evaluate.legallyBlockedToggleShow")}
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
              aria-hidden
            />
          </Button>
        </div>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
              style={{ overflow: "hidden" }}
            >
              <ul className="space-y-2 pt-2 pl-6">
                {discarded.map((d) => {
                  const action = actionMap.get(d.actionId);
                  return (
                    <li key={d.actionId} className="text-xs leading-relaxed">
                      <span className="font-medium">
                        {action ? at.name(action) : d.actionId}
                      </span>
                      <span className="text-muted-foreground">
                        {" — "}
                        {lang === "en" ? d.reasonEn : d.reasonEs}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
