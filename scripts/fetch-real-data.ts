/**
 * One-shot data importer for the real-data demo.
 *
 * Reads cached payloads from /tmp/meed-real-data (fetched by hand from the
 * global-API + the SSG CSV repo on GitHub) and writes the full set of
 * fixture files the app consumes:
 *
 *   data/cities.json                     3 real cities with rich indicators
 *   data/actions.json                    102 mitigation actions (canonical catalog)
 *   data/model_outputs.json              fabricated top-10 + next-5 per city
 *                                         (placeholder until Mirco runs the
 *                                          model — Monday)
 *   data/action-policy-scores.json       per-city × per-action policy alignment
 *   data/action-legal-assessments.json   per-action legal verdict (country-wide)
 *   data/action-feasibility-scores.json  per-city × per-action feasibility +
 *                                         city_indicators breakdown
 *
 * Re-runnable. Safe to commit the output JSONs to the repo.
 *
 * Usage:
 *   1. Ensure /tmp/meed-real-data contains the cached API + CSV files
 *   2. npx tsx scripts/fetch-real-data.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const CACHE = "/tmp/meed-real-data";
const DATA = join(process.cwd(), "data");

// ──────────────────────────────────────────────────────────────────────────
// City config
// ──────────────────────────────────────────────────────────────────────────

const CITIES = [
  { locode: "CL ZAL", slug: "CL_ZAL", inventoryFile: "Inventory-Valdivia-2020.csv" },
  { locode: "CL PAO", slug: "CL_PAO", inventoryFile: "Inventory-Paillaco-2020.csv" },
  { locode: "CL RNC", slug: "CL_RNC", inventoryFile: "Inventory-Lago_Ranco-2020.csv" },
] as const;

// Spanish region labels — the API returns Chilean region codes, but the
// human-readable region_name comes back English-formatted ("Los Ríos");
// for ES we want "Región de Los Ríos" etc.
const REGION_LABELS_ES: Record<string, string> = {
  "Los Ríos": "Región de Los Ríos",
};

// ──────────────────────────────────────────────────────────────────────────
// Sector / subsector / band translations
// ──────────────────────────────────────────────────────────────────────────

const SECTOR_ES: Record<string, string> = {
  stationary_energy: "Energía estacionaria",
  transportation: "Transporte",
  Transport: "Transporte", // catalog data inconsistency
  waste: "Residuos",
  ippu: "IPPU",
  afolu: "AFOLU",
};
const SECTOR_EN: Record<string, string> = {
  stationary_energy: "Stationary energy",
  transportation: "Transportation",
  Transport: "Transportation",
  waste: "Waste",
  ippu: "IPPU",
  afolu: "AFOLU",
};

// Subsector translations. Snake-case keys from the catalog → human labels.
// Anything unmapped falls back to a sentence-case formatting at render time.
const SUBSECTOR_ES: Record<string, string> = {
  residential_buildings: "Edificios residenciales",
  commercial_buildings: "Edificios comerciales",
  commercial_and_institutional_buildings_and_facilities: "Edificios comerciales e institucionales",
  institutional_buildings: "Edificios institucionales",
  public_buildings: "Edificios públicos",
  municipal_buildings: "Edificios municipales",
  industrial_buildings: "Edificios industriales",
  new_buildings: "Construcción nueva",
  existing_buildings: "Edificación existente",
  manufacturing_industries_and_construction: "Manufactura y construcción",
  energy_industries: "Industria energética",
  agriculture_forestry_and_fishing_activities: "Agricultura, silvicultura y pesca",
  fugitive_emissions_from_oil_and_natural_gas_systems: "Emisiones fugitivas de petróleo y gas",
  fugitive_emissions_from_coal: "Emisiones fugitivas de carbón",
  on_road_transportation: "Transporte por carretera",
  off_road_transportation: "Transporte fuera de carretera",
  railways: "Ferrocarriles",
  waterborne_navigation: "Navegación",
  aviation: "Aviación",
  solid_waste_disposal: "Disposición final de residuos sólidos",
  biological_treatment_of_waste: "Tratamiento biológico de residuos",
  incineration_and_open_burning: "Incineración y quema",
  wastewater_treatment_and_discharge: "Tratamiento de aguas servidas",
  industrial_processes: "Procesos industriales",
  product_uses: "Uso de productos",
  livestock: "Ganadería",
  land: "Tierra",
  forestry: "Silvicultura",
  aggregate_sources_and_non_co2_sources: "Fuentes agregadas y no-CO₂",
  cooking_and_heating: "Cocción y calefacción",
};
const SUBSECTOR_EN: Record<string, string> = {
  residential_buildings: "Residential buildings",
  commercial_buildings: "Commercial buildings",
  commercial_and_institutional_buildings_and_facilities: "Commercial and institutional buildings",
  institutional_buildings: "Institutional buildings",
  public_buildings: "Public buildings",
  municipal_buildings: "Municipal buildings",
  industrial_buildings: "Industrial buildings",
  new_buildings: "New construction",
  existing_buildings: "Existing buildings",
  manufacturing_industries_and_construction: "Manufacturing and construction",
  energy_industries: "Energy industries",
  agriculture_forestry_and_fishing_activities: "Agriculture, forestry, fishing",
  fugitive_emissions_from_oil_and_natural_gas_systems: "Fugitive emissions from oil and gas",
  fugitive_emissions_from_coal: "Fugitive emissions from coal",
  on_road_transportation: "On-road transportation",
  off_road_transportation: "Off-road transportation",
  railways: "Railways",
  waterborne_navigation: "Waterborne navigation",
  aviation: "Aviation",
  solid_waste_disposal: "Solid waste disposal",
  biological_treatment_of_waste: "Biological treatment of waste",
  incineration_and_open_burning: "Incineration and burning",
  wastewater_treatment_and_discharge: "Wastewater treatment",
  industrial_processes: "Industrial processes",
  product_uses: "Product uses",
  livestock: "Livestock",
  land: "Land",
  forestry: "Forestry",
  aggregate_sources_and_non_co2_sources: "Aggregate and non-CO₂ sources",
  cooking_and_heating: "Cooking and heating",
};

function titleCase(snake: string): string {
  return snake
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// Normalize GHGReductionPotential string into our 5-band keyspace.
// The API returns sector-keyed objects with values like "0-19" / "20-39" /
// "40-59" / "60-79" / "80-100" — or sometimes "low" / "medium" / "high".
function normalizeGhgBand(raw: string | null | undefined): string {
  if (!raw) return "bajo";
  const s = String(raw).toLowerCase().trim();
  if (s === "0-19") return "muy bajo";
  if (s === "20-39") return "bajo";
  if (s === "40-59") return "medio";
  if (s === "60-79") return "alto";
  if (s === "80-100") return "muy alto";
  if (s === "very low") return "muy bajo";
  if (s === "low") return "bajo";
  if (s === "medium" || s === "moderate") return "medio";
  if (s === "high") return "alto";
  if (s === "very high") return "muy alto";
  return "bajo";
}
function normalizeCostBand(raw: string | null | undefined): "bajo" | "medio" | "alto" {
  const s = String(raw ?? "").toLowerCase().trim();
  if (s === "low") return "bajo";
  if (s === "medium" || s === "moderate") return "medio";
  if (s === "high") return "alto";
  return "medio";
}
function normalizeTimeline(raw: string | null | undefined): "corto plazo" | "mediano plazo" | "largo plazo" {
  const s = String(raw ?? "").toLowerCase().trim();
  if (s.includes("<5") || s.includes("less than 5") || s === "short") return "corto plazo";
  if (s.includes(">10") || s.includes("more than 10") || s === "long") return "largo plazo";
  return "mediano plazo";
}

// ──────────────────────────────────────────────────────────────────────────
// City attribute grouping for the sidebar / sheet
// ──────────────────────────────────────────────────────────────────────────

type IndicatorGroup = "people" | "economy" | "land" | "infrastructure";

const INDICATOR_META: Record<
  string,
  { group: IndicatorGroup; labelEs: string; labelEn: string; unitOverride?: string; priority: number }
> = {
  population: { group: "people", labelEs: "Población", labelEn: "Population", priority: 1 },
  mean_years_schooling: { group: "people", labelEs: "Años de escolaridad", labelEn: "Mean years of schooling", priority: 4 },
  literacy_rate: { group: "people", labelEs: "Alfabetización", labelEn: "Literacy rate", priority: 5 },
  indigenous_identification_rate: { group: "people", labelEs: "Identificación indígena", labelEn: "Indigenous identification", priority: 2 },
  disability_prevalence: { group: "people", labelEs: "Prevalencia de discapacidad", labelEn: "Disability prevalence", priority: 6 },
  median_household_income: { group: "economy", labelEs: "Ingreso mediano del hogar", labelEn: "Median household income", priority: 1 },
  poverty_rate: { group: "economy", labelEs: "Pobreza", labelEn: "Poverty rate", priority: 2 },
  unemployment_rate: { group: "economy", labelEs: "Desempleo", labelEn: "Unemployment rate", priority: 3 },
  employment_agriculture_utilities: { group: "economy", labelEs: "Empleo en agricultura", labelEn: "Employment in agriculture", priority: 4 },
  industry_construction_employment: { group: "economy", labelEs: "Empleo en industria y construcción", labelEn: "Employment in industry and construction", priority: 5 },
  employment_in_transport_and_logistics: { group: "economy", labelEs: "Empleo en transporte y logística", labelEn: "Employment in transport and logistics", priority: 6 },
  urban_built_share: { group: "land", labelEs: "Suelo urbano construido", labelEn: "Urban built-up land", priority: 1 },
  primary_forest_share: { group: "land", labelEs: "Bosque primario", labelEn: "Primary forest", priority: 2 },
  secondary_forest_share: { group: "land", labelEs: "Bosque secundario", labelEn: "Secondary forest", priority: 3 },
  pasture_share: { group: "land", labelEs: "Pastizal manejado", labelEn: "Pasture", priority: 4 },
  silviculture_share: { group: "land", labelEs: "Silvicultura", labelEn: "Silviculture", priority: 5 },
  grassland_share: { group: "land", labelEs: "Praderas naturales", labelEn: "Natural grassland", priority: 6 },
  shrubland_share: { group: "land", labelEs: "Matorral", labelEn: "Shrubland", priority: 7 },
  wetland_share: { group: "land", labelEs: "Humedales", labelEn: "Wetlands", priority: 8 },
  water_share: { group: "land", labelEs: "Cuerpos de agua", labelEn: "Water bodies", priority: 9 },
  beach_dune_share: { group: "land", labelEs: "Playas y dunas", labelEn: "Beaches and dunes", priority: 10 },
  electricity_access_rate: { group: "infrastructure", labelEs: "Acceso a electricidad", labelEn: "Electricity access", priority: 1 },
  fixed_internet_household_share: { group: "infrastructure", labelEs: "Internet fijo en hogares", labelEn: "Fixed internet households", priority: 2 },
  public_transport_share: { group: "infrastructure", labelEs: "Uso de transporte público", labelEn: "Public transport share", priority: 3 },
  home_ownership: { group: "infrastructure", labelEs: "Propiedad de vivienda", labelEn: "Home ownership", priority: 4 },
  renter_share: { group: "infrastructure", labelEs: "Arrendatarios", labelEn: "Renters", priority: 5 },
};

// ──────────────────────────────────────────────────────────────────────────
// Inventory CSV parsing
// ──────────────────────────────────────────────────────────────────────────

type SectorEmissions = {
  stationaryEnergy: number;
  transportation: number;
  waste: number;
  ippu: number | null;
  afolu: number | null;
};

function parseInventory(file: string): { sectorEmissions: SectorEmissions; subsectorEmissions: Record<string, number>; total: number } {
  const raw = readFileSync(join(CACHE, file), "utf-8");
  const lines = raw.split("\n").filter((l) => l.trim().length > 0);
  const subsectorEmissions: Record<string, number> = {};
  const sectorTotals: Record<string, number> = {};
  for (const line of lines.slice(1)) {
    const cols = line.split(",");
    const code = cols[1]?.trim();
    const emissionsStr = cols[4]?.trim();
    if (!code || !emissionsStr) continue;
    const emissions = parseFloat(emissionsStr);
    if (Number.isNaN(emissions)) continue;
    // Top sector level: single roman numeral I-V
    if (/^[IVX]+$/.test(code)) {
      sectorTotals[code] = emissions;
    } else if (/^[IVX]+\.[0-9]+$/.test(code)) {
      subsectorEmissions[code] = emissions;
    }
  }
  const sectorEmissions: SectorEmissions = {
    stationaryEnergy: sectorTotals["I"] ?? 0,
    transportation: sectorTotals["II"] ?? 0,
    waste: sectorTotals["III"] ?? 0,
    ippu: sectorTotals["IV"] ?? null,
    afolu: sectorTotals["V"] ?? null,
  };
  const total = Object.values(sectorTotals).reduce((s, v) => s + (v ?? 0), 0);
  return { sectorEmissions, subsectorEmissions, total };
}

// ──────────────────────────────────────────────────────────────────────────
// Fabricated rankings per city (placeholder until Mirco delivers Monday)
// ──────────────────────────────────────────────────────────────────────────

const FABRICATED_RANKINGS: Record<string, { top10: string[]; next5: string[] }> = {
  // Valdivia — urban infrastructure: residential + public-building retrofits,
  // electrified transit, solar on municipal facilities, organic waste.
  "CL ZAL": {
    top10: [
      "c40_0015", // Retrofit residential buildings for energy efficiency
      "c40_0023", // Adopt zero-emission bus fleets for public transport
      "icare_0012", // Expand solar generation on municipal facilities
      "c40_0010", // EE standards for new residential buildings
      "c40_0017", // Retrofit municipal buildings
      "icare_0016", // Solar thermal + heat pumps for water heating
      "c40_0029", // Electrify municipal vehicle fleets
      "icare_0064", // Organic waste management strategy
      "c40_0037", // Segregated collection of recyclables
      "icare_0010", // Net-Zero / Green Building Certifications
    ],
    next5: ["c40_0012", "c40_0016", "icare_0110", "icare_0072", "ipcc_0067"],
  },
  // Paillaco — purest dairy belt: manure management, enteric fermentation,
  // pasture restoration, organics, agroforestry.
  "CL PAO": {
    top10: [
      "ipcc_0067", // Improve manure management and crop nutrient practices
      "ipcc_0064", // Reduce methane from enteric fermentation
      "ipcc_0056", // Reduce grassland degradation / conversion
      "icare_0050", // Agroforestry
      "icare_0045", // Regenerative / agroecological agriculture
      "icare_0064", // Organic waste management strategy
      "ipcc_0055", // Fire management in grasslands
      "icare_0099", // Agroecological certification programmes
      "ipcc_0053", // Afforestation, reforestation, restoration
      "icare_0131", // Local agroecological public procurement
    ],
    next5: ["icare_0006", "icare_0101", "icare_0127", "c40_0036", "icare_0132"],
  },
  // Lago Ranco — forest NBS + agroecology, lowest income, 52% indigenous.
  "CL RNC": {
    top10: [
      "ipcc_0053", // Afforestation, reforestation, ecosystem restoration
      "icare_0050", // Agroforestry
      "ipcc_0052", // Reduce deforestation and degradation
      "ipcc_0054", // Sustainable forest management
      "icare_0045", // Regenerative / agroecological agriculture
      "icare_0006", // Rural microgrids (solar + storage)
      "icare_0099", // Agroecological certification
      "icare_0128", // Payment for environmental services
      "icare_0132", // Local agroecological production and short chains
      "ipcc_0056", // Reduce grassland degradation
    ],
    next5: ["icare_0069", "icare_0127", "ipcc_0055", "icare_0131", "icare_0064"],
  },
};

// ──────────────────────────────────────────────────────────────────────────
// Transforms
// ──────────────────────────────────────────────────────────────────────────

type CatalogAction = {
  ActionID: string;
  ActionName: { en: string; es: string; pt?: string };
  ActionType: string[];
  Sector: string[];
  Subsector: string[];
  Description: { en: string; es: string; pt?: string };
  CoBenefits: Record<string, number>;
  GHGReductionPotential: Record<string, string | null> | null;
  CostInvestmentNeeded: string | null;
  TimelineForImplementation: string | null;
};

function buildActions() {
  const raw = JSON.parse(readFileSync(join(CACHE, "climate_actions.json"), "utf-8")) as CatalogAction[];
  const mitigation = raw.filter((a) => a.ActionType?.[0] === "mitigation");

  const out = mitigation.map((a) => {
    const sectorRaw = a.Sector?.[0] ?? "stationary_energy";
    const subsectorRaw = a.Subsector?.[0] ?? null;
    const ghgRaw = a.GHGReductionPotential ? a.GHGReductionPotential[sectorRaw] : null;
    const idPrefix = (a.ActionID.split("_")[0] || "icare").toLowerCase();
    const source = (["icare", "ipcc", "c40"] as const).includes(idPrefix as never)
      ? (idPrefix as "icare" | "ipcc" | "c40")
      : "icare";
    const coBenefits = Object.entries(a.CoBenefits ?? {})
      .filter(([, v]) => typeof v === "number" && v > 0)
      .map(([k]) => k);

    return {
      actionId: a.ActionID,
      source,
      nameEs: a.ActionName.es,
      nameEn: a.ActionName.en,
      descriptionEs: a.Description.es,
      descriptionEn: a.Description.en,
      sector: SECTOR_ES[sectorRaw] ?? sectorRaw,
      sectorEn: SECTOR_EN[sectorRaw] ?? sectorRaw,
      subsector: subsectorRaw ? SUBSECTOR_ES[subsectorRaw] ?? titleCase(subsectorRaw) : null,
      subsectorEn: subsectorRaw ? SUBSECTOR_EN[subsectorRaw] ?? titleCase(subsectorRaw) : null,
      ghgReductionBand: normalizeGhgBand(ghgRaw),
      costBand: normalizeCostBand(a.CostInvestmentNeeded),
      timelineBand: normalizeTimeline(a.TimelineForImplementation),
      coBenefits,
    };
  });
  return out;
}

function buildCities(actions: ReturnType<typeof buildActions>) {
  const actionMap = new Map(actions.map((a) => [a.actionId, a]));
  return CITIES.map(({ locode, slug, inventoryFile }) => {
    const attr = JSON.parse(
      readFileSync(join(CACHE, `city_attributes_${slug}.json`), "utf-8")
    );
    const c = attr.city;
    const inv = parseInventory(inventoryFile);

    // City indicators block — preserve all fields with grouping + bilingual labels.
    const cityIndicators = Object.entries(c)
      .filter(([k, v]) => INDICATOR_META[k] && v && typeof v === "object" && "attribute_value" in (v as never))
      .map(([k, v]) => {
        const meta = INDICATOR_META[k];
        const val = v as { attribute_value: number; attribute_units: string; attribute_category: string };
        return {
          key: k,
          group: meta.group,
          labelEs: meta.labelEs,
          labelEn: meta.labelEn,
          value: val.attribute_value,
          units: val.attribute_units,
          category: val.attribute_category,
          priority: meta.priority,
        };
      })
      .sort((a, b) =>
        a.group === b.group ? a.priority - b.priority : a.group.localeCompare(b.group)
      );

    // Build cityRequest empty as per Carlos's instruction.
    const cityRequest = {
      preferredSectors: [],
      preferredTimeframes: [],
      preferredCoBenefits: [],
      excludedActionIds: [],
    };

    // For backwards-compat (biome field still in schema), pick the dominant
    // land-use share as a single label.
    const biomeKey = ["primary_forest_share", "pasture_share", "urban_built_share", "shrubland_share", "silviculture_share"]
      .map((k) => ({ k, v: (c[k]?.attribute_value ?? 0) as number }))
      .sort((a, b) => b.v - a.v)[0]?.k;
    const biomeMap: Record<string, { es: string; en: string }> = {
      primary_forest_share: { es: "Bosque primario dominante", en: "Primary forest dominant" },
      pasture_share: { es: "Pastizal dominante", en: "Pasture dominant" },
      urban_built_share: { es: "Suelo urbano dominante", en: "Urban-built dominant" },
      shrubland_share: { es: "Matorral dominante", en: "Shrubland dominant" },
      silviculture_share: { es: "Silvicultura dominante", en: "Silviculture dominant" },
    };
    const biome = biomeMap[biomeKey] ?? { es: "Mixto", en: "Mixed" };

    const regionName: string = c.region_name;
    return {
      cityId: locode,
      displayName: c.city_name,
      displayNameEn: c.city_name, // Chilean city names stay the same in both languages
      region: REGION_LABELS_ES[regionName] ?? `Región de ${regionName}`,
      regionEn: `${regionName} Region`,
      population: Math.round(c.populationSize),
      populationDensity: Math.round(c.populationDensity),
      area_km2: c.area_km2,
      sectorEmissions: inv.sectorEmissions,
      subsectorEmissions: inv.subsectorEmissions,
      totalEmissions: Math.round(inv.total),
      biome: biome.es,
      biomeEn: biome.en,
      // statedSectorPriority kept null — Carlos asked for empty preferences.
      statedSectorPriority: null,
      cityRequest,
      cityIndicators,
    };
  });
}

function buildModelOutputs(actions: ReturnType<typeof buildActions>) {
  const actionMap = new Map(actions.map((a) => [a.actionId, a]));
  const outputs: Record<string, unknown> = {};
  for (const [cityId, picks] of Object.entries(FABRICATED_RANKINGS)) {
    const topActions = picks.top10.map((id, idx) => {
      const a = actionMap.get(id);
      if (!a) throw new Error(`Fabricated rank for ${cityId} references unknown actionId ${id}`);
      const rank = idx + 1;
      // Fabricated final + pillar scores — decreasing roughly with rank.
      const decay = 1 - rank * 0.04;
      return {
        rank,
        actionId: id,
        finalScore: Number(decay.toFixed(3)),
        pillarScores: {
          impact: Number((decay - 0.02).toFixed(3)),
          alignment: Number((decay + 0.02).toFixed(3)),
          feasibility: Number((decay - 0.05).toFixed(3)),
        },
        // Placeholder rationale — will be replaced when Mirco's run lands.
        rationaleEs: `Esta acción aparece en la posición ${rank} del modelo. La justificación real se incorporará cuando Mirco ejecute el modelo (lunes).`,
        rationaleEn: `This action sits at rank ${rank} in the model. The actual rationale will be loaded once Mirco runs the model (Monday).`,
      };
    });
    const nextActions = picks.next5.map((id, idx) => ({
      rank: 11 + idx,
      actionId: id,
    }));
    outputs[cityId] = {
      topActions,
      nextActions,
      discardedLegal: [],
      discardedExcluded: [],
    };
  }
  return outputs;
}

type PolicyScore = {
  src_action_id: string;
  policy_support_score: number;
  policy_support_category: string;
  best_relevance: string;
  n_findings: number;
  n_docs: number;
  sum_strength: number;
  policy_evidence: Array<{
    evidence_rank: number;
    signal_type: string;
    signal_relation: string;
    signal_strength: string;
    document_name: string;
    document_type: string;
    doc_relevance: string;
    explicitness: string;
    page: number | null;
    evidence_strength: number;
    evidence_text: string;
  }>;
};

function buildPolicyScores() {
  const byCity: Record<string, Record<string, PolicyScore>> = {};
  for (const { locode, slug } of CITIES) {
    const path = join(CACHE, `policy_${slug}.json`);
    const data = JSON.parse(readFileSync(path, "utf-8"));
    const scores = data.scores as PolicyScore[];
    byCity[locode] = {};
    for (const s of scores) {
      byCity[locode][s.src_action_id] = s;
    }
  }
  return byCity;
}

type FeasibilityScore = {
  src_action_id: string;
  action_score: number;
  n_feasibility_dimensions: number;
  dimension_scores: Record<string, number>;
  breakdown: Record<
    string,
    {
      dimension_score: number;
      n_global_indicators: number;
      global_indicators: Array<{
        global_indicator: string;
        global_verdict: string;
        global_contribution: number;
        n_city_indicators: number;
        avg_city_contribution: number | null;
        indicator_score: number;
        city_indicators: Array<{
          city_indicator: string;
          category: string;
          direction: string;
          capacity: number;
          contribution: number;
        }>;
      }>;
    }
  >;
};

function buildFeasibilityScores() {
  const byCity: Record<string, Record<string, FeasibilityScore>> = {};
  for (const { locode, slug } of CITIES) {
    const path = join(CACHE, `feasibility_${slug}.json`);
    const data = JSON.parse(readFileSync(path, "utf-8"));
    const scores = data.scores as FeasibilityScore[];
    byCity[locode] = {};
    for (const s of scores) {
      byCity[locode][s.src_action_id] = s;
    }
  }
  return byCity;
}

type LegalAssessment = {
  srcActionId: string;
  countryCode: string;
  gpcSector: string;
  verdictCategory: string;
  verdictScore: number;
  ownershipCategory: string;
  ownershipScore: number;
  ownershipDescriptionI18n: { en: string; es: string };
  restrictionsCategory: string;
  restrictionsScore: number;
  restrictionsDescriptionI18n: { en: string; es: string };
  legalJustificationI18n: { en: string; es: string };
  legalReferences: string[];
  analysisDate: string;
  generationMethod: string;
};

function buildLegalAssessments() {
  const raw = JSON.parse(readFileSync(join(CACHE, "legal_CL.json"), "utf-8")) as LegalAssessment[];
  const byAction: Record<string, LegalAssessment> = {};
  for (const l of raw) byAction[l.srcActionId] = l;
  return byAction;
}

// ──────────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────────

function main() {
  console.log("→ Building actions catalog (mitigation only)…");
  const actions = buildActions();
  writeFileSync(join(DATA, "actions.json"), JSON.stringify(actions, null, 2) + "\n");
  console.log(`  ✓ ${actions.length} actions written`);

  console.log("→ Building cities…");
  const cities = buildCities(actions);
  writeFileSync(join(DATA, "cities.json"), JSON.stringify(cities, null, 2) + "\n");
  console.log(
    `  ✓ ${cities.length} cities written: ${cities.map((c) => `${c.cityId} (${c.displayName})`).join(", ")}`
  );

  console.log("→ Building fabricated model outputs…");
  const outputs = buildModelOutputs(actions);
  writeFileSync(join(DATA, "model_outputs.json"), JSON.stringify(outputs, null, 2) + "\n");
  console.log(`  ✓ ${Object.keys(outputs).length} city rankings written (fabricated, will be replaced Monday)`);

  console.log("→ Building action-policy-scores…");
  const policy = buildPolicyScores();
  writeFileSync(join(DATA, "action-policy-scores.json"), JSON.stringify(policy, null, 2) + "\n");
  console.log(`  ✓ policy scores for ${Object.keys(policy).length} cities written`);

  console.log("→ Building action-feasibility-scores…");
  const feas = buildFeasibilityScores();
  writeFileSync(join(DATA, "action-feasibility-scores.json"), JSON.stringify(feas, null, 2) + "\n");
  console.log(`  ✓ feasibility scores for ${Object.keys(feas).length} cities written`);

  console.log("→ Building action-legal-assessments…");
  const legal = buildLegalAssessments();
  writeFileSync(join(DATA, "action-legal-assessments.json"), JSON.stringify(legal, null, 2) + "\n");
  console.log(`  ✓ ${Object.keys(legal).length} legal assessments written`);

  console.log("\n✓ Done.");
}

main();
