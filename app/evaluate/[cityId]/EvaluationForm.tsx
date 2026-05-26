"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { PillarDisclosure } from "@/components/PillarDisclosure";
import { cn } from "@/lib/utils";
import { useT } from "@/app/LangProvider";
import type {
  Action,
  City,
  DiscardedAction,
  PolicyScore,
  FeasibilityScore,
  LegalAssessment,
} from "@/lib/fixtures";
import { SectionA } from "./SectionA";
import { SectionC } from "./SectionC";
import { SectionE } from "./SectionE";
import { StageRating, type RatingMap, COMMENT_REQUIRED_BELOW_LIKERT } from "./StageRating";
import { Stage3Reorder } from "./Stage3Reorder";
import { StageSection } from "./StageSection";
import { StageStepper } from "./StageStepper";
import { RevealStage } from "./RevealStage";
import { CityContextBanner } from "./CityContextBanner";
import { CityContextSidebar } from "./CityContextSidebar";
import { LegallyBlockedFootnote } from "./LegallyBlockedFootnote";
import { LangToggle } from "@/components/LangToggle";
import type { RankedAction, Stage } from "./page";

export type Initial = {
  evaluationId: string;
  currentStage: Stage;
  submitted: boolean;
  top3Ratings: RatingMap;
  top10Ratings: RatingMap;
  // Overall-agreement Likert (1–5) the expert submits on the reveal stages.
  // `null` until that reveal has been completed.
  top3Agreement: number | null;
  top10Agreement: number | null;
  // Optional free-text the expert writes alongside each agreement Likert.
  // Empty string when blank.
  top3AgreementComment: string;
  top10AgreementComment: string;
  missingActions: string[];
  reorderTop5: string[] | null;
  reorderComment: string;
  cityComment: string;
};

// Linear ordering of the stage pipeline. Used to compute stage state ("active"
// vs "complete") for the StageSection wrapper.
//
// The reveal stages sit AFTER stage3 (the blind reorder) so all three headline
// metrics — Precision@3, Precision@10, Spearman ρ — are collected before any
// LLM-rationale exposure. The reveals collect the post-rationale "informed
// agreement" Likerts as a complementary signal.
const STAGE_RANK: Record<Stage, number> = {
  stage1: 1,
  stage2: 2,
  sectionC: 3,
  stage3: 4,
  reveal1: 5,
  reveal2: 6,
  sectionE: 7,
  complete: 8,
};

const NEXT_STAGE: Record<Stage, Stage> = {
  stage1: "stage2",
  stage2: "sectionC",
  sectionC: "stage3",
  stage3: "reveal1",
  reveal1: "reveal2",
  reveal2: "sectionE",
  sectionE: "complete",
  complete: "complete",
};

// Top-of-page progress indicator. Three top-level chunks for the expert:
//   1. rate the top-3 (stage1)
//   2. rate the top-10 + missing actions (stage2 + sectionC)
//   3. reorder + see the model's reasoning + agreement + comment
//      (stage3 + reveal1 + reveal2 + sectionE)
// The two reveals belong with stage3 in step 3 because they're the post-blind
// "what does the model say?" moment.
function topLevelStageIndex(s: Stage): number {
  return {
    stage1: 1,
    stage2: 2,
    sectionC: 2,
    stage3: 3,
    reveal1: 3,
    reveal2: 3,
    sectionE: 3,
    complete: 3,
  }[s];
}

export function EvaluationForm({
  city,
  rankedActions,
  stage1Order,
  stage2Order,
  stage1ContextActions,
  stage2ContextActions,
  discardedLegal,
  allActions,
  cityPolicy,
  cityFeasibility,
  legalAssessments,
  initial,
}: {
  city: City;
  rankedActions: RankedAction[];
  stage1Order: RankedAction[];
  stage2Order: RankedAction[];
  stage1ContextActions: Action[];
  stage2ContextActions: Action[];
  discardedLegal: DiscardedAction[];
  allActions: Action[];
  cityPolicy: Record<string, PolicyScore>;
  cityFeasibility: Record<string, FeasibilityScore>;
  legalAssessments: Record<string, LegalAssessment>;
  initial: Initial;
}) {
  const actionMap = new Map(allActions.map((a) => [a.actionId, a]));
  const t = useT();
  const router = useRouter();
  const [currentStage, setCurrentStage] = useState<Stage>(initial.currentStage);
  const [top3Ratings, setTop3Ratings] = useState<RatingMap>(initial.top3Ratings);
  const [top10Ratings, setTop10Ratings] = useState<RatingMap>(initial.top10Ratings);
  const [top3Agreement, setTop3Agreement] = useState<number | null>(initial.top3Agreement);
  const [top10Agreement, setTop10Agreement] = useState<number | null>(initial.top10Agreement);
  const [top3AgreementComment, setTop3AgreementComment] = useState<string>(initial.top3AgreementComment);
  const [top10AgreementComment, setTop10AgreementComment] = useState<string>(initial.top10AgreementComment);
  const [missing, setMissing] = useState<string[]>(
    [...initial.missingActions, "", "", ""].slice(0, 3)
  );
  const [reorder, setReorder] = useState<string[] | null>(initial.reorderTop5);
  const [reorderComment, setReorderComment] = useState<string>(initial.reorderComment);
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
        [actionId]: {
          likert,
          notSure: prev[actionId]?.notSure ?? false,
          comment: prev[actionId]?.comment,
        },
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
  // Per-action comment alongside the Likert. We need the existing likert +
  // notSure to upsert through the same `rating` patch shape; if the user
  // somehow blurs the textarea before picking a Likert (the textarea is
  // disabled when there's no row yet, but be defensive), skip the patch.
  const commentBlurFor = (
    question: "top3" | "top10",
    target: typeof setTop3Ratings,
    source: RatingMap
  ) => (actionId: string, modelRank: number, comment: string) => {
    target((prev) => {
      const cur = prev[actionId];
      if (!cur) return prev;
      return { ...prev, [actionId]: { ...cur, comment } };
    });
    const cur = source[actionId];
    if (!cur) return;
    sendPatch({
      rating: {
        actionId,
        modelRank,
        question,
        likert: cur.likert,
        notSure: cur.notSure,
        comment: comment.slice(0, 1000),
      },
    });
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
  const onReorderCommentBlur = (next: string) => {
    setReorderComment(next);
    sendPatch({ reorderComment: next.slice(0, 1000) });
  };
  const onCommentBlur = (next: string) => {
    setComment(next);
    sendPatch({ cityComment: next.slice(0, 1000) });
  };
  const onTop3AgreementChange = (likert: number) => {
    setTop3Agreement(likert);
    sendPatch({ top3Agreement: likert });
  };
  const onTop10AgreementChange = (likert: number) => {
    setTop10Agreement(likert);
    sendPatch({ top10Agreement: likert });
  };
  const onTop3AgreementCommentBlur = (next: string) => {
    setTop3AgreementComment(next);
    sendPatch({ top3AgreementComment: next.slice(0, 1000) });
  };
  const onTop10AgreementCommentBlur = (next: string) => {
    setTop10AgreementComment(next);
    sendPatch({ top10AgreementComment: next.slice(0, 1000) });
  };

  // Comment-required gate for the symmetric set-membership rounds: any rating
  // strictly below `COMMENT_REQUIRED_BELOW_LIKERT` must carry a non-empty
  // comment before the expert can advance, so we capture the "why" on every
  // disagree / neutral judgement.
  const countMissingComments = (focus: RankedAction[], ratings: RatingMap) =>
    focus.filter((r) => {
      const row = ratings[r.action.actionId];
      if (!row || !row.likert) return false;
      if (row.likert >= COMMENT_REQUIRED_BELOW_LIKERT) return false;
      return !row.comment || row.comment.trim().length === 0;
    }).length;

  const validateCurrent = (): string | null => {
    // Blind set-membership rounds come first; reveals run AFTER stage3, so
    // their validations fire later in the pipeline.
    if (currentStage === "stage1") {
      const top3Actions = rankedActions.slice(0, 3);
      const missingCount = top3Actions.filter(
        (r) => !top3Ratings[r.action.actionId]?.likert
      ).length;
      if (missingCount > 0) return t("evaluate.validationMissingStage1");
      const missingComments = countMissingComments(top3Actions, top3Ratings);
      if (missingComments > 0) {
        return t("evaluate.validationMissingCommentsStage", { count: missingComments });
      }
    }
    if (currentStage === "stage2") {
      const missingCount = rankedActions.filter(
        (r) => !top10Ratings[r.action.actionId]?.likert
      ).length;
      if (missingCount > 0) return t("evaluate.validationMissingStage2");
      const missingComments = countMissingComments(rankedActions, top10Ratings);
      if (missingComments > 0) {
        return t("evaluate.validationMissingCommentsStage", { count: missingComments });
      }
    }
    if (currentStage === "reveal1") {
      if (top3Agreement == null) return t("evaluate.validationMissingReveal1");
    }
    if (currentStage === "reveal2") {
      if (top10Agreement == null) return t("evaluate.validationMissingReveal2");
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
    // Reveal stages need the LLM `explanation*` fields to be in the payload,
    // but those are gated server-side by currentStage (see page.tsx). When
    // the user crosses into reveal1 / reveal2 client-side, the rankedActions
    // prop still holds the stripped data from the initial render. Trigger a
    // server re-fetch so the now-allowed explanations flow into the tree
    // BEFORE we mount the reveal section — otherwise the user briefly sees
    // the templated band rationale ("Perfil agregado del modelo…") until
    // they reload manually.
    if (next === "reveal1" || next === "reveal2") {
      router.refresh();
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
    <main className="min-h-screen pb-32">
      <div className="max-w-6xl mx-auto px-6 pt-6">
        <header className="flex items-center justify-between gap-3 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")}>
            ← {t("common.back")}
          </Button>
          <div className="flex items-center gap-3 flex-1 justify-end">
            <StageStepper current={topLevelStageIndex(currentStage) as 1 | 2 | 3} />
            <AutosaveBadge state={autosaveState} />
            <LangToggle />
          </div>
        </header>

        {/* Mobile-only sticky banner. Desktop replaces this with the sticky sidebar below. */}
        <div className="lg:hidden mt-4">
          <CityContextBanner city={city} />
        </div>

        <div className="mt-4 lg:grid lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] xl:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:gap-8">
          {/* Desktop-only sticky sidebar with full city context. */}
          <aside className="hidden lg:block">
            {/* max-h subtracts both the 1.5rem top offset and the ~8rem fixed
                footer (same clearance as the page's pb-32) so the bottom of
                the scrollable sidebar isn't covered by the action bar. */}
            <div className="sticky top-6 max-h-[calc(100vh-11rem)] overflow-y-auto pr-1">
              <CityContextSidebar city={city} />
            </div>
          </aside>

          {/* Right (and mobile-only-bottom) column: pillars + stages. */}
          <div className="space-y-6">
            <PillarDisclosure variant="compact" />

            {/* Section A is mobile-only — desktop sidebar carries the same info. */}
            <div className="lg:hidden">
              <SectionA city={city} onContinue={() => {}} />
            </div>

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
          focusActions={stage1Order}
          contextActions={stage1ContextActions}
          ratings={top3Ratings}
          onRatingChange={ratingChangeFor("top3", setTop3Ratings)}
          onNotSureChange={notSureChangeFor("top3", setTop3Ratings, top3Ratings)}
          onCommentBlur={commentBlurFor("top3", setTop3Ratings, top3Ratings)}
          readOnly={stageState("stage1") === "complete"}
        />
      </StageSection>
      </SlideInOnMount>

      {/* Footnote: actions blocked by Chilean legal assessment for this city.
          Surfaced after Stage 1 so experts learn early about the legal filter
          and can mentally account for missing actions. */}
      {STAGE_RANK[currentStage] >= STAGE_RANK.stage2 && discardedLegal.length > 0 && (
        <LegallyBlockedFootnote discarded={discardedLegal} actionMap={actionMap} />
      )}

      {/* Stage 2 — top-10 set membership. Visible once Stage 1 advanced.
          BLIND: no rank order or LLM rationale exposed. */}
      {STAGE_RANK[currentStage] >= STAGE_RANK.stage2 && (
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
            focusActions={stage2Order}
            contextActions={stage2ContextActions}
            ratings={top10Ratings}
            onRatingChange={ratingChangeFor("top10", setTop10Ratings)}
            onNotSureChange={notSureChangeFor("top10", setTop10Ratings, top10Ratings)}
            onCommentBlur={commentBlurFor("top10", setTop10Ratings, top10Ratings)}
            readOnly={stageState("stage2") === "complete"}
          />
        </StageSection>
        </SlideInOnMount>
      )}

      {/* Section C — missing actions. Optional, blind. */}
      {STAGE_RANK[currentStage] >= STAGE_RANK.sectionC && (
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

      {/* Stage 3 — reorder. The model's rank order is shown by design (the
          starting position of the drag-reorder IS the model's order — that's
          baked into the Stage3Reorder component), but LLM rationale is NOT
          exposed. This is the LAST blind stage, after which the reveals fire. */}
      {STAGE_RANK[currentStage] >= STAGE_RANK.stage3 && (
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
            cityPolicy={cityPolicy}
            cityFeasibility={cityFeasibility}
            legalAssessments={legalAssessments}
            comment={reorderComment}
            onCommentBlur={onReorderCommentBlur}
          />
        </StageSection>
        </SlideInOnMount>
      )}

      {/* Reveal 1 — first time the LLM rationale is exposed. Shows the
          model's top-3 ordered with prose, asks an overall agreement Likert.
          Visible only once Stage 3 advanced. */}
      {STAGE_RANK[currentStage] >= STAGE_RANK.reveal1 && (
        <SlideInOnMount stageKey="reveal1">
        <StageSection
          stageKey="reveal1"
          state={stageState("reveal1")}
          title={t("evaluate.reveal1ShortTitle")}
          subtitle={stageState("reveal1") === "active" ? t("evaluate.reveal1Intro") : undefined}
          badge={
            stageState("reveal1") === "active"
              ? t("evaluate.stageCurrentBadge")
              : t("evaluate.stageCompletedBadge")
          }
          summary={
            top3Agreement != null
              ? t("evaluate.stageSummaryAgreement", { likert: top3Agreement })
              : t("evaluate.stageSummaryAgreementPending")
          }
        >
          <RevealStage
            actions={rankedActions.slice(0, 3)}
            agreement={top3Agreement}
            onChange={onTop3AgreementChange}
            comment={top3AgreementComment}
            onCommentBlur={onTop3AgreementCommentBlur}
            readOnly={stageState("reveal1") === "complete"}
          />
        </StageSection>
        </SlideInOnMount>
      )}

      {/* Reveal 2 — full top-10 ranking with LLM rationale + overall
          agreement Likert. Visible only once Reveal 1 advanced. */}
      {STAGE_RANK[currentStage] >= STAGE_RANK.reveal2 && (
        <SlideInOnMount stageKey="reveal2">
        <StageSection
          stageKey="reveal2"
          state={stageState("reveal2")}
          title={t("evaluate.reveal2ShortTitle")}
          subtitle={stageState("reveal2") === "active" ? t("evaluate.reveal2Intro") : undefined}
          badge={
            stageState("reveal2") === "active"
              ? t("evaluate.stageCurrentBadge")
              : t("evaluate.stageCompletedBadge")
          }
          summary={
            top10Agreement != null
              ? t("evaluate.stageSummaryAgreement", { likert: top10Agreement })
              : t("evaluate.stageSummaryAgreementPending")
          }
        >
          <RevealStage
            actions={rankedActions}
            agreement={top10Agreement}
            onChange={onTop10AgreementChange}
            comment={top10AgreementComment}
            onCommentBlur={onTop10AgreementCommentBlur}
            readOnly={stageState("reveal2") === "complete"}
          />
        </StageSection>
        </SlideInOnMount>
      )}

      {/* Section E — comments */}
      {STAGE_RANK[currentStage] >= STAGE_RANK.sectionE && (
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
          </div>
        </div>
      </div>

      <footer className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur p-4">
        <div className="max-w-6xl mx-auto flex flex-col gap-2">
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
