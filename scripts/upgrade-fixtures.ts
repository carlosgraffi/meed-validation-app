/**
 * One-shot upgrade for /data fixtures, post-2026-05-13 trace review.
 *
 * Adds three new structures to match the shape of the real HIAP-MEED+
 * prioritization response (see hiap-meed/logs_temp/.../input_snapshot.json
 * and .../015_response_summary.json on the mr/on-5687-legal-api branch):
 *
 *   cities.json
 *     + cityRequest { preferredSectors, preferredTimeframes, preferredCoBenefits,
 *                     excludedActionIds }
 *
 *   model_outputs.json
 *     + topActions[].rationaleEs, .rationaleEn  — short LLM-style rationales
 *     + discardedLegal[] — actions blocked by Chilean legal assessment
 *     + discardedExcluded[] — actions the city excluded
 *
 * Re-running this is idempotent: it overwrites the new fields and leaves the
 * legacy `topActions[].rank/actionId/finalScore/pillarScores` untouched.
 *
 * Usage:
 *   npx tsx scripts/upgrade-fixtures.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DATA_DIR = join(process.cwd(), "data");

type CityRequest = {
  preferredSectors: string[];
  preferredTimeframes: ("short" | "medium" | "long")[];
  preferredCoBenefits: string[];
  excludedActionIds: string[];
};

// Per-city preferences chosen to match each city's emission profile + region.
// Sectors use the locale keys ("stationaryEnergy" / "transportation" / "waste"
// / "ippu" / "afolu"). Co-benefits match keys from locales/es.json#cobenefits.
const CITY_REQUESTS: Record<string, CityRequest> = {
  city_01: {
    preferredSectors: ["stationaryEnergy", "transportation"],
    preferredTimeframes: ["short", "medium"],
    preferredCoBenefits: ["air_quality", "mobility"],
    excludedActionIds: [],
  },
  city_02: {
    preferredSectors: ["ippu", "stationaryEnergy"],
    preferredTimeframes: ["medium"],
    preferredCoBenefits: ["air_quality", "water_quality"],
    excludedActionIds: [],
  },
  city_03: {
    preferredSectors: ["transportation"],
    preferredTimeframes: ["short", "medium"],
    preferredCoBenefits: ["air_quality", "mobility"],
    excludedActionIds: [],
  },
  city_04: {
    preferredSectors: ["transportation", "stationaryEnergy"],
    preferredTimeframes: ["short", "medium"],
    preferredCoBenefits: ["air_quality", "mobility"],
    excludedActionIds: [],
  },
  city_05: {
    preferredSectors: ["afolu", "waste"],
    preferredTimeframes: ["medium", "long"],
    preferredCoBenefits: ["water_quality", "habitat"],
    excludedActionIds: [],
  },
  city_06: {
    preferredSectors: ["ippu", "stationaryEnergy"],
    preferredTimeframes: ["medium"],
    preferredCoBenefits: ["air_quality", "cost_of_living"],
    excludedActionIds: [],
  },
  city_07: {
    preferredSectors: ["stationaryEnergy", "transportation"],
    preferredTimeframes: ["short", "medium"],
    preferredCoBenefits: ["air_quality", "housing"],
    excludedActionIds: [],
  },
  city_08: {
    preferredSectors: ["stationaryEnergy"],
    preferredTimeframes: ["short"],
    preferredCoBenefits: ["air_quality", "housing"],
    excludedActionIds: [],
  },
  city_09: {
    preferredSectors: ["stationaryEnergy", "afolu"],
    preferredTimeframes: ["medium"],
    preferredCoBenefits: ["habitat", "water_quality"],
    excludedActionIds: [],
  },
  city_10: {
    preferredSectors: ["stationaryEnergy"],
    preferredTimeframes: ["short"],
    preferredCoBenefits: ["housing", "air_quality"],
    excludedActionIds: [],
  },
};

// Plausible legally-blocked actions per city — actions the model would
// have considered but Chilean legal assessment ruled out. Drawn from
// the action catalog. Each carries a brief reason in ES + EN.
type LegalBlock = { actionId: string; reasonEs: string; reasonEn: string };

const LEGAL_TEMPLATES: Record<string, { es: string; en: string }> = {
  national_mandate: {
    es: "Requiere mandato nacional vigente; aún no implementado para municipios.",
    en: "Requires a national mandate not yet implemented for municipalities.",
  },
  not_in_municipal_powers: {
    es: "Fuera de las potestades municipales según la Ley Orgánica Constitucional de Municipalidades (Ley 18.695).",
    en: "Outside municipal powers per the Constitutional Organic Law on Municipalities (Law 18.695).",
  },
  pending_regulation: {
    es: "Reglamentación específica aún pendiente; revisión legal en curso por SSG.",
    en: "Specific regulation still pending; legal review under way at SSG.",
  },
  conflicting_jurisdiction: {
    es: "Jurisdicción compartida con el Estado central; municipio no puede actuar de forma autónoma.",
    en: "Shared jurisdiction with the central government; the municipality cannot act autonomously.",
  },
  budget_authorization: {
    es: "Requiere autorización presupuestaria sectorial que excede el alcance comunal.",
    en: "Requires sector-level budget authorization beyond the comunal scope.",
  },
};

// Distribute 2-3 legally-blocked actions per city, drawn from the 33-action catalog,
// avoiding actions already in that city's top 10.
const DISCARDED_LEGAL_TEMPLATES: Record<string, LegalBlock[]> = {
  city_01: [
    { actionId: "icare_0128", reasonEs: LEGAL_TEMPLATES.national_mandate.es, reasonEn: LEGAL_TEMPLATES.national_mandate.en },
    { actionId: "c40_0028", reasonEs: LEGAL_TEMPLATES.pending_regulation.es, reasonEn: LEGAL_TEMPLATES.pending_regulation.en },
    { actionId: "icare_0115", reasonEs: LEGAL_TEMPLATES.conflicting_jurisdiction.es, reasonEn: LEGAL_TEMPLATES.conflicting_jurisdiction.en },
  ],
  city_02: [
    { actionId: "ipcc_0118", reasonEs: LEGAL_TEMPLATES.not_in_municipal_powers.es, reasonEn: LEGAL_TEMPLATES.not_in_municipal_powers.en },
    { actionId: "c40_0028", reasonEs: LEGAL_TEMPLATES.pending_regulation.es, reasonEn: LEGAL_TEMPLATES.pending_regulation.en },
  ],
  city_03: [
    { actionId: "icare_0128", reasonEs: LEGAL_TEMPLATES.national_mandate.es, reasonEn: LEGAL_TEMPLATES.national_mandate.en },
    { actionId: "icare_0094", reasonEs: LEGAL_TEMPLATES.conflicting_jurisdiction.es, reasonEn: LEGAL_TEMPLATES.conflicting_jurisdiction.en },
    { actionId: "icare_0115", reasonEs: LEGAL_TEMPLATES.conflicting_jurisdiction.es, reasonEn: LEGAL_TEMPLATES.conflicting_jurisdiction.en },
  ],
  city_04: [
    { actionId: "icare_0128", reasonEs: LEGAL_TEMPLATES.national_mandate.es, reasonEn: LEGAL_TEMPLATES.national_mandate.en },
    { actionId: "icare_0094", reasonEs: LEGAL_TEMPLATES.conflicting_jurisdiction.es, reasonEn: LEGAL_TEMPLATES.conflicting_jurisdiction.en },
  ],
  city_05: [
    { actionId: "ipcc_0118", reasonEs: LEGAL_TEMPLATES.not_in_municipal_powers.es, reasonEn: LEGAL_TEMPLATES.not_in_municipal_powers.en },
    { actionId: "icare_0089", reasonEs: LEGAL_TEMPLATES.budget_authorization.es, reasonEn: LEGAL_TEMPLATES.budget_authorization.en },
    { actionId: "c40_0028", reasonEs: LEGAL_TEMPLATES.pending_regulation.es, reasonEn: LEGAL_TEMPLATES.pending_regulation.en },
  ],
  city_06: [
    { actionId: "icare_0128", reasonEs: LEGAL_TEMPLATES.national_mandate.es, reasonEn: LEGAL_TEMPLATES.national_mandate.en },
    { actionId: "icare_0094", reasonEs: LEGAL_TEMPLATES.conflicting_jurisdiction.es, reasonEn: LEGAL_TEMPLATES.conflicting_jurisdiction.en },
  ],
  city_07: [
    { actionId: "icare_0128", reasonEs: LEGAL_TEMPLATES.national_mandate.es, reasonEn: LEGAL_TEMPLATES.national_mandate.en },
    { actionId: "icare_0089", reasonEs: LEGAL_TEMPLATES.budget_authorization.es, reasonEn: LEGAL_TEMPLATES.budget_authorization.en },
  ],
  city_08: [
    { actionId: "icare_0089", reasonEs: LEGAL_TEMPLATES.budget_authorization.es, reasonEn: LEGAL_TEMPLATES.budget_authorization.en },
    { actionId: "icare_0115", reasonEs: LEGAL_TEMPLATES.conflicting_jurisdiction.es, reasonEn: LEGAL_TEMPLATES.conflicting_jurisdiction.en },
  ],
  city_09: [
    { actionId: "icare_0128", reasonEs: LEGAL_TEMPLATES.national_mandate.es, reasonEn: LEGAL_TEMPLATES.national_mandate.en },
    { actionId: "ipcc_0118", reasonEs: LEGAL_TEMPLATES.not_in_municipal_powers.es, reasonEn: LEGAL_TEMPLATES.not_in_municipal_powers.en },
  ],
  city_10: [
    { actionId: "c40_0028", reasonEs: LEGAL_TEMPLATES.pending_regulation.es, reasonEn: LEGAL_TEMPLATES.pending_regulation.en },
    { actionId: "icare_0089", reasonEs: LEGAL_TEMPLATES.budget_authorization.es, reasonEn: LEGAL_TEMPLATES.budget_authorization.en },
    { actionId: "icare_0094", reasonEs: LEGAL_TEMPLATES.conflicting_jurisdiction.es, reasonEn: LEGAL_TEMPLATES.conflicting_jurisdiction.en },
  ],
};

type Action = {
  actionId: string;
  source: string;
  nameEs: string;
  sector: string;
  ghgReductionBand: "muy bajo" | "bajo" | "medio" | "alto" | "muy alto";
  costBand: "bajo" | "medio" | "alto";
  timelineBand: "corto plazo" | "mediano plazo" | "largo plazo";
  coBenefits: string[];
};

type RankedAction = {
  rank: number;
  actionId: string;
  finalScore: number;
  pillarScores: { impact: number; alignment: number; feasibility: number };
};

// Chilean Spanish sector labels (must match locales/es.json#sectors).
const SECTOR_LABEL_ES: Record<string, string> = {
  Energía: "stationaryEnergy",
  "Energía estacionaria": "stationaryEnergy",
  Transporte: "transportation",
  Residuos: "waste",
  IPPU: "ippu",
  AFOLU: "afolu",
};

const TIMELINE_TO_TIMEFRAME: Record<string, "short" | "medium" | "long"> = {
  "corto plazo": "short",
  "mediano plazo": "medium",
  "largo plazo": "long",
};

const GHG_BAND_RANK = { "muy bajo": 1, bajo: 2, medio: 3, alto: 4, "muy alto": 5 };

/**
 * Produce a 2-3 sentence rationale in es/en that references the same
 * qualitative factors the real LLM rationale uses (timeframe match,
 * sector match, co-benefit match, policy support, legal feasibility,
 * expected reduction). City-aware via cityRequest.
 *
 * Structure mirrors the real trace:
 *   "[Ranks high/mid/low] because [pillar reason] and [pillar reason].
 *    [Drawback or supporting factor]."
 */
function generateRationale(
  rank: number,
  action: Action,
  cityRequest: CityRequest
): { es: string; en: string } {
  const actionSectorKey = SECTOR_LABEL_ES[action.sector] ?? action.sector;
  const actionTimeframe = TIMELINE_TO_TIMEFRAME[action.timelineBand];
  const sectorMatch = cityRequest.preferredSectors.includes(actionSectorKey);
  const timeframeMatch = cityRequest.preferredTimeframes.includes(actionTimeframe);
  const matchedCoBenefits = action.coBenefits.filter((c) =>
    cityRequest.preferredCoBenefits.includes(c)
  );
  const cobenefitMatch = matchedCoBenefits.length > 0;
  const reductionStrength = GHG_BAND_RANK[action.ghgReductionBand];
  const highReduction = reductionStrength >= 4;
  const lowReduction = reductionStrength <= 2;

  const placementEs =
    rank === 1
      ? "Esta acción encabeza el ranking"
      : rank <= 3
      ? "Esta acción aparece entre las prioritarias"
      : rank <= 6
      ? "Esta acción se mantiene en la franja media"
      : "Esta acción queda en los últimos puestos del top 10";
  const placementEn =
    rank === 1
      ? "This action tops the ranking"
      : rank <= 3
      ? "This action is among the priority three"
      : rank <= 6
      ? "This action sits in the middle of the pack"
      : "This action ranks in the lower half of the top 10";

  const positivesEs: string[] = [];
  const positivesEn: string[] = [];
  if (sectorMatch) {
    positivesEs.push("coincide con el sector prioritario declarado por la ciudad");
    positivesEn.push("matches the sector the city declared as a priority");
  }
  if (timeframeMatch) {
    positivesEs.push("se ajusta al plazo de implementación que la ciudad prefiere");
    positivesEn.push("fits the implementation timeframe the city prefers");
  }
  if (cobenefitMatch) {
    const list = matchedCoBenefits
      .map((c) =>
        c === "air_quality"
          ? "calidad del aire"
          : c === "mobility"
          ? "movilidad"
          : c === "water_quality"
          ? "calidad del agua"
          : c === "habitat"
          ? "biodiversidad"
          : c === "housing"
          ? "vivienda"
          : c === "cost_of_living"
          ? "costo de vida"
          : "participación ciudadana"
      )
      .join(" y ");
    positivesEs.push(`aporta co-beneficios buscados por la ciudad (${list})`);
    positivesEn.push("delivers co-benefits the city is asking for");
  }
  if (highReduction) {
    positivesEs.push("muestra un potencial de reducción de emisiones alto");
    positivesEn.push("shows a high emissions-reduction potential");
  }

  const negativesEs: string[] = [];
  const negativesEn: string[] = [];
  if (!sectorMatch) {
    negativesEs.push("no coincide con el sector prioritario declarado por la ciudad");
    negativesEn.push("does not match the city's stated sector priority");
  }
  if (!timeframeMatch) {
    negativesEs.push("queda fuera de los plazos preferidos por la ciudad");
    negativesEn.push("falls outside the timeframes the city prefers");
  }
  if (lowReduction) {
    negativesEs.push("su impacto directo en emisiones es limitado");
    negativesEn.push("its direct emissions impact is limited");
  }
  if (!cobenefitMatch && cityRequest.preferredCoBenefits.length > 0) {
    negativesEs.push("no atiende explícitamente los co-beneficios priorizados por la ciudad");
    negativesEn.push("does not explicitly address the city's preferred co-benefits");
  }

  // Compose 2 positives + 1 negative for top half; 1 positive + 2 negatives for bottom half.
  const usedPosEs = positivesEs.slice(0, rank <= 5 ? 2 : 1).join(", y ");
  const usedPosEn = positivesEn.slice(0, rank <= 5 ? 2 : 1).join(", and ");
  const usedNegEs = negativesEs.slice(0, rank <= 5 ? 1 : 2).join("; ");
  const usedNegEn = negativesEn.slice(0, rank <= 5 ? 1 : 2).join("; ");

  const es =
    `${placementEs} porque ${
      usedPosEs || "presenta un balance favorable entre los tres pilares del modelo"
    }.` +
    (usedNegEs
      ? ` Su principal limitación: ${usedNegEs}.`
      : " No se identifican limitaciones significativas frente a los pilares evaluados.");

  const en =
    `${placementEn} because it ${
      usedPosEn || "shows a favorable balance across the three model pillars"
    }.` +
    (usedNegEn
      ? ` Its main limitation: it ${usedNegEn}.`
      : " No significant limitations were identified against the evaluated pillars.");

  return { es, en };
}

/**
 * Pick the next 5 actions for a city — those that rank just outside the top 10.
 * Surfaced as Stage 2 context. Deterministic per city so re-runs match.
 *
 * Selection prefers actions whose sector matches the city's preferred sectors,
 * then falls back to alphabetical actionId order. Excludes anything already in
 * the city's top 10.
 */
function pickNextActions(
  cityId: string,
  cityRequest: CityRequest,
  topActionIds: Set<string>,
  allActions: Action[]
): Array<{ rank: number; actionId: string }> {
  const candidates = allActions.filter((a) => !topActionIds.has(a.actionId));
  const sectorMatches = (a: Action) => {
    const key = SECTOR_LABEL_ES[a.sector] ?? a.sector;
    return cityRequest.preferredSectors.includes(key);
  };
  // Sort: sector-match first, then deterministic by actionId.
  candidates.sort((a, b) => {
    const sa = sectorMatches(a) ? 0 : 1;
    const sb = sectorMatches(b) ? 0 : 1;
    if (sa !== sb) return sa - sb;
    return a.actionId.localeCompare(b.actionId);
  });
  return candidates.slice(0, 5).map((a, i) => ({
    rank: 11 + i,
    actionId: a.actionId,
  }));
}

function main() {
  const actionsPath = join(DATA_DIR, "actions.json");
  const citiesPath = join(DATA_DIR, "cities.json");
  const outputsPath = join(DATA_DIR, "model_outputs.json");

  const actions = JSON.parse(readFileSync(actionsPath, "utf-8")) as Action[];
  const actionMap = new Map<string, Action>(actions.map((a) => [a.actionId, a]));
  const cities = JSON.parse(readFileSync(citiesPath, "utf-8")) as Array<{
    cityId: string;
    [k: string]: unknown;
  }>;
  const outputs = JSON.parse(readFileSync(outputsPath, "utf-8")) as Record<
    string,
    { topActions: RankedAction[]; [k: string]: unknown }
  >;

  // 1. cities.json — attach cityRequest per city.
  for (const city of cities) {
    const req = CITY_REQUESTS[city.cityId];
    if (!req) {
      console.warn(`  ! no cityRequest defined for ${city.cityId}`);
      continue;
    }
    (city as { cityRequest?: CityRequest }).cityRequest = req;
  }
  writeFileSync(citiesPath, JSON.stringify(cities, null, 2) + "\n");
  console.log(`✓ cities.json: cityRequest attached for ${cities.length} cities`);

  // 2. model_outputs.json — attach rationale per ranked action, plus discarded lists + nextActions.
  let attachedRationales = 0;
  let totalNext = 0;
  for (const [cityId, output] of Object.entries(outputs)) {
    const req = CITY_REQUESTS[cityId];
    if (!req) continue;
    for (const ranked of output.topActions) {
      const action = actionMap.get(ranked.actionId);
      if (!action) {
        console.warn(
          `  ! action ${ranked.actionId} (city ${cityId} rank ${ranked.rank}) not in actions.json`
        );
        continue;
      }
      const r = generateRationale(ranked.rank, action, req);
      (ranked as RankedAction & { rationaleEs: string; rationaleEn: string }).rationaleEs = r.es;
      (ranked as RankedAction & { rationaleEs: string; rationaleEn: string }).rationaleEn = r.en;
      attachedRationales++;
    }
    const topIds = new Set(output.topActions.map((t) => t.actionId));
    const next = pickNextActions(cityId, req, topIds, actions);
    output.nextActions = next;
    totalNext += next.length;
    output.discardedLegal = DISCARDED_LEGAL_TEMPLATES[cityId] ?? [];
    output.discardedExcluded = []; // empty by default; populate when a city actually excludes anything
  }
  writeFileSync(outputsPath, JSON.stringify(outputs, null, 2) + "\n");
  console.log(
    `✓ model_outputs.json: ${attachedRationales} rationales attached, ` +
      `${totalNext} nextActions across cities, ` +
      `${Object.values(DISCARDED_LEGAL_TEMPLATES).reduce((s, l) => s + l.length, 0)} legal blocks across cities`
  );
}

main();
