/**
 * Light expert-facing anonymization for city display names.
 *
 * We swap the real city name (Valdivia / Paillaco / Lago Ranco) for a stable
 * neutral alias ("Ciudad A" / "City A", etc.) in every surface an expert sees
 * — dashboard cards, the evaluation banner / sidebar / drawer, the context
 * sheet title — so the experts' pre-existing knowledge of specific Chilean
 * cities doesn't bias their ratings.
 *
 * What is NOT anonymized:
 *   - cityId. The URL `/evaluate/[cityId]` still uses the real cityId, so
 *     existing magic links keep working without re-mint.
 *   - region, biome, emissions, indicators. Domain experts could still
 *     fingerprint a city from its profile — this is light anonymization, not
 *     a blind study.
 *   - admin views. Admin pages render `c.displayName` directly (not through
 *     the `useCityText` helper) and continue to see real names for
 *     reassignment / monitoring.
 *
 * The mapping is intentionally hardcoded (not derived from the cities.json
 * order) so the alias for a given cityId is deterministic across deploys.
 * If we onboard a fourth city, add a row here.
 */

export const CITY_ALIASES: Record<string, { es: string; en: string }> = {
  "CL PAO": { es: "Ciudad A", en: "City A" },
  "CL RNC": { es: "Ciudad B", en: "City B" },
  "CL ZAL": { es: "Ciudad C", en: "City C" },
};

export function aliasFor(cityId: string, lang: "es" | "en"): string {
  const row = CITY_ALIASES[cityId];
  if (!row) return cityId; // unknown city: fall back to the id rather than leak the real name
  return row[lang];
}
