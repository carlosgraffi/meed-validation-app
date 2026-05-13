/**
 * Deterministic seeded shuffle used by Stage 1 / Stage 2 of the evaluation
 * flow. Same (evaluationId, cityId, stageNumber) → same display order on
 * every page load, so save/resume returns the user to the same arrangement.
 *
 * Algorithm: mulberry32 PRNG seeded by a 32-bit hash of the seed string.
 * Fisher–Yates shuffle.
 */
import { createHash } from "node:crypto";

export function seededShuffle<T>(arr: T[], seed: string): T[] {
  const buf = createHash("sha256").update(seed).digest();
  const rng = mulberry32(buf.readUInt32BE(0));
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

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
