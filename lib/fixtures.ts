import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

const DATA_DIR = join(process.cwd(), "data");

/**
 * What the city declared as priorities when requesting recommendations.
 * Surfaced to experts so they can evaluate against what the city asked for,
 * not just against the city's emission profile.
 *
 * Sector keys match the keys in locales/*.json#sectors; timeframe + co-benefit
 * keys match the model's own taxonomy (see HIAP-MEED+ input_snapshot.json).
 */
export const CityRequestSchema = z.object({
  preferredSectors: z.array(z.string()),
  preferredTimeframes: z.array(z.enum(["short", "medium", "long"])),
  preferredCoBenefits: z.array(z.string()),
  excludedActionIds: z.array(z.string()),
});
export type CityRequest = z.infer<typeof CityRequestSchema>;

/**
 * A single socioeconomic / land-use indicator from the global-API
 * `/city_attributes/{locode}` endpoint. We pre-bin them into 4 groups
 * (people / economy / land / infrastructure) at fetch time so the UI can
 * render grouped sections without re-mapping at every render.
 */
export const CityIndicatorSchema = z.object({
  key: z.string(),
  group: z.enum(["people", "economy", "land", "infrastructure"]),
  labelEs: z.string(),
  labelEn: z.string(),
  value: z.number(),
  units: z.string(),
  category: z.string(), // "very low" / "low" / "medium" / "high" / "very high"
  priority: z.number().int(),
});
export type CityIndicator = z.infer<typeof CityIndicatorSchema>;

export const CitySchema = z.object({
  cityId: z.string(),
  displayName: z.string(),
  displayNameEn: z.string(),
  population: z.number().int().positive(),
  populationDensity: z.number().nonnegative(),
  area_km2: z.number().nonnegative().optional(),
  region: z.string(),
  regionEn: z.string(),
  biome: z.string(),
  biomeEn: z.string(),
  sectorEmissions: z.object({
    stationaryEnergy: z.number(),
    transportation: z.number(),
    waste: z.number(),
    ippu: z.number().nullable(),
    afolu: z.number().nullable(),
  }),
  /**
   * Subsector-level emissions keyed by GPC code ("I.1", "II.1", "III.4", etc.).
   * Optional because the legacy mock fixtures don't carry it. Real cities have it.
   */
  subsectorEmissions: z.record(z.string(), z.number()).optional(),
  /**
   * Total city emissions in t CO2eq/year. Can be NEGATIVE for cities whose
   * AFOLU sector is a net sink larger than other sectors' emissions
   * (Paillaco and Lago Ranco both have strongly negative totals because of
   * forest sequestration). Surface this prominently to experts — it's the
   * first signal that the city is rural and sink-dominated, which changes
   * how the model recommends actions.
   */
  totalEmissions: z.number(),
  // MEED+ is mitigation-only — adaptation hazard inputs are intentionally absent.
  statedSectorPriority: z.string().nullable(),
  cityRequest: CityRequestSchema,
  /**
   * Full set of socioeconomic + land-use indicators (the new "city_indicators"
   * terminology Mirco/Ayinawu use for the feasibility scoring). Drives the
   * sidebar / city context sheet display.
   */
  cityIndicators: z.array(CityIndicatorSchema),
});
export type City = z.infer<typeof CitySchema>;

export const ActionSchema = z.object({
  actionId: z.string(),
  source: z.enum(["icare", "ipcc", "c40"]),
  nameEs: z.string(),
  nameEn: z.string(),
  descriptionEs: z.string(),
  descriptionEn: z.string(),
  sector: z.string(),
  sectorEn: z.string(),
  subsector: z.string().nullable(),
  subsectorEn: z.string().nullable(),
  ghgReductionBand: z.enum(["muy bajo", "bajo", "medio", "alto", "muy alto"]),
  costBand: z.enum(["bajo", "medio", "alto"]),
  timelineBand: z.enum(["corto plazo", "mediano plazo", "largo plazo"]),
  coBenefits: z.array(z.string()),
});
export type Action = z.infer<typeof ActionSchema>;

export const DiscardedActionSchema = z.object({
  actionId: z.string(),
  reasonEs: z.string(),
  reasonEn: z.string(),
});
export type DiscardedAction = z.infer<typeof DiscardedActionSchema>;

export const ModelOutputsSchema = z.record(
  z.string(),
  z.object({
    topActions: z
      .array(
        z.object({
          rank: z.number().int().min(1).max(10),
          actionId: z.string(),
          finalScore: z.number().min(0).max(1),
          pillarScores: z.object({
            impact: z.number().min(0).max(1),
            alignment: z.number().min(0).max(1),
            feasibility: z.number().min(0).max(1),
          }),
          /**
           * Neutral pillar-band summary (low / moderate / high per pillar).
           * Templated from the action's scores so it carries no rank-positioning
           * prose ("ranks first because…"). Safe to render during the blind
           * Stage 1 / Stage 2 ratings where anchoring matters.
           */
          rationaleEs: z.string(),
          rationaleEn: z.string(),
          /**
           * LLM-authored explanation from the model's `explanations` step.
           * Rank-positioning by design — explicitly references "ranks first",
           * "near the top", etc. Render ONLY during the reveal stages
           * (`reveal1` / `reveal2`), AFTER the expert has committed their
           * blind set ratings. Never during Stage 3 reorder.
           *
           * Optional because pre-2026-05-25T18:13 UTC runs either disabled
           * the explanations step entirely or shipped English only.
           */
          explanationEs: z.string().optional(),
          explanationEn: z.string().optional(),
        })
      )
      .length(10),
    /**
     * Actions that ranked just outside the top 10 (ranks 11–15). Surfaced
     * to experts as read-only context during Stage 2 so they can see what
     * the model considered next, without expanding the set they rate.
     * Carlos's call: experts should know what's "just below the cut".
     */
    nextActions: z
      .array(
        z.object({
          rank: z.number().int().min(11).max(20),
          actionId: z.string(),
        })
      )
      .min(0)
      .max(10),
    /**
     * Actions that would have been candidates but were blocked by Chilean
     * legal assessment for this city. Surfaced to experts as a footnote so
     * they understand why expected actions are missing. Required in the
     * fixture (can be []) so the inferred type stays non-nullable.
     */
    discardedLegal: z.array(DiscardedActionSchema),
    /**
     * Actions explicitly excluded by the city in its request.
     */
    discardedExcluded: z.array(DiscardedActionSchema),
  })
);
export type ModelOutputs = z.infer<typeof ModelOutputsSchema>;

export const ExpertFixtureSchema = z.object({
  expertId: z.string(),
  email: z.string().email().or(z.string().regex(/^[^\s@]+@[^\s@]+$/)), // allow placeholder TLDs
  fullName: z.string(),
  sectorSpecialization: z.string().nullable(),
  /** Optional context — affiliation/employer, used in admin lists. */
  organization: z.string().optional(),
});
export type ExpertFixture = z.infer<typeof ExpertFixtureSchema>;

function readJson<T>(filename: string, schema: z.ZodType<T>): T {
  let raw: string;
  try {
    raw = readFileSync(join(DATA_DIR, filename), "utf-8");
  } catch (e) {
    throw new Error(
      `Missing fixture: ${filename}. Place it in /data/. Original: ${(e as Error).message}`
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`Malformed JSON in ${filename}: ${(e as Error).message}`);
  }
  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `Schema violation in ${filename}:\n${result.error.toString()}`
    );
  }
  return result.data;
}

export function loadCities(): City[] {
  return readJson("cities.json", z.array(CitySchema));
}

export function loadActions(): Action[] {
  return readJson("actions.json", z.array(ActionSchema));
}

export function loadModelOutputs(): ModelOutputs {
  return readJson("model_outputs.json", ModelOutputsSchema);
}

export function loadExperts(): ExpertFixture[] {
  return readJson("experts.json", z.array(ExpertFixtureSchema));
}

// ──────────────────────────────────────────────────────────────────────────
// Per-action context — policy / feasibility / legal — keyed by cityId × actionId
// (legal is country-wide so keyed by actionId only). All three come straight
// from the global-API and are loaded lazily so the existing eval flow doesn't
// pay the parse cost unless we surface them.
// ──────────────────────────────────────────────────────────────────────────

/** Per-action policy alignment score for one city. Subset of the upstream payload. */
export const PolicyScoreSchema = z.object({
  src_action_id: z.string(),
  policy_support_score: z.number(),
  policy_support_category: z.string(),
  best_relevance: z.string().nullable().optional(),
  n_findings: z.number(),
  n_docs: z.number(),
  sum_strength: z.number(),
  policy_evidence: z.array(
    z.object({
      evidence_rank: z.number(),
      signal_type: z.string(),
      signal_relation: z.string(),
      signal_strength: z.string(),
      document_name: z.string(),
      document_type: z.string(),
      doc_relevance: z.string(),
      explicitness: z.string(),
      page: z.number().nullable(),
      evidence_strength: z.number(),
      evidence_text: z.string(),
    })
  ),
});
export type PolicyScore = z.infer<typeof PolicyScoreSchema>;

/** Per-action mitigation feasibility, with full city_indicators breakdown. */
export const FeasibilityScoreSchema = z.object({
  src_action_id: z.string(),
  action_score: z.number(),
  dimension_scores: z.record(z.string(), z.number()),
  breakdown: z.record(
    z.string(),
    z.object({
      dimension_score: z.number(),
      global_indicators: z.array(
        z.object({
          global_indicator: z.string(),
          global_verdict: z.string(),
          global_contribution: z.number(),
          indicator_score: z.number(),
          city_indicators: z.array(
            z.object({
              city_indicator: z.string(),
              category: z.string(),
              direction: z.string(),
              capacity: z.number(),
              contribution: z.number(),
            })
          ),
        })
      ),
    })
  ),
});
export type FeasibilityScore = z.infer<typeof FeasibilityScoreSchema>;

/** Per-action legal assessment (country-wide). Already bilingual upstream. */
export const LegalAssessmentSchema = z.object({
  srcActionId: z.string(),
  countryCode: z.string(),
  gpcSector: z.string(),
  verdictCategory: z.enum(["enabled", "conditional", "blocked"]),
  verdictScore: z.number(),
  ownershipCategory: z.string(),
  ownershipScore: z.number(),
  ownershipDescriptionI18n: z.object({ en: z.string(), es: z.string() }),
  restrictionsCategory: z.string(),
  restrictionsScore: z.number(),
  restrictionsDescriptionI18n: z.object({ en: z.string(), es: z.string() }),
  legalJustificationI18n: z.object({ en: z.string(), es: z.string() }),
  legalReferences: z.array(z.string()),
  analysisDate: z.string(),
  generationMethod: z.string(),
});
export type LegalAssessment = z.infer<typeof LegalAssessmentSchema>;

export function loadPolicyScores(): Record<string, Record<string, PolicyScore>> {
  return readJson(
    "action-policy-scores.json",
    z.record(z.string(), z.record(z.string(), PolicyScoreSchema))
  );
}

export function loadFeasibilityScores(): Record<string, Record<string, FeasibilityScore>> {
  return readJson(
    "action-feasibility-scores.json",
    z.record(z.string(), z.record(z.string(), FeasibilityScoreSchema))
  );
}

export function loadLegalAssessments(): Record<string, LegalAssessment> {
  return readJson(
    "action-legal-assessments.json",
    z.record(z.string(), LegalAssessmentSchema)
  );
}

/**
 * Cross-file integrity check: every model_outputs cityId must exist in cities,
 * every actionId in model_outputs must exist in actions, and each entry has 10 ranked actions.
 * Returns the list of validation errors (empty if clean).
 */
export function crossValidate(): string[] {
  const errors: string[] = [];
  const cities = loadCities();
  const actions = loadActions();
  const outputs = loadModelOutputs();
  const experts = loadExperts();

  const cityIds = new Set(cities.map((c) => c.cityId));
  const actionIds = new Set(actions.map((a) => a.actionId));

  for (const cityId of Object.keys(outputs)) {
    if (!cityIds.has(cityId)) {
      errors.push(`model_outputs references unknown cityId: ${cityId}`);
    }
    const ranks = outputs[cityId].topActions.map((a) => a.rank).sort((x, y) => x - y);
    if (JSON.stringify(ranks) !== JSON.stringify([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])) {
      errors.push(`model_outputs[${cityId}] ranks must be exactly 1..10, got ${ranks.join(",")}`);
    }
    for (const a of outputs[cityId].topActions) {
      if (!actionIds.has(a.actionId)) {
        errors.push(`model_outputs[${cityId}] references unknown actionId: ${a.actionId}`);
      }
    }
  }
  for (const c of cities) {
    if (!outputs[c.cityId]) {
      errors.push(`cities[${c.cityId}] has no model_outputs entry`);
    }
  }
  if (experts.length < 1) {
    errors.push(`experts.json must contain at least 1 expert (got ${experts.length})`);
  }
  const emails = new Set<string>();
  for (const e of experts) {
    if (emails.has(e.email.toLowerCase())) {
      errors.push(`Duplicate expert email: ${e.email}`);
    }
    emails.add(e.email.toLowerCase());
  }
  return errors;
}
