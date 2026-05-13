"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PillarDisclosure } from "@/components/PillarDisclosure";
import { cn, t } from "@/lib/utils";
import type { City } from "@/lib/fixtures";
import { SectionA } from "./SectionA";
import { SectionC } from "./SectionC";
import { SectionE } from "./SectionE";
import { StageRating, type RatingMap } from "./StageRating";
import { Stage3Reorder } from "./Stage3Reorder";
import type { RankedAction, Stage } from "./page";

export type Initial = {
  evaluationId: string;
  currentStage: Stage;
  submitted: boolean;
  top3Ratings: RatingMap;
  top10Ratings: RatingMap;
  missingActions: string[];
  reorderTop5: string[] | null;
  cityComment: string;
};

const STAGE_INDEX: Record<Stage, number> = {
  stage1: 1,
  stage2: 2,
  sectionC: 2,
  stage3: 3,
  sectionE: 3,
  complete: 3,
};

const NEXT_STAGE: Record<Stage, Stage> = {
  stage1: "stage2",
  stage2: "sectionC",
  sectionC: "stage3",
  stage3: "sectionE",
  sectionE: "complete",
  complete: "complete",
};

export function EvaluationForm({
  city,
  rankedActions,
  stage1Order,
  stage2Order,
  initial,
}: {
  city: City;
  rankedActions: RankedAction[];
  stage1Order: RankedAction[];
  stage2Order: RankedAction[];
  initial: Initial;
}) {
  const router = useRouter();
  const [currentStage, setCurrentStage] = useState<Stage>(initial.currentStage);
  const [top3Ratings, setTop3Ratings] = useState<RatingMap>(initial.top3Ratings);
  const [top10Ratings, setTop10Ratings] = useState<RatingMap>(initial.top10Ratings);
  const [missing, setMissing] = useState<string[]>(
    [...initial.missingActions, "", "", ""].slice(0, 3)
  );
  const [reorder, setReorder] = useState<string[] | null>(initial.reorderTop5);
  const [comment, setComment] = useState(initial.cityComment);
  const [autosaveState, setAutosaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [stageError, setStageError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Debounced patch helper.
  const patchTimer = useRef<NodeJS.Timeout | null>(null);
  const pending = useRef<Record<string, unknown>>({});
  const flushPending = async () => {
    if (patchTimer.current) {
      clearTimeout(patchTimer.current);
      patchTimer.current = null;
    }
    if (Object.keys(pending.current).length === 0) return;
    const body = pending.current;
    pending.current = {};
    await fetch(`/api/eval/${city.cityId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  };
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

  // Rating handlers — bound to the question being rated.
  const ratingChangeFor = (question: "top3" | "top10", target: typeof setTop3Ratings) =>
    (actionId: string, modelRank: number, likert: number) => {
      target((prev) => ({
        ...prev,
        [actionId]: { likert, notSure: prev[actionId]?.notSure ?? false },
      }));
      const current = (question === "top3" ? top3Ratings : top10Ratings)[actionId];
      sendPatch({
        rating: { actionId, modelRank, question, likert, notSure: current?.notSure ?? false },
      });
    };
  const notSureChangeFor = (
    question: "top3" | "top10",
    target: typeof setTop3Ratings,
    source: RatingMap
  ) => (actionId: string, modelRank: number, notSure: boolean) => {
    target((prev) => {
      const cur = prev[actionId];
      if (!cur) return prev;
      return { ...prev, [actionId]: { ...cur, notSure } };
    });
    if (source[actionId]) {
      sendPatch({
        rating: { actionId, modelRank, question, likert: source[actionId].likert, notSure },
      });
    }
  };

  // Section C/E persistence.
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

  // Validation per stage advance.
  const validateCurrent = (): string | null => {
    if (currentStage === "stage1") {
      const top3Actions = rankedActions.slice(0, 3);
      const missingCount = top3Actions.filter(
        (r) => !top3Ratings[r.action.actionId]?.likert
      ).length;
      if (missingCount > 0) return t("evaluate.validationMissingStage1");
    }
    if (currentStage === "stage2") {
      const missingCount = rankedActions.filter(
        (r) => !top10Ratings[r.action.actionId]?.likert
      ).length;
      if (missingCount > 0) return t("evaluate.validationMissingStage2");
    }
    // sectionC, stage3, sectionE are optional → no blocking validation.
    return null;
  };

  const advanceStage = async () => {
    setStageError(null);
    const err = validateCurrent();
    if (err) {
      setStageError(err);
      return;
    }
    setBusy(true);
    await flushPending();
    const next = NEXT_STAGE[currentStage];
    const res = await fetch(`/api/eval/${city.cityId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ advanceTo: next }),
    });
    setBusy(false);
    if (!res.ok) {
      setStageError(t("common.error"));
      return;
    }
    setCurrentStage(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submitFinal = async () => {
    setStageError(null);
    setBusy(true);
    await flushPending();
    const res = await fetch(`/api/eval/${city.cityId}/submit`, { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setStageError(data.error ?? t("common.error"));
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  };

  const stageIndex = STAGE_INDEX[currentStage];
  const stageDone = (s: Stage) => stageRank(currentStage) > stageRank(s);
  const isReadOnly = (s: Stage) => initial.submitted || stageDone(s);

  return (
    <main className="min-h-screen p-6 max-w-4xl mx-auto space-y-6 pb-32">
      <header className="flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")}>
          ← {t("common.back")}
        </Button>
        <div className="flex items-center gap-3">
          <StageProgressIndicator current={stageIndex} />
          <AutosaveBadge state={autosaveState} />
        </div>
      </header>

      <PillarDisclosure variant="compact" />

      <SectionA city={city} onContinue={() => {}} />

      {/* Stage 1 — top-3 set membership */}
      <StageBlock readOnly={isReadOnly("stage1")}>
        <StageRating
          question="top3"
          actions={stage1Order}
          ratings={top3Ratings}
          onRatingChange={ratingChangeFor("top3", setTop3Ratings)}
          onNotSureChange={notSureChangeFor("top3", setTop3Ratings, top3Ratings)}
          readOnly={isReadOnly("stage1")}
        />
      </StageBlock>

      {/* Stage 2 — top-10 set membership (visible only once stage 1 advanced) */}
      {stageRank(currentStage) >= 2 && (
        <StageBlock readOnly={isReadOnly("stage2")}>
          <StageRating
            question="top10"
            actions={stage2Order}
            ratings={top10Ratings}
            onRatingChange={ratingChangeFor("top10", setTop10Ratings)}
            onNotSureChange={notSureChangeFor("top10", setTop10Ratings, top10Ratings)}
            readOnly={isReadOnly("stage2")}
          />
        </StageBlock>
      )}

      {/* Section C — missing actions (between Stage 2 and Stage 3) */}
      {stageRank(currentStage) >= 3 && (
        <StageBlock readOnly={isReadOnly("sectionC")}>
          <SectionC missing={missing} onChange={onMissingBlur} disabled={isReadOnly("sectionC")} />
        </StageBlock>
      )}

      {/* Stage 3 — reorder top 5 (ranks revealed) */}
      {stageRank(currentStage) >= 4 && (
        <StageBlock readOnly={isReadOnly("stage3")}>
          <Stage3Reorder
            modelTop5={rankedActions.slice(0, 5)}
            customOrder={reorder}
            onChange={onReorder}
            onReset={onReorderReset}
            readOnly={isReadOnly("stage3")}
          />
        </StageBlock>
      )}

      {/* Section E — comments */}
      {stageRank(currentStage) >= 5 && (
        <StageBlock readOnly={isReadOnly("sectionE")}>
          <SectionE comment={comment} onBlur={onCommentBlur} disabled={isReadOnly("sectionE")} />
        </StageBlock>
      )}

      <footer className="fixed bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur p-4">
        <div className="max-w-4xl mx-auto flex flex-col gap-2">
          {stageError && <p className="text-sm text-destructive">{stageError}</p>}
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {currentStage === "stage1" && progressLabel(top3Ratings, rankedActions.slice(0, 3))}
              {currentStage === "stage2" && progressLabel(top10Ratings, rankedActions)}
            </p>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => router.push("/dashboard")}
                disabled={busy || initial.submitted}
              >
                {t("evaluate.footerSaveLater")}
              </Button>
              {currentStage === "sectionE" ? (
                <Button onClick={submitFinal} disabled={busy || initial.submitted}>
                  {busy ? t("common.saving") : t("evaluate.footerSubmit")}
                </Button>
              ) : currentStage === "complete" ? (
                <Button disabled>{t("evaluate.footerSubmit")}</Button>
              ) : (
                <Button onClick={advanceStage} disabled={busy || initial.submitted}>
                  {busy ? t("common.saving") : t("evaluate.stageContinue")}
                </Button>
              )}
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}

// Rank within the linear stage sequence. 1=stage1, 2=stage2, 3=sectionC, 4=stage3, 5=sectionE, 6=complete.
function stageRank(s: Stage): number {
  return { stage1: 1, stage2: 2, sectionC: 3, stage3: 4, sectionE: 5, complete: 6 }[s];
}

function StageBlock({
  readOnly,
  children,
}: {
  readOnly: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      {readOnly && (
        <Card className="border-muted bg-muted/30">
          <CardContent className="p-3 text-xs text-muted-foreground">
            {t("evaluate.stageReadOnlyBanner")}
          </CardContent>
        </Card>
      )}
      {children}
    </section>
  );
}

function StageProgressIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className="text-muted-foreground">{t("evaluate.stageProgress", { current })}</span>
      <span className="flex items-center gap-1 ml-1">
        {[1, 2, 3].map((n) => (
          <span
            key={n}
            className={cn(
              "h-1.5 w-6 rounded-full",
              n <= current ? "bg-primary" : "bg-muted"
            )}
            aria-hidden
          />
        ))}
      </span>
    </div>
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

function progressLabel(ratings: RatingMap, actions: RankedAction[]): string {
  const rated = actions.filter((r) => ratings[r.action.actionId]?.likert >= 1).length;
  return `${rated}/${actions.length}`;
}
