"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, t } from "@/lib/utils";
import type { Action, City } from "@/lib/fixtures";
import { SectionA } from "./SectionA";
import { SectionB } from "./SectionB";
import { SectionC } from "./SectionC";
import { SectionD } from "./SectionD";
import { SectionE } from "./SectionE";

export type RankedAction = { rank: number; action: Action };

export type Initial = {
  evaluationId: string;
  submitted: boolean;
  ratings: Record<string, { likert: number; notSure: boolean }>;
  missingActions: string[];
  reorderTop5: string[] | null;
  cityComment: string;
};

export function EvaluationForm({
  city,
  rankedActions,
  initial,
}: {
  city: City;
  rankedActions: RankedAction[];
  initial: Initial;
}) {
  const router = useRouter();
  const [ratings, setRatings] = useState(initial.ratings);
  const [missing, setMissing] = useState<string[]>(
    [...initial.missingActions, "", "", ""].slice(0, 3)
  );
  const [reorder, setReorder] = useState<string[] | null>(initial.reorderTop5);
  const [comment, setComment] = useState(initial.cityComment);
  const [autosaveState, setAutosaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showResumeNotice, setShowResumeNotice] = useState(
    Object.keys(initial.ratings).length > 0 && !initial.submitted
  );

  // Debounced patch helper
  const patchTimer = useRef<NodeJS.Timeout | null>(null);
  const pending = useRef<Record<string, unknown>>({});
  const sendPatch = (fields: Record<string, unknown>) => {
    Object.assign(pending.current, fields);
    if (patchTimer.current) clearTimeout(patchTimer.current);
    patchTimer.current = setTimeout(async () => {
      const body = pending.current;
      pending.current = {};
      setAutosaveState("saving");
      const res = await fetch(`/api/eval/${city.cityId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setAutosaveState(res.ok ? "saved" : "error");
      if (res.ok) {
        setTimeout(
          () => setAutosaveState((s) => (s === "saved" ? "idle" : s)),
          1500
        );
      }
    }, 500);
  };

  const onRatingChange = (actionId: string, modelRank: number, likert: number) => {
    setRatings((prev) => ({
      ...prev,
      [actionId]: { likert, notSure: prev[actionId]?.notSure ?? false },
    }));
    sendPatch({
      rating: { actionId, modelRank, likert, notSure: ratings[actionId]?.notSure ?? false },
    });
  };
  const onNotSureChange = (actionId: string, modelRank: number, notSure: boolean) => {
    setRatings((prev) => {
      const cur = prev[actionId];
      if (!cur) return prev; // can't mark notSure before rating
      return { ...prev, [actionId]: { ...cur, notSure } };
    });
    if (ratings[actionId]) {
      sendPatch({
        rating: { actionId, modelRank, likert: ratings[actionId].likert, notSure },
      });
    }
  };

  const onMissingBlur = (next: string[]) => {
    setMissing(next);
    sendPatch({ missingActions: next.filter((s) => s.trim().length > 0).slice(0, 3) });
  };

  const onReorder = (next: string[]) => {
    setReorder(next);
    sendPatch({ reorderTop5: next });
  };
  const onReorderReset = () => {
    setReorder(null);
    sendPatch({ reorderTop5: null });
  };

  const onCommentBlur = (next: string) => {
    setComment(next);
    sendPatch({ cityComment: next.slice(0, 1000) });
  };

  const ratedCount = useMemo(
    () =>
      rankedActions.filter((r) => ratings[r.action.actionId]?.likert >= 1).length,
    [ratings, rankedActions]
  );
  const missingFromRating = rankedActions.length - ratedCount;

  const onSubmit = async () => {
    setSubmitError(null);
    if (missingFromRating > 0) {
      setSubmitError(t("evaluate.validationMissingRatings", { count: missingFromRating }));
      return;
    }
    setSubmitting(true);
    // Flush any pending patch first.
    if (patchTimer.current) {
      clearTimeout(patchTimer.current);
      if (Object.keys(pending.current).length > 0) {
        await fetch(`/api/eval/${city.cityId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(pending.current),
        });
        pending.current = {};
      }
    }
    const res = await fetch(`/api/eval/${city.cityId}/submit`, {
      method: "POST",
    });
    setSubmitting(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setSubmitError(data.error ?? t("common.error"));
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  };

  // Anchored scroll to section B
  const sectionBRef = useRef<HTMLElement>(null);
  const scrollToB = () => {
    sectionBRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <main className="min-h-screen p-6 max-w-4xl mx-auto space-y-8 pb-32">
      <header className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")}>
          ← {t("common.back")}
        </Button>
        <AutosaveBadge state={autosaveState} />
      </header>

      {showResumeNotice && (
        <Card className="border-accent bg-accent/5">
          <CardContent className="p-3 text-sm">
            {t("evaluate.resumeNotice")}{" "}
            <button
              className="underline text-xs ml-2 text-muted-foreground"
              onClick={() => setShowResumeNotice(false)}
            >
              ×
            </button>
          </CardContent>
        </Card>
      )}

      <SectionA city={city} onContinue={scrollToB} />

      <section ref={sectionBRef}>
        <SectionB
          rankedActions={rankedActions}
          ratings={ratings}
          onRatingChange={onRatingChange}
          onNotSureChange={onNotSureChange}
          disabled={initial.submitted}
        />
      </section>

      <SectionC missing={missing} onChange={onMissingBlur} disabled={initial.submitted} />

      <SectionD
        modelTop5={rankedActions.slice(0, 5).map((r) => r.action)}
        customOrder={reorder}
        onChange={onReorder}
        onReset={onReorderReset}
        disabled={initial.submitted}
      />

      <SectionE comment={comment} onBlur={onCommentBlur} disabled={initial.submitted} />

      <footer className="fixed bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur p-4">
        <div className="max-w-4xl mx-auto flex flex-col gap-2">
          {submitError && <p className="text-sm text-destructive">{submitError}</p>}
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {ratedCount}/{rankedActions.length} acciones evaluadas
            </p>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => router.push("/dashboard")}
                disabled={submitting || initial.submitted}
              >
                {t("evaluate.footerSaveLater")}
              </Button>
              <Button onClick={onSubmit} disabled={submitting || initial.submitted}>
                {submitting ? t("common.saving") : t("evaluate.footerSubmit")}
              </Button>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}

function AutosaveBadge({ state }: { state: "idle" | "saving" | "saved" | "error" }) {
  if (state === "idle") return null;
  const label =
    state === "saving"
      ? t("common.saving")
      : state === "saved"
      ? t("evaluate.autosaveLabel")
      : t("common.error");
  return (
    <span
      className={cn(
        "text-xs",
        state === "error" ? "text-destructive" : "text-muted-foreground"
      )}
      aria-live="polite"
    >
      {label}
    </span>
  );
}
