# Fixtures

These four JSON files are the source of truth for the app — the app does NOT call the HIAP API at runtime. Loaded into SQLite via `npm run seed`.

| File | Source | Status |
|------|--------|--------|
| `cities.json` | 10 anonymized Chilean cities | **Placeholder data** — generated from realistic Chilean regions, biomes, and emission profiles. Replace when SSG delivers real city data (1–5 cities at subsector level expected mid-May 2026 per the MEED+ check-in 2026-04-21). |
| `actions.json` | Subset of HIAP Big List | **Placeholder data** — 33 mitigation actions sampled from icare/ipcc/c40 sources, translated to Chilean Spanish. Schema matches the Big List spec in [products/citycatalyst/modules/hiap.md](https://www.notion.so/openearth/HIAP-f44b1da21dbc4c7f86eada0dc7afd43c). MEED+ is **mitigation only** — no adaptation actions in this catalog. |
| `model_outputs.json` | Per-city top 10 rankings | **Placeholder data** — invented to be plausibly correlated with each city's emissions profile. Replace with real HIAP v3 model output before validation sessions May 19–23. |
| `experts.json` | 13 expert records | **Placeholder records** — replace with real expert names and emails from SSG before generating magic links. Emails use `@ssg.placeholder` suffix to make this obvious. |

## Schema invariants

- `cities.json` — `sectorEmissions.ippu` and `sectorEmissions.afolu` MAY be `null` (SSG has not delivered these sectors as of May 7, 2026). Other sector fields must be numbers.
- `model_outputs.json` — every `actionId` referenced must exist in `actions.json`. Every `cityId` in `cities.json` must have an entry. Each entry must have exactly 10 ranked actions.
- The seeder validates these invariants and **fails fast** if violated.

## Refresh process

1. Replace any of the four JSON files.
2. `npm run db:reset` — wipes the dev DB and reseeds. (Production: use `npm run db:push && npm run seed` instead so existing evaluations are preserved if the schema is unchanged.)
3. Restart `npm run dev`.

## Why pillar scores are loaded but never shown

`pillarScores` and `finalScore` are stored in `model_outputs.json` so they are available for downstream analysis and for Track B reviewers, but **must not be rendered to experts**. The feasibility pillar is noisy due to sparse legal/governance data (see HIAP v3 module doc) and showing it would skew expert ratings.
