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
    statedSectorPriority: null,
    cityRequest: {
      preferredSectors: [],
      preferredTimeframes: [],
      preferredCoBenefits: [],
      excludedActionIds: [],
    },
  }));

describe("stratification", () => {
  const experts = fakeExperts(13);
  const cities = fakeCities(10);

  it("produces 52 total assignments", () => {
    const r = stratify(experts, cities);
    expect(r.length).toBe(52);
  });

  it("gives every expert EXACTLY 4 cities (no 3, no 5)", () => {
    const r = stratify(experts, cities);
    const counts: Record<string, number> = {};
    for (const a of r) counts[a.expertId] = (counts[a.expertId] ?? 0) + 1;
    for (const [expertId, v] of Object.entries(counts)) {
      expect(v, `expert ${expertId} should have exactly 4 cities`).toBe(4);
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
      i === 0 ? { ...e, preferredCityIds: "city_05,city_07" } : e
    );
    const r = stratify(exps as ExpertFixture[], cities);
    const e0 = r.filter((a) => a.expertId === "exp_01").map((a) => a.cityId);
    expect(e0.includes("city_05") || e0.includes("city_07")).toBe(true);
  });

  // Regression test for the "2 prefs → 3 cities" / "1 pref → 4" bug. Whatever
  // preference combo the expert sends, they should always receive exactly 4 cities.
  it.each([
    { name: "0 prefs", prefs: "" },
    { name: "1 pref",  prefs: "city_03" },
    { name: "2 prefs", prefs: "city_05,city_07" },
    // 3 prefs isn't a UI option (UI caps at 2), but the algorithm should tolerate it.
    { name: "3 prefs", prefs: "city_02,city_05,city_07" },
  ])("gives exp_01 exactly 4 cities with $name", ({ prefs }) => {
    const exps = experts.map((e, i) =>
      i === 0 ? { ...e, preferredCityIds: prefs } : e
    );
    const r = stratify(exps as ExpertFixture[], cities);
    const e0Count = r.filter((a) => a.expertId === "exp_01").length;
    expect(e0Count).toBe(4);
  });
});
