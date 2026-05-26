/**
 * MEED+ ranking pillars — single source of truth.
 *
 * Weights below match the resolved_weights from Amanda's input config
 * (input_snapshot.json → resolved_weights) and the standard MEED+ run
 * config. Update one line here and the disclosure component re-renders
 * everywhere.
 *
 * Labels and descriptions live in `locales/es.json` + `locales/en.json`
 * under `pillars.<key>.label` and `pillars.<key>.description`. We keep
 * display strings in the locales (not inlined here) to preserve the
 * invariant that all expert-facing copy is centralized.
 */
export const PILLARS = {
  impact: { weight: 0.55 },
  alignment: { weight: 0.22 },
  feasibility: { weight: 0.23 },
} as const;

export type PillarKey = keyof typeof PILLARS;

export const PILLAR_KEYS: PillarKey[] = ["impact", "alignment", "feasibility"];

// Sanity check: weights must sum to ~1. Drift indicates a placeholder error.
export function pillarWeightsTotal(): number {
  return PILLAR_KEYS.reduce((s, k) => s + PILLARS[k].weight, 0);
}
