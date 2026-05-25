/**
 * Transform raw HIAP-MEED+ run outputs (response_full.json per city, as
 * produced by the prioritization pipeline in CityCatalyst) into the
 * `data/model_outputs.json` shape this app's fixtures expect.
 *
 * The source files live in `data/_model_runs/CL_<LOCODE>.response_full.json`
 * and are downloaded from the CityCatalyst branch that publishes test runs:
 *   https://github.com/Open-Earth-Foundation/CityCatalyst/tree/on-5754-generate-test-files-hiap/hiap-meed/logs_temp/requests/testing
 *
 * What this script does:
 *   • Reads `ranked_actions` (20 per city) and maps the first 10 → topActions,
 *     ranks 11–15 → nextActions. Ranks 16–20 are dropped to preserve the
 *     existing Stage 2 Precision@10 contract.
 *   • Writes TWO bilingual text fields per top-10 action:
 *       rationaleEs / rationaleEn   — neutral, pillar-band-derived summary
 *                                     (low/moderate/high), no rank-positioning
 *                                     language. Safe to render during the
 *                                     blind Stage 1 / Stage 2 ratings.
 *       explanationEs / explanationEn — the LLM-authored, rank-positioning
 *                                       prose from the model's explanations
 *                                       step (e.g. "This action ranks first
 *                                       because…"). Render ONLY in the
 *                                       reveal stages after the expert has
 *                                       committed their blind set ratings.
 *   • Leaves `discardedLegal` and `discardedExcluded` empty. The legal API
 *     returned 0 records for Chile in these runs (the data team is rebuilding
 *     coverage; for now legal data is intentionally ignored across the app).
 *
 * Usage:
 *   npx tsx scripts/import-model-outputs.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const RUNS_DIR = join(process.cwd(), "data", "_model_runs");
const OUT_PATH = join(process.cwd(), "data", "model_outputs.json");

// Locodes we expect a response_full.json for. Filename convention:
//   CL_<LOCODE>.response_full.json     (underscore instead of space, so the
//   filename is shell-friendly; the cityId inside the file uses a space).
const CITIES = ["CL ZAL", "CL PAO", "CL RNC"];

type RawAction = {
  action_id: string;
  rank: number;
  final_score: number;
  impact_score: number;
  alignment_score: number;
  feasibility_score: number;
  evidence_summary: unknown;
  // Pipeline embeds the LLM explanation here (when the explanations step is
  // enabled). Both `en` and `es` are present in v3+ runs.
  explanations: { en?: string; es?: string } | Record<string, never>;
};

type RawResponse = {
  results: Array<{
    locode: string;
    ranked_action_ids: string[];
    ranked_actions: RawAction[];
  }>;
};

type TopAction = {
  rank: number;
  actionId: string;
  finalScore: number;
  pillarScores: { impact: number; alignment: number; feasibility: number };
  // Neutral pillar-band rationale (no rank-positioning prose). Render during
  // Stage 1 / Stage 2 set-membership ratings; safe vs. anchoring.
  rationaleEs: string;
  rationaleEn: string;
  // LLM-authored prose from the model's explanations step. Rank-positioning
  // by design ("This action ranks first because…"). Render ONLY in the
  // reveal stages — never during the blind Stage 1/2 ratings or Stage 3
  // reorder. Optional because older runs (pre-2026-05-25T18:13 UTC) did not
  // emit explanations or only emitted English.
  explanationEs?: string;
  explanationEn?: string;
};

type NextAction = { rank: number; actionId: string };

type CityOutput = {
  topActions: TopAction[];
  nextActions: NextAction[];
  discardedLegal: never[];
  discardedExcluded: never[];
};

// Pillar score → qualitative band. Thresholds chosen so the bands evenly
// partition the observed [0, 1] score range; tune if the run distribution
// shifts noticeably.
function band(score: number): "low" | "moderate" | "high" {
  if (score < 0.4) return "low";
  if (score < 0.7) return "moderate";
  return "high";
}

// Spanish nouns differ in gender, so the adjective ending changes:
//   impacto (m)        → bajo / moderado / alto
//   alineación (f)     → baja / moderada / alta
//   factibilidad (f)   → baja / moderada / alta
const ES_LABEL: Record<"impact" | "alignment" | "feasibility", Record<ReturnType<typeof band>, string>> = {
  impact:      { low: "bajo",  moderate: "moderado", high: "alto" },
  alignment:   { low: "baja",  moderate: "moderada", high: "alta" },
  feasibility: { low: "baja",  moderate: "moderada", high: "alta" },
};
const EN_LABEL: Record<"impact" | "alignment" | "feasibility", Record<ReturnType<typeof band>, string>> = {
  impact:      { low: "low", moderate: "moderate", high: "high" },
  alignment:   { low: "low", moderate: "moderate", high: "high" },
  feasibility: { low: "low", moderate: "moderate", high: "high" },
};

function buildRationale(
  _rank: number,
  imp: number,
  aln: number,
  fea: number
): { es: string; en: string } {
  // Rank-neutral pillar-band summary. The rank position is intentionally
  // NOT mentioned here — that prose belongs to the LLM `explanation*` fields,
  // which the UI exposes only after the expert has committed their blind
  // Stage 1 / Stage 2 set ratings.
  const bands = {
    impact: band(imp),
    alignment: band(aln),
    feasibility: band(fea),
  };
  const es =
    `Perfil agregado del modelo: ` +
    `impacto ${ES_LABEL.impact[bands.impact]}, ` +
    `alineación con políticas ${ES_LABEL.alignment[bands.alignment]} y ` +
    `factibilidad de implementación ${ES_LABEL.feasibility[bands.feasibility]}.`;
  const en =
    `Model profile: ` +
    `${EN_LABEL.impact[bands.impact]} impact, ` +
    `${EN_LABEL.alignment[bands.alignment]} policy alignment, and ` +
    `${EN_LABEL.feasibility[bands.feasibility]} implementation feasibility.`;
  return { es, en };
}

function transformOneCity(raw: RawResponse, expectedLocode: string): CityOutput {
  if (!Array.isArray(raw.results) || raw.results.length === 0) {
    throw new Error(`response_full.json missing results array (locode=${expectedLocode})`);
  }
  const result = raw.results[0];
  if (result.locode !== expectedLocode) {
    throw new Error(
      `response_full.json locode mismatch: expected ${expectedLocode}, got ${result.locode}`
    );
  }
  const ranked = [...result.ranked_actions].sort((a, b) => a.rank - b.rank);
  if (ranked.length < 15) {
    throw new Error(
      `${expectedLocode}: need at least 15 ranked actions for top-10 + next-5, got ${ranked.length}`
    );
  }

  const topActions: TopAction[] = ranked.slice(0, 10).map((a) => {
    const { es, en } = buildRationale(a.rank, a.impact_score, a.alignment_score, a.feasibility_score);
    // Pull both ES and EN out of the LLM explanations payload when present.
    // Trim — the upstream sometimes includes trailing newlines.
    const exp = a.explanations ?? {};
    const explanationEn =
      typeof exp.en === "string" && exp.en.trim().length > 0 ? exp.en.trim() : undefined;
    const explanationEs =
      typeof exp.es === "string" && exp.es.trim().length > 0 ? exp.es.trim() : undefined;
    return {
      rank: a.rank,
      actionId: a.action_id,
      finalScore: round3(a.final_score),
      pillarScores: {
        impact: round3(a.impact_score),
        alignment: round3(a.alignment_score),
        feasibility: round3(a.feasibility_score),
      },
      rationaleEs: es,
      rationaleEn: en,
      ...(explanationEs ? { explanationEs } : {}),
      ...(explanationEn ? { explanationEn } : {}),
    };
  });

  const nextActions: NextAction[] = ranked.slice(10, 15).map((a) => ({
    rank: a.rank,
    actionId: a.action_id,
  }));

  return {
    topActions,
    nextActions,
    discardedLegal: [],
    discardedExcluded: [],
  };
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function main() {
  const outputs: Record<string, CityOutput> = {};
  for (const locode of CITIES) {
    // Filename uses underscore: "CL_ZAL.response_full.json"
    const fileSlug = locode.replace(/\s+/g, "_");
    const path = join(RUNS_DIR, `${fileSlug}.response_full.json`);
    const raw = JSON.parse(readFileSync(path, "utf-8")) as RawResponse;
    outputs[locode] = transformOneCity(raw, locode);
    console.log(
      `  ✓ ${locode}: top-10 + next-5 written ` +
        `(top rank-1 = ${outputs[locode].topActions[0].actionId})`
    );
  }
  writeFileSync(OUT_PATH, JSON.stringify(outputs, null, 2) + "\n");
  console.log(`✓ Wrote ${OUT_PATH}`);
}

main();
