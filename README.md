# MEED+ — Track A Validation App

Non-moderated expert-evaluation web app for the **MEED+ HIAP v3** prototype, built for the OEF × SSG CORFO contract. Lets 13 Chilean climate-planning experts evaluate the model's top 10 recommendations for 10 anonymized cities between **May 19–31, 2026**, and produces the headline ≥75% match-rate metric required for the contract.

This is **Track A only**. Track B (technical mapping review) shares the same foundation but is not built yet.

## What's in here

```
app/                 Next.js 14 App Router pages + API routes
  page.tsx           Landing — email → magic-link request
  onboarding/        Intake (consent, profile, city preferences)
  dashboard/         Expert dashboard of assigned cities
  evaluate/[cityId]/ The core evaluation screen (Sections A–E)
  complete/          Completion confirmation
  admin/             Coverage, expert progress, magic-link list, reassignment, metrics, export
  auth/magic/[token] Magic-link landing — consumes token, signs the expert in
  api/               REST endpoints (auth, eval state, admin operations)

components/ui/       shadcn-style primitives (Button, Card, Input, RadioGroup, Select, etc.)

lib/
  fixtures.ts        Zod-validated loaders for the four JSON fixtures
  stratification.ts  Deterministic seeded city↔expert assignment (52 total, 3–5 per expert, 5–6 per city)
  metrics.ts         Pure top-3 / top-10 match-rate + Spearman computation (CORFO headline)
  metrics.test.ts    Unit test against a hand-built fixture
  stratification.test.ts
  admin-metrics.ts   Bridges Prisma rows into the pure metrics function
  auth.ts            NextAuth options (Credentials provider for magic-link tokens)
  db.ts              Prisma singleton
  utils.ts           cn() + locale lookup t()

data/                Fixtures (placeholder until SSG delivers real data — see data/README.md)
  cities.json
  actions.json       33-action mitigation subset of the 155-action Big List
  model_outputs.json Per-city top 10
  experts.json       13 placeholder expert records

locales/
  es.json            ALL expert-facing Spanish lives here

prisma/
  schema.prisma      Expert, Assignment, Evaluation, Rating, ReorderTop5, MagicToken
  seed.ts            Idempotent seeder (--stratify, --reset flags)

scripts/
  admin-link.ts      Prints a fresh admin magic link for the first login

middleware.ts        Route guards (auth + admin)
railway.toml         Railway deploy config (SQLite persisted on a /data volume)
```

## Quick start (local)

Prerequisites: **Node 20+**.

```bash
# 1. Install
npm install

# 2. Create the SQLite DB and apply schema
npx prisma db push

# 3. Seed experts (and optionally run stratification immediately)
npm run seed -- --stratify

# 4. Generate an admin magic link (printed to terminal)
npx tsx scripts/admin-link.ts

# 5. Run the dev server
npm run dev

# 6. Run the unit tests
npm test
```

Open the URL printed by `admin-link.ts` to log in as admin. From the admin dashboard:
- Click **Generate links for everyone** to mint magic links for all 13 experts. Copy each link and paste it into the email you send manually.
- Click **Compute headline metric** to see the live top-3 / top-10 match rate.
- Click **Download all data as JSON** at any time to produce the CORFO-ready export.

## How auth works (no email provider needed)

The spec called for an email provider, but you asked to skip it and send invitations manually. There are two auth paths.

### Experts: magic-link auth
1. **Magic-link generation** lives in the admin dashboard. Click **Generate** next to an expert and copy the single-use URL like `/auth/magic/<random-32-byte-token>`. Tokens default to a 7-day TTL (`MAGIC_LINK_TTL_MIN`).
2. **Carlos pastes the URL** into a manually-sent email.
3. **Expert clicks the link.** The `auth/magic/[token]` page calls NextAuth's `signIn("magic", { token })`. The Credentials provider validates the token, marks it `usedAt`, and creates a JWT session.
4. **Session is a JWT cookie** lasting 2 weeks.
5. The landing page (`/`) accepts an email and creates a magic token. The expert sees a "check your email" confirmation. Carlos sees the new token in the admin dashboard's **Magic links** section.

### Admin: password auth
The admin uses a permanent URL with a password — no per-session magic link.

1. **Set `ADMIN_PASSWORD`** in your env (local `.env` or Railway service variables).
2. **Visit `/admin/login`** at any time. Enter the password. You're in for 2 weeks.
3. **The `/admin` URL** redirects to `/admin/login` if you're not signed in, and to the dashboard if you are.
4. The bootstrap admin-link script (`scripts/admin-link.ts`, auto-run on Railway boot and printed to logs) still works as a fallback if you forget the password or want a one-off URL.

### Demo: password auth (sandbox expert)
For testing the expert flow without burning real magic-link tokens:

1. **Set `DEMO_PASSWORD`** in your env.
2. **Visit `/demo/login`** and enter the password. You're signed in as a dedicated demo expert (id `demo`, separate from the 13 real experts).
3. The demo expert is pre-assigned to 3 cities (`city_03`, `city_05`, `city_10`) so you see a realistic mix of profiles.
4. **Demo evaluations are filtered out** of `computedMetrics` and the JSON export. They never pollute the real CORFO data.
5. The demo state persists across reseeds — Carlos's draft ratings stay until manually cleared.

### Magic-link reusability
Magic links are valid for **multiple uses** within their TTL (default 7 days). If an expert closes a tab, gets logged out, or shares devices, the same URL still works. The admin can explicitly revoke a link by clicking **Regenerate** in the admin dashboard — the previous URL becomes invalid immediately.

## Stratification

`lib/stratification.ts` is deterministic and idempotent. Given the same 13 experts and 10 cities, it always produces the same 52 assignments:
- Each expert gets 3–5 cities (target 4).
- Each city gets 5–6 experts (8 cities × 5 + 2 cities × 6 = 52).
- If an expert set `preferredCityIds` during intake, at least one preference is honored when possible.

The seed is `sha256(sorted expert IDs)`. Re-runs preserve assignments for any expert that has already STARTED an evaluation — both via the admin **Run stratification** button and via the seeder's `--stratify` flag.

**Manual reassignment** is exposed in the admin UI. It is blocked if the source evaluation has been started (mid-window safety).

## Metrics: the CORFO ≥75% bar

Encoded in `lib/metrics.ts` as a pure function, with a unit test in `lib/metrics.test.ts`:

- **Match** = Likert rating of 4 ("De acuerdo") or 5 ("Muy de acuerdo").
- **Per-expert top-3 match rate** = matches in ranks 1–3 / 3.
- **Per-city top-3 match rate** = mean of all submitting experts' top-3 match rates.
- **Overall top-3 match rate** = mean across cities.
- **citiesPassingTop3** = number of cities whose top-3 match rate ≥ 0.75.

`spearmanTop5` is computed per-city across experts who completed Section D (reorder), as the mean Spearman rank correlation between the model's top 5 and the expert's reorder.

`notSure: true` ratings still count — the Likert value is still primary. The "not sure" flag is preserved in the export for downstream cohort analysis.

## Fixtures: how they map to reality

See `data/README.md`. Short version:
- All four JSON files are **placeholder data** — the app validates them with Zod at startup and fails fast if anything is missing or malformed.
- Cities, actions, and model outputs are designed to be plausibly correlated (an Antofagasta-style port city is recommended electric public transit; a Magallanes-style cold city is recommended residential thermal retrofit). Replace with real data when SSG delivers it.
- IPPU and AFOLU sector emissions are explicitly nullable in `cities.json` to match the May 2026 reality that SSG had only delivered energy/transport/waste. The UI shows "Datos no disponibles para este sector" rather than zero.
- MEED+ is **mitigation only** — there are no adaptation actions in the catalog.

## Out of scope (per spec)

- Email sending (replaced by manual distribution via the admin)
- Mobile layout
- Real-time HIAP API calls
- Pillar scores or final scores shown to experts (would skew ratings)
- Track B reviewer interface
- Internationalization toggle for experts (admin UI is English; expert UI is Spanish, hard-coded)

## Deploy: Railway

`railway.toml` is configured for Nixpacks builds with a `/data` persisted volume. See the comments in that file for the env vars you need to set in the Railway dashboard. SQLite stays on the volume across deploys.

After the first deploy:
```bash
railway run npx prisma db push       # apply schema
railway run npm run seed -- --stratify
railway run npx tsx scripts/admin-link.ts https://<your-service>.up.railway.app
```

## Locale + accessibility checks

`grep -rE "[áéíóúñ¿¡]" app/ components/ lib/ | grep -v "/locales/" | grep -v ".test.ts"` should return zero matches. All Spanish strings live in `locales/es.json`.

## License

OEF internal. AGPL (per the SSG–OEF licensing agreement).
