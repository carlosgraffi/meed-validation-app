# MEED+ — Track A Methodology (Final)

_Last updated: 2026-05-26 (commit `b674733`)_

This document describes the methodology actually implemented in the production app at
[meed-validation-app-production.up.railway.app](https://meed-validation-app-production.up.railway.app).
It supersedes the design notes in `CHANGES.md` (2026-05-13), which captured the
mid-cycle three-stage refactor; everything below incorporates the subsequent
adjustments through 2026-05-26.

---

## 1. What we measure

The model under evaluation (MEED+ HIAP v3) returns a ranked list of mitigation actions
per city. The expert panel validates the model along **two independent dimensions**:

| Signal | How it's collected | Stage |
|---|---|---|
| **Precision@3** | Symmetric Likert per action: "does this belong in the top 3?" | Stage 1 (blind) |
| **Precision@10** | Symmetric Likert per action: "does this belong in the top 10?" | Stage 2 (blind) |
| **Spearman ρ** | Drag-reorder of the top 5; correlation against model order | Stage 3 (rank visible, rationale blind) |
| **Informed agreement** | Single overall Likert after seeing model rationale | Reveal 1 (top-3) and Reveal 2 (top-10) |
| **Qualitative "why"** | Required comment when any rating < 4 (Strongly disagree / Disagree / Neutral) | Stages 1 + 2 |

The first three signals are **blind to the LLM-authored rationale by design** —
that's how we separate set-membership and ordering signal from rationale-driven
anchoring. Informed agreement is the complementary post-rationale signal.

CORFO headline metric: ≥75% match rate on Precision@3 and Precision@10.

---

## 2. Evaluation pipeline

The expert flow is a linear state machine with read-only history. Each step is
gated server-side; advancing past a step locks its inputs.

```
stage1  →  stage2  →  sectionC  →  stage3  →  reveal1  →  reveal2  →  sectionE  →  complete
```

Locked stages stay visible (so the expert can verify what they answered) but
disabled. The current stage is persisted on `Evaluation.currentStage` and every
`PATCH /api/eval/[cityId]` validates against it.

### 2.1 Stage 1 — Top-3 set membership (blind)

- Display: the 3 actions the model placed in its top 3, **in deterministically
  randomized order** (seeded by `sha256(evaluationId + cityId + "stage1")` →
  mulberry32 → Fisher–Yates).
- No rank is shown. No LLM rationale is shown.
- Inputs per action:
  - 5-point Likert ("Does this belong among the 3 priority actions for this city?")
  - "Not sure" checkbox (independent signal; carried into the export)
  - **Comment textarea** — optional for Likert ≥ 4, **required for Likert < 4**
- Context group: next 3 model actions (ranks 4–6), shown read-only as a
  reference of "what just missed the cut", **not rated**.

### 2.2 Stage 2 — Top-10 set membership (blind)

- Display: all 10 actions the model placed in its top 10, fresh deterministic
  randomization (seed includes `"stage2"`). Top-3 actions appear here too — they
  must be re-rated against the top-10 question. **No back-fill from Stage 1.**
- Same per-action controls (Likert + Not sure + required-on-disagree comment).
- Context group: 5 next actions (model ranks 11–15) shown read-only.

> **Why re-rate the top 3?** Symmetric questioning. The unique key in the
> `Rating` table is `(evaluationId, actionId, question)`, so the same action
> can carry independent top-3 and top-10 verdicts. Without this, P@10 would
> inherit "this is top-3-worthy" judgements from P@3 and the two metrics would
> not be independent.

### 2.3 Section C — Missing actions (blind, optional)

Free text, up to 3 entries: "any actions you expected to see in the top 10 that
the model didn't surface?" Captured per-row as a JSON array on
`Evaluation.missingActions`.

### 2.4 Stage 3 — Reorder top 5 (last blind stage)

- The model's rank is revealed alongside the action — **but the LLM rationale
  is still gated.** Reasoning surfaces in the cards are hidden until Reveal 1.
- The expert drags to reorder the 5 actions. Initial order = model order;
  custom order is persisted to `ReorderTop5.orderedActionIds` only if the
  expert changes it. "Restore the model order" button reverts.
- **Optional comment** at the bottom — "notes on your reorder" — so the expert
  can briefly explain a swap. Persisted to `Evaluation.reorderComment`.

This is the **last stage that contributes to the Spearman ρ headline signal**.
The reorder happens before the LLM rationale is exposed precisely so the rank
ordering reflects the expert's independent judgement, not their reaction to
the model's explanation.

### 2.5 Reveal 1 — Top-3 with explanations

- First time the LLM rationale is exposed. The 3 top-ranked actions are shown
  in the model's order with their `explanation*` rationale text rendered prose.
- One **overall agreement Likert (1–5)** for the ranking as a whole.
- Optional comment box, no required-on-disagree gate (the "why" is the
  rationale text itself — we're capturing reaction to that, not blind
  disagreement).
- Persisted on `Evaluation.top3Agreement` + `top3AgreementComment`.

### 2.6 Reveal 2 — Top-10 with explanations

Same shape as Reveal 1, for the full top-10 list. Captures `top10Agreement` +
`top10AgreementComment`.

### 2.7 Section E — City-level comment

Single 1000-char free-text field on the city overall. Optional. Submit moves
the evaluation to `complete`.

---

## 3. Pillars and weights

Centralized in `lib/pillars.ts`. The disclosure component reads from this
single source so every expert sees the same recipe (full variant in
onboarding, compact variant pinned above every evaluation).

| Pillar | Weight |
|---|---|
| Impact | **0.55** |
| Alignment | **0.22** |
| Feasibility | **0.23** |

These values track Amanda's `input_snapshot.json → resolved_weights` from the
standard MEED+ run config. Updating them is a one-line edit per pillar.

---

## 4. Bias controls and methodological safeguards

| Control | Implementation |
|---|---|
| **Rationale gating** | LLM explanations are not rendered in Stages 1, 2, 3, or Section C. The component check is `hasExplanation`: only when the explanation field is in the payload (set on the server only from Reveal 1 onward) is reasoning surfaced. Templated pillar-band fallbacks are hidden in the same gate. |
| **Symmetric questioning** | Stage 2 includes the top-3 actions, asked fresh against the top-10 question. No pre-fill from Stage 1. Independent rating rows in the DB. |
| **Deterministic randomization** | Card order in Stages 1 and 2 is randomized per `(evaluationId, cityId, stage)`. Same seed → same order across save/resume; no client/server drift. |
| **Read-only history** | Advancing past a stage locks its inputs and surfaces a banner. Server PATCH rejects rating writes for locked stages with HTTP 409. |
| **Required "why" on disagree** | For Stages 1 + 2, any rating with Likert < 4 (Strongly disagree, Disagree, Neutral) requires a non-empty comment to advance. Threshold lives in `COMMENT_REQUIRED_BELOW_LIKERT`. |
| **City anonymization (light)** | Real city names (Valdivia, Paillaco, Lago Ranco) are replaced with stable aliases (Ciudad A / B / C) on every expert-facing surface so prior knowledge of specific Chilean cities does not bias ratings. Mapping is hardcoded in `lib/city-aliases.ts`. Region, biome, emissions, and indicators are unchanged — this is *light* anonymization, not a blind study. Admin views still show real names. |

---

## 5. Data the experts see per city

Always-visible context (sticky sidebar on desktop, sticky banner on mobile,
full sheet behind "View full context"):

- **City alias** (Ciudad A/B/C) + region + total emissions + net-sink badge
  when applicable.
- **Sector-level emissions chart** — horizontal bar, 5 GPC sectors (stationary
  energy, transportation, waste, IPPU, AFOLU), absolute and percentage on
  hover. Negative sectors render as carbon-sink callouts.
- **Subsector breakdown** — grouped by parent sector, color-matched to the
  chart. Each subsector listed by its readable GPC name (e.g. "Residential
  buildings", "Agriculture, forestry & fishing activities") with the GPC code
  as a small secondary label. Compact variant on the sidebar, full variant in
  the drawer.
- **Headline indicators** — 4 hand-picked indicators per city (income,
  indigenous identification, dominant land-use share, electricity access);
  full indicator panel in the drawer.

Per action (cards in Stages 1, 2, 3 and the reveal stages):

- Localized name + description.
- Sector and subsector badges, color-tinted to match the bar chart palette so
  reviewers can trace an action's tag back to a band in the chart.
- GHG-reduction band, cost band, timeline band, co-benefit chips.
- LLM rationale rendered **only on the reveal stages** (rationale-gated above).

---

## 6. What we persist (and export)

Schema is in `prisma/schema.prisma`. The admin export at
`/api/admin/export` (admin-only, JSON download) emits the full row.

| Field | Source | Notes |
|---|---|---|
| `Rating.likert` (1–5) | Stage 1 + Stage 2 per (action, question) | Headline signal |
| `Rating.notSure` (bool) | Same row | Independent of Likert |
| `Rating.comment` | Same row | Required-on-disagree (Likert < 4) for Stages 1 + 2 |
| `Rating.modelRank` | Snapshotted at rating time | 1–10 |
| `Rating.question` | "top3" or "top10" | Part of the unique key — symmetric questioning |
| `Evaluation.missingActions` | Section C | JSON array of up to 3 strings |
| `ReorderTop5.orderedActionIds` | Stage 3 | JSON array of 5 actionIds, expert order |
| `Evaluation.reorderComment` | Stage 3 | Optional |
| `Evaluation.top3Agreement` (1–5) | Reveal 1 | Informed agreement on top-3 |
| `Evaluation.top3AgreementComment` | Reveal 1 | Optional |
| `Evaluation.top10Agreement` (1–5) | Reveal 2 | Informed agreement on top-10 |
| `Evaluation.top10AgreementComment` | Reveal 2 | Optional |
| `Evaluation.cityComment` | Section E | Optional |
| `Evaluation.currentStage` | Server | Reflects the stage gate |
| `Evaluation.submittedAt` | Submit action | Locks the entire evaluation |

All comments are 1000-char capped client + server side. Autosave is debounced
to 500ms and runs on every input change / blur, so an expert who closes the
tab loses at most one input. The autosave indicator surfaces "Saving / Saved /
Error" inline next to the language toggle.

---

## 7. Computed metrics

Pure functions in `lib/metrics.ts`, tested in `lib/metrics.test.ts`. The admin
dashboard's live preview reads through `lib/admin-metrics.ts`, which bridges
Prisma rows into the pure functions.

| Metric | Formula | Source rows |
|---|---|---|
| **Precision@3** | Fraction of expert top-3 ratings ≥ 4 (Agree or Strongly agree) | `Rating.question = "top3"` |
| **Precision@10** | Same threshold, top-10 question | `Rating.question = "top10"` |
| **Spearman ρ** | Rank correlation between expert order (`ReorderTop5`) and model order, per city | `ReorderTop5.orderedActionIds` |
| **Cities passing Precision@K** | Cities with P@K ≥ 0.75 | Both K = 3 and K = 10 |
| **Informed-agreement distributions** | Histogram of top3Agreement and top10Agreement Likerts | `Evaluation.top3Agreement`, `top10Agreement` |

The export carries the raw rating + reorder rows plus the computed metrics
block (`computedMetrics`), so downstream analysis can re-derive everything
without hitting the live DB.

---

## 8. Stratification and assignment

Deterministic, seeded matching in `lib/stratification.ts`. Each expert is
assigned 3–5 cities; each city collects 5–6 evaluations. The seed is derived
from the run identifier, so the assignment is reproducible. Admin can
reassign through the dashboard; the operation is idempotent and recorded on
the `Assignment` table.

---

## 9. Localization

All expert-facing copy lives in `locales/es.json` and `locales/en.json`.
The language toggle is a cookie-backed `useLang()` hook; switching language
updates client state optimistically and triggers a `router.refresh()` so
server-rendered text re-resolves. There are no inline Spanish strings in any
expert-facing component — every visible label flows through `t("...")`.

---

## 10. Auth and persistence (one-line summary)

Single-use magic-link tokens minted by the admin (no email provider). Tokens
are keyed by `expertId` and **do not encode the cityId**, so anonymization,
schema migrations, and copy changes never require re-minting links.

SQLite + Prisma, persisted on Railway's `/data` volume. The deploy startup
runs `prisma db push --skip-generate --accept-data-loss`, which adds nullable
columns (the route we've been on) without losing data.

---

## 11. Where to look in the code

| Concern | Files |
|---|---|
| Stage state machine | `app/evaluate/[cityId]/EvaluationForm.tsx`, `app/api/eval/[cityId]/route.ts` |
| Stage 1 / Stage 2 UI | `app/evaluate/[cityId]/StageRating.tsx` |
| Stage 3 reorder | `app/evaluate/[cityId]/Stage3Reorder.tsx` |
| Reveal stages | `app/evaluate/[cityId]/RevealStage.tsx` |
| Pillars and weights | `lib/pillars.ts`, `components/PillarDisclosure.tsx` |
| Sector palette + GPC mapping | `lib/sector-colors.ts` |
| Subsector breakdown | `app/evaluate/[cityId]/SubsectorBreakdown.tsx` |
| City anonymization | `lib/city-aliases.ts`, `app/LangProvider.tsx` (`useCityText`) |
| Comment-required threshold | `COMMENT_REQUIRED_BELOW_LIKERT` exported from `StageRating.tsx` |
| Metrics | `lib/metrics.ts`, `lib/metrics.test.ts`, `lib/admin-metrics.ts` |
| Stratification | `lib/stratification.ts`, `lib/stratification.test.ts` |
| Schema | `prisma/schema.prisma` |
| Admin export | `app/api/admin/export/route.ts` |

---

## 12. Open methodological decisions (not changed in this cycle)

For future reference — these were discussed and consciously left untouched:

- **The reveal stage stays.** We considered collapsing Reveal 1 + Reveal 2
  into the comments section to shorten the flow. Kept as-is because the
  reveals measure *informed agreement* — moving them would change what the
  signal means.
- **Heavy anonymization not done.** Emissions totals, sector mix, and the
  subsector breakdown are themselves fingerprints for anyone who knows Los
  Ríos. Light name-only anonymization reduces casual recognition; full
  blinding would require rotating URL tokens and scrubbing absolute numbers.
- **Comment-required threshold is 4.** "Less than Agree" requires a written
  reason. Tightening to "less than Strongly agree" (5) or loosening to
  "Disagree only" (< 3) is a one-line change to `COMMENT_REQUIRED_BELOW_LIKERT`.
