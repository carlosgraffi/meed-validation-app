"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { PillarDisclosure } from "@/components/PillarDisclosure";
import { cn } from "@/lib/utils";
import { useT } from "@/app/LangProvider";
import type { City } from "@/lib/fixtures";
import { SectionA } from "./SectionA";
import { SectionC } from "./SectionC";
import { SectionE } from "./SectionE";
import { StageRating, type RatingMap } from "./StageRating";
import { Stage3Reorder } from "./Stage3Reorder";
import { StageSection } from "./StageSection";
import { StageStepper } from "./StageStepper";
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

// Linear ordering of the stage pipeline. Used to compute stage state ("active"
// vs "complete") for the StageSection wrapper.
const STAGE_RANK: Record<Stage, number> = {
  stage1: 1,
  stage2: 2,
  sectionC: 3,
  stage3: 4,
  sectionE: 5,
  complete: 6,
};

const NEXT_STAGE: Record<Stage, Stage> = {
  stage1: "stage2",
  stage2: "sectionC",
  sectionC: "stage3",
  stage3: "sectionE",
  sectionE: "complete",
  complete: "complete",
};

// Top-of-page progress indicator. 3 dots for Stage 1/2/3; Sections C/E
// are minor side-tasks that don't get their own dot, but they do count
// toward the overall progress when displayed in the badge.
function topLevelStageIndex(s: Stage): number {
  return { stage1: 1, stage2: 2, sectionC: 2, stage3: 3, sectionE: 3, complete: 3 }[s];
}

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
  const t = useT();
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
    // Scroll the newly-active section into view at the top of the viewport.
    // Wait one frame so the new section is in the DOM before we measure it.
    requestAnimationFrame(() => {
      const el = document.getElementById(`stage-${next}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
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

  const stageState = (s: Stage): "active" | "complete" =>
    STAGE_RANK[currentStage] > STAGE_RANK[s] ? "complete" : "active";

  // Summary strings for collapsed stage headers.
  const stage1Rated = Object.values(top3Ratings).filter((r) => r.likert >= 1).length;
  const stage2Rated = Object.values(top10Ratings).filter((r) => r.likert >= 1).length;
  const missingFilled = missing.filter((s) => s.trim().length > 0).length;

  return (
    <main className="min-h-screen p-6 max-w-4xl mx-auto space-y-6 pb-32">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")}>
          ← {t("common.back")}
        </Button>
        <div className="flex items-center gap-3 flex-1 justify-end">
          <StageStepper current={topLevelStageIndex(currentStage) as 1 | 2 | 3} />
          <AutosaveBadge state={autosaveState} />
        </div>
      </header>

      <PillarDisclosure variant="compact" />

      <SectionA city={city} onContinue={() => {}} />

      {/* Stage 1 — top-3 set membership */}
      <SlideInOnMount stageKey="stage1">
      <StageSection
        stageKey="stage1"
        state={stageState("stage1")}
        title={t("evaluate.stage1ShortTitle")}
        subtitle={stageState("stage1") === "active" ? t("evaluate.stage1Intro") : undefined}
        badge={
          stageState("stage1") === "active"
            ? t("evaluate.stageCurrentBadge")
            : t("evaluate.stageCompletedBadge")
        }
        summary={t("evaluate.stageSummaryRatings", {
          rated: stage1Rated,
          total: 3,
        })}
      >
        <StageRating
          question="top3"
          actions={stage1Order}
          ratings={top3Ratings}
          onRatingChange={ratingChangeFor("top3", setTop3Ratings)}
          onNotSureChange={notSureChangeFor("top3", setTop3Ratings, top3Ratings)}
          readOnly={stageState("stage1") === "complete"}
        />
      </StageSection>
      </SlideInOnMount>

      {/* Stage 2 — top-10 set membership (visible only once Stage 1 advanced) */}
      {STAGE_RANK[currentStage] >= 2 && (
        <SlideInOnMount stageKey="stage2">
        <StageSection
          stageKey="stage2"
          state={stageState("stage2")}
          title={t("evaluate.stage2ShortTitle")}
          subtitle={stageState("stage2") === "active" ? t("evaluate.stage2Intro") : undefined}
          badge={
            stageState("stage2") === "active"
              ? t("evaluate.stageCurrentBadge")
              : t("evaluate.stageCompletedBadge")
          }
          summary={t("evaluate.stageSummaryRatings", {
            rated: stage2Rated,
            total: 10,
          })}
        >
          <StageRating
            question="top10"
            actions={stage2Order}
            ratings={top10Ratings}
            onRatingChange={ratingChangeFor("top10", setTop10Ratings)}
            onNotSureChange={notSureChangeFor("top10", setTop10Ratings, top10Ratings)}
            readOnly={stageState("stage2") === "complete"}
          />
        </StageSection>
        </SlideInOnMount>
      )}

      {/* Section C — missing actions */}
      {STAGE_RANK[currentStage] >= 3 && (
        <SlideInOnMount stageKey="sectionC">
        <StageSection
          stageKey="sectionC"
          state={stageState("sectionC")}
          title={t("evaluate.sectionCShortTitle")}
          subtitle={stageState("sectionC") === "active" ? t("evaluate.sectionCsubtitle") : undefined}
          badge={
            stageState("sectionC") === "active"
              ? t("common.optional")
              : t("evaluate.stageCompletedBadge")
          }
          summary={t("evaluate.stageSummaryMissing", { count: missingFilled })}
        >
          <SectionC
            missing={missing}
            onChange={onMissingBlur}
            disabled={stageState("sectionC") === "complete"}
          />
        </StageSection>
        </SlideInOnMount>
      )}

      {/* Stage 3 — reorder */}
      {STAGE_RANK[currentStage] >= 4 && (
        <SlideInOnMount stageKey="stage3">
        <StageSection
          stageKey="stage3"
          state={stageState("stage3")}
          title={t("evaluate.stage3ShortTitle")}
          subtitle={stageState("stage3") === "active" ? t("evaluate.stage3Intro") : undefined}
          badge={
            stageState("stage3") === "active"
              ? t("evaluate.stageCurrentBadge")
              : t("evaluate.stageCompletedBadge")
          }
          summary={t("evaluate.stageSummaryReorder", {
            state: reorder
              ? t("evaluate.stageSummaryReorderModified")
              : t("evaluate.stageSummaryReorderUnchanged"),
          })}
        >
          <Stage3Reorder
            modelTop5={rankedActions.slice(0, 5)}
            customOrder={reorder}
            onChange={onReorder}
            onReset={onReorderReset}
            readOnly={stageState("stage3") === "complete"}
          />
        </StageSection>
        </SlideInOnMount>
      )}

      {/* Section E — comments */}
      {STAGE_RANK[currentStage] >= 5 && (
        <SlideInOnMount stageKey="sectionE">
        <StageSection
          stageKey="sectionE"
          state={stageState("sectionE")}
          title={t("evaluate.sectionEShortTitle")}
          subtitle={stageState("sectionE") === "active" ? t("evaluate.sectionEsubtitle") : undefined}
          badge={
            stageState("sectionE") === "active"
              ? t("common.optional")
              : t("evaluate.stageCompletedBadge")
          }
          summary={t("evaluate.stageSummaryComment", {
            state:
              comment.trim().length > 0
                ? t("evaluate.stageSummaryCommentFilled")
                : t("evaluate.stageSummaryCommentEmpty"),
          })}
        >
          <SectionE
            comment={comment}
            onBlur={onCommentBlur}
            disabled={stageState("sectionE") === "complete"}
          />
        </StageSection>
        </SlideInOnMount>
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

/**
 * Wraps each stage section with a "slide in from the right" entrance
 * animation that fires on first mount. Sections don't unmount in normal
 * forward flow (they collapse to a summary instead), so no exit animation
 * is needed — and removing the surrounding AnimatePresence/LayoutGroup
 * eliminated the infinite-loop layout fight that was happening with the
 * stepper pulse.
 *
 * The wrapper also carries the id used by advanceStage's scrollIntoView,
 * so each section is individually focusable on stage advance.
 */
function SlideInOnMount({
  stageKey,
  children,
}: {
  stageKey: Stage | "sectionC" | "sectionE";
  children: React.ReactNode;
}) {
  return (
    <motion.div
      id={`stage-${stageKey}`}
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

function AutosaveBadge({ state }: { state: "idle" | "saving" | "saved" | "error" }) {
  const t = useT();
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
