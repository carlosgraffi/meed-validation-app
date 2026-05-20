import { createHash } from "node:crypto";
import type { City, ExpertFixture } from "./fixtures";

export type Assignment = { expertId: string; cityId: string };

/**
 * Deterministic stratification.
 *
 * Inputs:
 *   - experts: 13 expert records (with optional preferredCityIds as comma-separated string)
 *   - cities: 10 city records
 *   - citiesPerExpert: 4 (strict — every expert gets exactly this many cities)
 *
 * Guarantees:
 *   - Every expert gets EXACTLY citiesPerExpert (default 4) cities. No 3, no 5 — the
 *     spec previously allowed 3–5, but in practice Carlos wants strict equality so
 *     every expert tests the same workload.
 *   - Every city gets between 5 and 6 experts.
 *   - Total assignments = 13 × 4 = 52, distributed as 8 cities × 5 + 2 cities × 6.
 *   - If an expert has preferredCityIds, at least one preference is honored when possible.
 *   - Re-running with the same inputs produces identical assignments (seeded RNG).
 *
 * Strategy:
 *   1. Derive a deterministic seed from the canonical hash of experts (sorted by id).
 *   2. Build a target per-city count vector summing to 52.
 *   3. For each expert, assign cities one-by-one in a seeded shuffle, honoring preferences first,
 *      and picking among cities that are below their target city count.
 *   4. Validate the result satisfies all constraints; if not (rare with this construction), retry
 *      with an incremented seed up to 20 times.
 */
export function stratify(
  experts: ExpertFixture[],
  cities: City[],
  options: { citiesPerExpert?: number } = {}
): Assignment[] {
  const citiesPerExpert = options.citiesPerExpert ?? 4;
  if (experts.length !== 13) {
    throw new Error(`stratify expects 13 experts, got ${experts.length}`);
  }
  if (cities.length !== 10) {
    throw new Error(`stratify expects 10 cities, got ${cities.length}`);
  }

  const totalAssignments = experts.length * citiesPerExpert;
  // 52 = 10*5 + 2 extra → 2 cities get 6 experts, 8 cities get 5.
  const baseCount = Math.floor(totalAssignments / cities.length);
  const extras = totalAssignments % cities.length;

  // Canonical seed derived from a hash of sorted expert IDs.
  const expertIdsSorted = [...experts].map((e) => e.expertId).sort();
  const baseSeed = createHash("sha256")
    .update(expertIdsSorted.join("|"))
    .digest();

  for (let attempt = 0; attempt < 20; attempt++) {
    const rng = mulberry32(seedFromBuffer(baseSeed, attempt));
    const result = tryAssign(experts, cities, citiesPerExpert, baseCount, extras, rng);
    if (result) return result;
  }
  throw new Error("stratify: failed to find a valid assignment after 20 attempts (should not happen)");
}

function tryAssign(
  experts: ExpertFixture[],
  cities: City[],
  citiesPerExpert: number,
  baseCount: number,
  extras: number,
  rng: () => number
): Assignment[] | null {
  const cityIds = cities.map((c) => c.cityId);

  // Per-city target counts: `extras` random cities get baseCount+1, rest get baseCount.
  const shuffledCityIdx = seededShuffle(
    cityIds.map((_, i) => i),
    rng
  );
  const targets: Record<string, number> = {};
  for (let i = 0; i < cityIds.length; i++) {
    targets[cityIds[i]] = baseCount;
  }
  for (let i = 0; i < extras; i++) {
    targets[cityIds[shuffledCityIdx[i]]] = baseCount + 1;
  }

  const cityFill: Record<string, number> = Object.fromEntries(
    cityIds.map((id) => [id, 0])
  );
  const assignments: Assignment[] = [];

  // Process experts in a stable order, but pick cities with a seeded RNG.
  const sortedExperts = [...experts].sort((a, b) =>
    (a.expertId ?? "").localeCompare(b.expertId ?? "")
  );

  // Track which experts have already had at least one preference honored.
  for (const expert of sortedExperts) {
    const preferredRaw = (expert as { preferredCityIds?: string }).preferredCityIds ?? "";
    const preferred = preferredRaw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && cityFill[s] !== undefined);

    const assigned = new Set<string>();
    const expertId = expert.expertId;

    // Try to honor a preference first.
    if (preferred.length > 0) {
      const availablePrefs = preferred.filter(
        (cid) => cityFill[cid] < targets[cid]
      );
      if (availablePrefs.length > 0) {
        const pick = availablePrefs[Math.floor(rng() * availablePrefs.length)];
        assigned.add(pick);
        cityFill[pick]++;
        assignments.push({ expertId, cityId: pick });
      }
    }

    while (assigned.size < citiesPerExpert) {
      // Pick from cities that still have capacity and aren't already assigned to this expert.
      const candidates = cityIds.filter(
        (cid) => !assigned.has(cid) && cityFill[cid] < targets[cid]
      );
      if (candidates.length === 0) {
        // Stuck — no city has capacity but this expert needs more cities.
        return null;
      }
      // Prefer cities with the lowest fill ratio to keep variance low.
      const minFill = Math.min(...candidates.map((cid) => cityFill[cid]));
      const tied = candidates.filter((cid) => cityFill[cid] === minFill);
      const pick = tied[Math.floor(rng() * tied.length)];
      assigned.add(pick);
      cityFill[pick]++;
      assignments.push({ expertId, cityId: pick });
    }
  }

  // Validate constraints
  for (const cid of cityIds) {
    if (cityFill[cid] !== targets[cid]) return null;
    if (cityFill[cid] < 5 || cityFill[cid] > 6) return null;
  }
  const perExpert: Record<string, number> = {};
  for (const a of assignments) perExpert[a.expertId] = (perExpert[a.expertId] ?? 0) + 1;
  // Strict: every expert must have EXACTLY citiesPerExpert cities.
  for (const v of Object.values(perExpert)) {
    if (v !== citiesPerExpert) return null;
  }

  return assignments;
}

function seedFromBuffer(buf: Buffer, attempt: number): number {
  // Take first 4 bytes as unsigned 32-bit, XOR with attempt, mod to seedable range.
  const x = buf.readUInt32BE(0) ^ (attempt * 2654435761);
  return x >>> 0;
}

// Mulberry32 — small, deterministic PRNG.
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
