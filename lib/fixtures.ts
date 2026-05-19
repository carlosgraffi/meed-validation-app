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

export const CitySchema = z.object({
  cityId: z.string(),
  displayName: z.string(),
  population: z.number().int().positive(),
  populationDensity: z.number().nonnegative(),
  region: z.string(),
  biome: z.string(),
  elevationM: z.number(),
  sectorEmissions: z.object({
    stationaryEnergy: z.number(),
    transportation: z.number(),
    waste: z.number(),
    ippu: z.number().nullable(),
    afolu: z.number().nullable(),
  }),
  totalEmissions: z.number().positive(),
  // MEED+ is mitigation-only — adaptation hazard inputs are intentionally absent.
  statedSectorPriority: z.string().nullable(),
  cityRequest: CityRequestSchema,
});
export type City = z.infer<typeof CitySchema>;

export const ActionSchema = z.object({
  actionId: z.string(),
  source: z.enum(["icare", "ipcc", "c40"]),
  nameEs: z.string(),
  descriptionEs: z.string(),
  sector: z.string(),
  subsector: z.string().nullable(),
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
           * Short LLM-style rationale describing why the model placed this
           * action at this rank. Qualitative only — does not reveal numeric
           * scores. Generated at request time by HIAP-MEED+; placeholder data
           * lives here until the real per-city outputs ship.
           */
          rationaleEs: z.string(),
          rationaleEn: z.string(),
        })
      )
      .length(10),
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
  if (experts.length !== 13) {
    errors.push(`experts.json must contain exactly 13 experts (got ${experts.length})`);
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
