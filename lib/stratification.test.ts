import { describe, it, expect } from "vitest";
import { stratify } from "./stratification";
import type { City, ExpertFixture } from "./fixtures";

const fakeExperts = (n: number): ExpertFixture[] =>
  Array.from({ length: n }, (_, i) => ({
    expertId: `exp_${String(i + 1).padStart(2, "0")}`,
    email: `exp${i + 1}@example.com`,
    fullName: `Expert ${i + 1}`,
    sectorSpecialization: null,
  }));

const fakeCities = (n: number): City[] =>
  Array.from({ length: n }, (_, i) => ({
    cityId: `city_${String(i + 1).padStart(2, "0")}`,
    displayName: `City ${i + 1}`,
    population: 100000,
    populationDensity: 1000,
    region: "R",
    biome: "B",
    elevationM: 100,
    sectorEmissions: {
      stationaryEnergy: 1000,
      transportation: 1000,
      waste: 1000,
      ippu: null,
      afolu: null,
    },
    totalEmissions: 3000,
    topHazards: [
      { hazard: "drought", riskScore: 0.5 },
      { hazard: "heatwave", riskScore: 0.5 },
      { hazard: "flood", riskScore: 0.5 },
    ],
    statedSectorPriority: null,
  }));

describe("stratification", () => {
  const experts = fakeExperts(13);
  const cities = fakeCities(10);

  it("produces 52 total assignments", () => {
    const r = stratify(experts, cities);
    expect(r.length).toBe(52);
  });

  it("gives each expert 3–5 cities (avg 4)", () => {
    const r = stratify(experts, cities);
    const counts: Record<string, number> = {};
    for (const a of r) counts[a.expertId] = (counts[a.expertId] ?? 0) + 1;
    for (const v of Object.values(counts)) {
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(5);
    }
    expect(Object.keys(counts).length).toBe(13);
  });

  it("gives each city 5–6 experts", () => {
    const r = stratify(experts, cities);
    const counts: Record<string, number> = {};
    for (const a of r) counts[a.cityId] = (counts[a.cityId] ?? 0) + 1;
    for (const v of Object.values(counts)) {
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThanOrEqual(6);
    }
    expect(Object.keys(counts).length).toBe(10);
  });

  it("is deterministic across re-runs with same inputs", () => {
    const r1 = stratify(experts, cities);
    const r2 = stratify(experts, cities);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });

  it("honors at least one preference when set", () => {
    const exps = experts.map((e, i) =>
      i === 0
        ? { ...e, preferredCityIds: "city_05,city_07" }
        : e
    );
    const r = stratify(exps as ExpertFixture[], cities);
    const e0 = r.filter((a) => a.expertId === "exp_01").map((a) => a.cityId);
    expect(e0.includes("city_05") || e0.includes("city_07")).toBe(true);
  });
});
