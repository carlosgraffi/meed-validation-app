/**
 * MEED+ ranking pillars — single source of truth.
 *
 * The model combines three pillars with the weights below to produce final
 * action rankings. These weights are PLACEHOLDERS pending the methodology
 * doc finalization (Mirco / Ayinawu, expected next week). To swap them in,
 * change `weight` for each entry. Keep the keys (`impact`, `alignment`,
 * `feasibility`) — they're referenced everywhere else.
 *
 * Labels and descriptions live in `locales/es.json` under `pillars.<key>.label`
 * and `pillars.<key>.description`. We deliberately keep them in the locale
 * rather than inlining them here (as the brief suggested), to preserve the
 * project-wide invariant that all expert-facing Spanish copy is centralized
 * in one file. This file is the source of truth for the *numerical* model;
 * the locale is the source of truth for *display strings*.
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
