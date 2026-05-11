# MEED+ Track A Validation App — Claude Code Build Prompt

You are building a non-moderated expert-evaluation web app for the Open Earth Foundation (OEF). It validates the MEED+ Action Prioritizer (an AI model that ranks climate mitigation actions for Chilean municipalities) under a CORFO contract. 13 Chilean climate planning experts will evaluate model recommendations for 10 anonymized cities between May 19 and May 31, 2026.

This is **Track A** of a two-track validation effort. Track B (technical mapping review by 3 inventory specialists) will be added later on the same foundation — keep the architecture extensible but do not build Track B now.

Read this entire document before writing any code. Confirm the questions in Section 11 before starting.

---

## 1. The contract bar that drives everything

The CORFO contract requires demonstrating ≥75% match between model recommendations and expert opinion. We are operationalizing it as:

> **A model recommendation matches expert opinion when an expert rates it 4 ("De acuerdo") or 5 ("Muy de acuerdo") on a 5-point Likert scale. The bar is met when ≥75% of the model's top 3 recommendations per city, averaged across all expert evaluations, achieve a match rating.**

Top 3 is the headline. Top 10 is the secondary number. Do not redesign the metric.

## 2. Tech stack (use these exact choices)

- **Framework:** Next.js 14, App Router, TypeScript
- **Styling:** Tailwind CSS + shadcn/ui
- **Database:** SQLite via Prisma
- **Auth:** NextAuth.js with email magic-link provider only. No passwords, no account creation.
- **Email:** Resend (preferred) or Postmark — flag the choice in your first message and ask for the API key
- **Drag & drop:** dnd-kit
- **Form state:** react-hook-form + zod
- **Charts (admin only):** Recharts
- **Deployment target:** flag the choice — Railway/Render (persistent SQLite) preferred over Vercel for this case

No other state managers, ORMs, CSS frameworks, or component libraries.

## 3. Data inputs (JSON fixtures, not API calls)

The app does not call the HIAP API at runtime. All city and model data comes from JSON fixtures in `/data/`. Generate realistic placeholder fixtures for local development if the real files are not yet provided.

### `/data/cities.json`
Array of 10 anonymized city objects:
```typescript
{
  cityId: string;              // e.g. "city_01"
  displayName: string;         // anonymized, Spanish, e.g. "Ciudad Costera del Norte"
  population: number;
  populationDensity: number;   // people per km²
  region: string;              // Spanish, e.g. "Región de Antofagasta"
  biome: string;               // Spanish, e.g. "Desierto costero"
  elevationM: number;
  sectorEmissions: {           // tCO2eq/year
    stationaryEnergy: number;
    transportation: number;
    waste: number;
    ippu: number | null;       // null if SSG hasn't delivered
    afolu: number | null;
  };
  totalEmissions: number;
  topHazards: Array<{          // top 3 from CCRA
    hazard: string;            // Spanish, e.g. "Sequía"
    riskScore: number;         // 0–1
  }>;
  statedSectorPriority: string | null;
}
```

### `/data/actions.json`
Catalog of actions referenced in the test (subset of the 155-action Big List):
```typescript
{
  actionId: string;            // e.g. "icare_0025"
  source: "icare" | "ipcc" | "c40";
  nameEs: string;              // Chilean Spanish, review-quality
  descriptionEs: string;       // 2–4 sentences, Chilean Spanish
  sector: string;              // Spanish sector label
  subsector: string | null;
  ghgReductionBand: "muy bajo" | "bajo" | "medio" | "alto" | "muy alto";
  costBand: "bajo" | "medio" | "alto";
  timelineBand: "corto plazo" | "mediano plazo" | "largo plazo";
  coBenefits: string[];        // Spanish co-benefit labels
}
```

### `/data/model_outputs.json`
Per-city model rankings:
```typescript
{
  [cityId: string]: {
    topActions: Array<{
      rank: number;            // 1–10
      actionId: string;
      finalScore: number;
      pillarScores: {
        impact: number;        // 0–1
        alignment: number;
        feasibility: number;
      };
    }>
  }
}
```

### `/data/experts.json`
13 pre-loaded experts from SSG:
```typescript
{
  expertId: string;
  email: string;
  fullName: string;
  sectorSpecialization: string | null;
}
```

Treat fixtures as source of truth. Fail fast and visibly in the admin dashboard if a fixture is missing or malformed — never silently substitute defaults.

## 4. Database schema (Prisma)

```prisma
model Expert {
  id                    String       @id          // matches experts.json expertId
  email                 String       @unique
  fullName              String
  sectorSpecialization  String?
  preferredCityIds      String?      // comma-separated, set during intake
  consentedAt           DateTime?
  completedAt           DateTime?
  assignments           Assignment[]
  evaluations           Evaluation[]
}

model Assignment {
  id          String   @id @default(cuid())
  expertId    String
  cityId      String
  assignedAt  DateTime @default(now())
  expert      Expert   @relation(fields: [expertId], references: [id])
  @@unique([expertId, cityId])
}

model Evaluation {
  id              String   @id @default(cuid())
  expertId        String
  cityId          String
  startedAt       DateTime @default(now())
  submittedAt     DateTime?
  timeOnTaskSec   Int?
  missingActions  String?  // JSON array, max 3
  cityComment     String?
  expert          Expert   @relation(fields: [expertId], references: [id])
  ratings         Rating[]
  reorderTop5     ReorderTop5?
  @@unique([expertId, cityId])
}

model Rating {
  id              String   @id @default(cuid())
  evaluationId    String
  actionId        String
  modelRank       Int      // 1–10, snapshotted at rating time
  likert          Int      // 1–5
  notSure         Boolean  @default(false)
  ratedAt         DateTime @default(now())
  evaluation      Evaluation @relation(fields: [evaluationId], references: [id])
  @@unique([evaluationId, actionId])
}

model ReorderTop5 {
  id              String   @id @default(cuid())
  evaluationId    String   @unique
  orderedActionIds String  // JSON array of 5 actionIds in expert's order
  evaluation      Evaluation @relation(fields: [evaluationId], references: [id])
}
```

## 5. Stratification algorithm

Idempotent, deterministic, single admin trigger.

1. Load all 13 experts and 10 city IDs.
2. Each expert gets 3–5 city assignments. Target average is 4. Total assignments = ~52, distributed so every city has 5–6 experts.
3. If an expert filled `preferredCityIds` during intake, assign 1 of their cities from that list.
4. Other cities assigned to minimize variance of expert count across cities.
5. Use a deterministic seed derived from a hash of `experts.json` so re-runs produce identical assignments.
6. Write all `Assignment` rows.

Admin dashboard must support manual reassignment (mid-window rebalancing on May 24) without losing data from already-started evaluations.

## 6. Screens

All expert-facing strings must be Chilean Spanish, stored in `/locales/es.json`. Admin dashboard can be English. `grep -r "[áéíóúñ¿¡]" components/` should return zero matches outside the locale file.

### 6.1 Landing / Magic Link (`/`)
- Brief OEF + CORFO + MEED+ intro (3–4 Spanish sentences)
- Email input → "Enviar enlace de acceso"
- Generates magic link, sends via email provider
- Confirmation screen: "Revisa tu correo"
- Unrecognized email: "Este correo no está registrado. Contacta a SSG."

### 6.2 Intake (`/onboarding`, first login only)
Single scrollable page, three sections:

1. **Consent** — short Spanish paragraph on data use (anonymized aggregate for CORFO; raw data for OEF + SSG only). Checkbox: "Acepto participar en esta evaluación."
2. **Profile confirmation** — name + email displayed, editable `sectorSpecialization` dropdown (Energía / Transporte / Residuos / IPPU / AFOLU / Transversal / Otro)
3. **Optional city preference** — show all 10 cities with brief descriptors (region, dominant sector). Multi-select, max 2. Label: "¿Hay ciudades donde tengas experiencia particular? (Opcional, máximo 2)"

On submit: trigger this expert's assignment slice from the stratification algorithm, set `consentedAt`, redirect to dashboard.

### 6.3 Expert dashboard (`/dashboard`)
- Greeting with first name
- Progress: "X de Y ciudades evaluadas"
- City cards, each showing:
  - Display name
  - Region + dominant sector tag
  - Status badge: "No iniciada" / "En progreso" / "Completada"
  - Time estimate: "~10 minutos"
  - Action button: "Iniciar" / "Continuar" / "Ver respuestas"
- Total remaining time in footer
- "Cerrar sesión" link

### 6.4 City evaluation (`/evaluate/[cityId]`)
**The core screen.** Single scrollable page with five sections.

**Section A — Contexto de la ciudad** (~60s read)
- City name + region
- Population + density
- Biome + elevation
- Sector emissions: horizontal bar chart (Recharts) showing % share. Mark null sectors explicitly: "Datos no disponibles para este sector"
- Top 3 hazards as labeled chips with risk score
- `statedSectorPriority` in a callout: "Prioridad sectorial declarada por la ciudad: [sector]"
- Anchored "Continuar a evaluación" button scrolls to Section B

**Section B — Evalúa las 10 acciones recomendadas**
- Subheading: "El modelo MEED+ recomienda las siguientes 10 acciones para esta ciudad, ordenadas de mayor a menor prioridad. Las primeras 3 son las recomendaciones principales."
- 10 action cards in model rank order. Cards 1–3 visually emphasized (larger, accent border, "Recomendación principal" tag).
- Each card displays:
  - Rank number (large)
  - `nameEs`
  - `descriptionEs`
  - Sector + subsector chips
  - GHG reduction band, cost band, timeline band as small chips
  - Co-benefits as chips
  - **Do NOT show `pillarScores` or `finalScore`** — the feasibility pillar is noisy due to sparse legal data; showing would skew expert ratings
  - Likert rating: 5 radio buttons:
    1. Muy en desacuerdo
    2. En desacuerdo
    3. Neutral
    4. De acuerdo
    5. Muy de acuerdo
  - Below: toggle "No estoy seguro/a de esta acción"
- Auto-save each rating on change (500ms debounce)

**Section C — ¿Falta alguna acción?**
- "¿Hay acciones que esperabas ver entre las 10 principales y que no aparecen? (Opcional, máximo 3)"
- 3 optional text inputs, each ≤200 characters

**Section D — Reordenar el top 5 (opcional)**
- Collapsible, closed by default
- Header: "¿Reordenarías las primeras 5 acciones? (Opcional)"
- When opened: drag-and-drop list of model's top 5; save reorder on drop

**Section E — Comentarios sobre esta ciudad**
- Single textarea, optional, ≤1000 chars: "¿Algún comentario sobre las recomendaciones para esta ciudad?"

**Footer:**
- "Guardar y continuar después" → saves state, returns to dashboard
- "Enviar evaluación" → validates all 10 Likert ratings present, sets `submittedAt`, computes `timeOnTaskSec`, returns to dashboard
- Inline Spanish validation errors

**Save/resume:**
- Every Likert change, textarea blur, reorder → persist immediately
- On page load for in-progress evaluation: restore full state from DB
- `startedAt` on first load; `timeOnTaskSec` = `submittedAt − startedAt`, clamped to ignore gaps > 30 min

### 6.5 Completion (`/complete`)
After expert's last assigned city is submitted:
- Spanish thank-you message
- Brief note: results shared in aggregate with SSG and CORFO
- Sets `Expert.completedAt`

### 6.6 Admin dashboard (`/admin`)
Separate auth via single hardcoded admin email in env. English UI fine.

- **Coverage view:** table of 10 cities × counts of assigned / started / completed evaluations. Highlight cities below 5 completed in red.
- **Expert progress view:** table of 13 experts × cities assigned/started/completed, last activity timestamp.
- **Manual reassignment:** form to move a city assignment between experts. Block reassignment if target evaluation already started.
- **Live metric preview:** on-demand "compute headline metric" button — top 3 match rate across submitted evaluations.
- **Export:** "Download all data as JSON" button (see Section 7).
- **Stratification trigger:** button with confirmation modal — should run once before sessions open.

## 7. Export format (`/api/admin/export`)

Returns one JSON file:
```json
{
  "exportedAt": "2026-05-29T12:00:00Z",
  "experts": [...],
  "cities": [...],
  "actions": [...],
  "modelOutputs": {...},
  "evaluations": [
    {
      "expertId": "...",
      "cityId": "...",
      "startedAt": "...",
      "submittedAt": "...",
      "timeOnTaskSec": 540,
      "ratings": [
        { "actionId": "...", "modelRank": 1, "likert": 4, "notSure": false }
      ],
      "reorderTop5": ["...", "...", ...] | null,
      "missingActions": ["...", "..."],
      "cityComment": "..."
    }
  ],
  "computedMetrics": {
    "perCity": {
      "city_01": {
        "expertsCompleted": 5,
        "top3MatchRate": 0.87,
        "top10MatchRate": 0.74,
        "spearmanTop5": 0.62
      }
    },
    "overall": {
      "top3MatchRate": 0.82,
      "top10MatchRate": 0.71,
      "citiesPassingTop3": 8
    }
  }
}
```

`computedMetrics` is the headline output for the report. Compute in a pure function in `/lib/metrics.ts` so it can be unit-tested.

## 8. Out of scope

Do not build:
- Account creation, password reset
- Comment threads, inter-expert discussion
- Real-time collaboration
- Public-facing results page
- Track B mapping review interface (will be added later)
- Comparison against PARCC/PACCC documents
- Emissions accuracy validation
- Non-Spanish toggle for experts (admin English is fine)
- Mobile-optimized layout (desktop/laptop assumed; degrade gracefully but do not optimize)
- Live HIAP API calls
- Pillar scores or final scores visible to experts

If you reach for any of these, stop and flag it.

## 9. Acceptance criteria

The build is done when:

1. An expert receives a magic-link email, logs in, completes intake, sees their assigned cities, evaluates each with all 10 Likert ratings, saves and resumes mid-evaluation, and submits — end-to-end in under 50 minutes total.
2. Stratification produces 3–5 cities per expert (average 4), 5–6 experts per city, deterministic across re-runs, respecting preferences where possible.
3. All Spanish strings live in `/locales/es.json`; grep confirms no leaks.
4. Admin can view live coverage, manually reassign, and export complete JSON with computed metrics.
5. `top3MatchRate` in the export matches the operational definition in Section 1 — verified by a unit test in `/lib/metrics.test.ts` against a hand-built fixture.
6. Save/resume works: closing the tab mid-evaluation and reopening restores all ratings, reorder state, and text inputs.
7. App runs locally with `npm install && npm run dev` after `npm run seed`.

## 10. Build order

Ship a working end-to-end slice before polishing. Stop and flag if any step expands scope.

1. Project scaffold, Prisma schema, fixture seeder, basic auth
2. Stratification algorithm + admin trigger (test before UI)
3. Expert dashboard with assigned cities (read-only first)
4. City evaluation page: Section A + Section B + save/resume
5. Sections C, D, E (missing actions, reorder, comments)
6. Completion flow
7. Admin dashboard: coverage, manual reassignment, export
8. Metrics computation + unit test
9. Spanish polish + accessibility pass + email template polish

## 11. Confirm before starting

In your first message, confirm:
1. **Email provider** — Resend or Postmark? Do you have an API key?
2. **Deployment target** — Railway, Render, or Vercel? (Railway/Render preferred for SQLite persistence)
3. **Fixtures** — do the four JSON files exist yet, or should you generate realistic placeholder fixtures for local dev?

Do not start building until these three are answered.
