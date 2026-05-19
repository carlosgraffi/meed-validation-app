/**
 * MEED+ ranking pillars — single source of truth.
 *
 * Weights below are taken from the May 16 prioritization trace
 * (hiap-meed/logs_temp/.../input_snapshot.json → resolved_weights). They
 * may evolve once the methodology doc is finalized; update one line here
 * and the disclosure component re-renders everywhere.
 *
 * Labels and descriptions live in `locales/es.json` + `locales/en.json`
 * under `pillars.<key>.label` and `pillars.<key>.description`. We keep
 * display strings in the locales (not inlined here) to preserve the
 * invariant that all expert-facing copy is centralized.
 */
export const PILLARS = {
  impact: { weight: 0.5 },
  alignment: { weight: 0.3 },
  feasibility: { weight: 0.2 },
} as const;

export type PillarKey = keyof typeof PILLARS;

export const PILLAR_KEYS: PillarKey[] = ["impact", "alignment", "feasibility"];

// Sanity check: weights must sum to ~1. Drift indicates a placeholder error.
export function pillarWeightsTotal(): number {
  return PILLAR_KEYS.reduce((s, k) => s + PILLARS[k].weight, 0);
}
