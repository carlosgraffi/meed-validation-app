# 2026-05-13 — Three-stage methodology refactor

Implements the post-2026-05-12 alignment with the engineering team (Mirco, Ayinawu, Amanda) captured in the project's Notion methodology page. The single positional Likert was conflating set membership and ordering; the new flow separates Precision@K (set membership, top 3 + top 10) from Spearman ρ (order within top 5), and front-loads the model's pillar weights so experts evaluate against the model's actual recipe.

## Summary

- **Hazards dropped.** MEED+ is mitigation-only. `topHazards` field, the `<SectionA>` chips, the `hazards.*` locale block, and the Zod schema entry are all gone. Only a single explanatory comment in `lib/fixtures.ts` mentions hazards (documenting *why* they're absent).
- **Three-stage paginated evaluation.** Stage 1 (top-3 set membership, ranks hidden), Stage 2 (top-10 set membership, ranks still hidden, top-3 actions re-rated against the top-10 question for symmetric scoring), Stage 3 (drag-reorder top 5, ranks finally revealed). Sections C (missing actions) and E (comments) sit between Stage 2/3 and after Stage 3 respectively.
- **Read-only history.** Once an expert advances past a stage, it's locked. UI disables inputs and shows a banner; API enforces it with stage-rank guards on every PATCH.
- **Deterministic randomization.** Cards in Stage 1 and Stage 2 are shuffled per `(evaluationId, cityId, stageNumber)` so save/resume returns the same order on every load. Helper at `lib/randomize.ts`.
- **Pillar disclosure.** Full variant in onboarding (proportional weight bars + definitions). Compact variant pinned above every city eval. Placeholder weights live in `lib/pillars.ts` (Impact 0.55 / Alignment 0.22 / Feasibility 0.23) — swap is a one-line edit per pillar.
- **Both metrics carry headline weight.** Admin live preview shows Precision@3 and Precision@10 with equal prominence, with `citiesPassingTop3` and `citiesPassingTop10` side-by-side. Export retains both, including the per-rating `question` column.

## Files touched

- **Schema:** `prisma/schema.prisma` — `Rating.question`, `@@unique([evaluationId, actionId, question])`, `Evaluation.currentStage`
- **Fixtures:** `data/cities.json`, `lib/fixtures.ts` — drop `topHazards`
- **Pillars:** `lib/pillars.ts` (new), `components/PillarDisclosure.tsx` (new, full + compact)
- **Locale:** `locales/es.json` — stage prompts, pillar block, read-only banner; hazard block removed
- **Metrics:** `lib/metrics.ts` (rewritten to filter by `question`, add `citiesPassingTop10`), `lib/metrics.test.ts` (rewritten, 16 tests; covers both questions, the miss/match case, partial completion)
- **Admin bridge:** `lib/admin-metrics.ts` — pass `question` through
- **Evaluate flow:** `app/evaluate/[cityId]/page.tsx`, `EvaluationForm.tsx`, `StageRating.tsx` (new — shared by Stages 1+2), `Stage3Reorder.tsx` (replaces SectionD), `SectionA.tsx` (hazard chips removed); `SectionB.tsx` and `SectionD.tsx` deleted; `SectionC.tsx` and `SectionE.tsx` retained
- **API:** `app/api/eval/[cityId]/route.ts` (PATCH accepts `question`, validates against stage lock, accepts `advanceTo`); `app/api/eval/[cityId]/submit/route.ts` (validates both top-3 and top-10 coverage)
- **Admin:** `app/admin/MetricsPreview.tsx` (P@10 equal-weight tile + table column); `app/api/admin/export/route.ts` (per-rating `question` + per-eval `currentStage`)
- **Onboarding:** `app/onboarding/OnboardingForm.tsx` — `<PillarDisclosure variant="full" />` mounted as a new section

## Schema "migration"

The project deploys via `prisma db push --accept-data-loss` rather than formal migration files (see `nixpacks.toml` and `railway.toml`). No `prisma/migrations/*` directory is created. Local + Railway redeploy reapplies the schema cleanly. **Deviation from the brief**, flagged here: a formal migration filename does not exist. The schema diff is:

```
ALTER TABLE Evaluation  ADD COLUMN currentStage TEXT NOT NULL DEFAULT 'stage1';
ALTER TABLE Rating      ADD COLUMN question     TEXT NOT NULL;
DROP   INDEX Rating_evaluationId_actionId_key;
CREATE UNIQUE INDEX Rating_evaluationId_actionId_question_key
       ON Rating(evaluationId, actionId, question);
```

The local SQLite was wiped and reseeded; in production this will run on the next Railway deploy.

## Design calls

| Call | Choice | Why |
|---|---|---|
| Stages 1 and 2 — one component or two? | **One** (`StageRating.tsx` with a `question` prop) | Cards are identical; only the prompt and action list differ. Single source of truth for the card layout. |
| Pillar labels in `pillars.ts` (per brief) or in `locales/es.json`? | **Locale**, deviating from the brief | Keeps the project-wide invariant that every expert-facing Spanish string lives in one file. `lib/pillars.ts` still owns the weights and keys (the numerical model). One-line edit to swap weights remains true. |
| Read-only rendering | Visible-but-disabled, with a small banner above the section | Lets the expert scroll back to verify their answers without ambiguity. Banner copy: `evaluate.stageReadOnlyBanner`. |
| Randomization seed | `sha256(evaluationId + cityId + stage)` first 32 bits → mulberry32 → Fisher–Yates | Stable across save/resume, deterministic, no client-server drift. Same RNG family as `lib/stratification.ts`. |
| Stage 2 pre-fill with Stage 1 answers? | **No** — Stage 2 ratings start blank for top-3 actions | Spec was explicit. Forces a fresh judgment against the top-10 question and protects against copy-paste laziness. |
| `notSure` per (action, question)? | **Yes** — preserved on each Rating row independently | An action might be "uncertain" for top-3 but "confident" for top-10. The DB schema already does this naturally because `question` is part of the unique key. Export retains both. |
| Stage 3 reorder — collapsible? | **No, always visible once reached** | The old SectionD was collapsible-by-default and optional-feeling. Stage 3 is now a first-class stage with the ranks revealed; collapsing it would muddle the methodology. |

## Verification

- `npm test` — **21 / 21 tests pass** (16 metrics + 5 stratification). New tests cover:
  - Both `question` types in fixtures
  - `citiesPassingTop10` parallel to `citiesPassingTop3`
  - **The miss-but-match case**: top-3 fail + top-10 pass, with the two metrics computed independently (the case the refactor was designed to capture without bias)
  - Partial Stage 1 completion returns top-3 rate + null top-10 rate
- `npm run build` — clean compile, 18 routes
- Hazard sweep: only one comment in `lib/fixtures.ts` mentioning hazards (documenting absence)
- Locale-leak grep: only one false positive (a Spanish word inside a code comment in `StageRating.tsx`)
- Pillar disclosure: full variant rendered in onboarding (Section 3), compact variant pinned above every evaluation page
- Save/resume: `Evaluation.currentStage` is set by the server, read on page load, and gates which stages are interactive; all rating writes are stage-rank-guarded server-side
