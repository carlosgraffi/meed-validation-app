/**
 * Shared color palette for the 5 GPC sectors + sequestration sink.
 * Single source of truth so the emissions bar chart, subsector breakdown
 * list, and action sector/subsector badges all agree visually — the
 * expert can trace an action's tag color back to a band in the chart.
 *
 * Also exposes the GPC subsector taxonomy: code → parent sector + human
 * names (es / en). Kept here rather than in locales so the GPC mapping
 * and its colors stay co-located.
 */

export type SectorKey =
  | "stationaryEnergy"
  | "transportation"
  | "waste"
  | "ippu"
  | "afolu";

export const SECTOR_COLOR: Record<SectorKey, string> = {
  stationaryEnergy: "#0f766e", // teal-700
  transportation: "#0e7490", // cyan-700
  waste: "#65a30d", // lime-600
  ippu: "#a16207", // yellow-700
  afolu: "#7c3aed", // violet-600
};

// Distinct hue for sequestration (negative-value) sectors — emerald so it
// reads as "carbon sink" rather than "another emission source".
export const SINK_COLOR = "#10b981";

export const SECTOR_KEYS: SectorKey[] = [
  "stationaryEnergy",
  "transportation",
  "waste",
  "ippu",
  "afolu",
];

/**
 * GPC subsector taxonomy. Codes follow the Global Protocol for Community-
 * Scale GHG Inventories (v1.1). Only the subsectors present in our
 * cities.json are mapped — extend as needed.
 */
export const GPC_SUBSECTORS: Record<
  string,
  { sector: SectorKey; es: string; en: string }
> = {
  "I.1": { sector: "stationaryEnergy", es: "Edificios residenciales", en: "Residential buildings" },
  "I.2": { sector: "stationaryEnergy", es: "Edificios comerciales e institucionales", en: "Commercial & institutional buildings" },
  "I.3": { sector: "stationaryEnergy", es: "Industria manufacturera y construcción", en: "Manufacturing industries & construction" },
  "I.4": { sector: "stationaryEnergy", es: "Industrias energéticas", en: "Energy industries" },
  "I.5": { sector: "stationaryEnergy", es: "Energía suministrada a la red", en: "Energy supplied to the grid" },
  "I.6": { sector: "stationaryEnergy", es: "Agricultura, silvicultura y pesca", en: "Agriculture, forestry & fishing activities" },
  "I.7": { sector: "stationaryEnergy", es: "Fuentes no especificadas", en: "Non-specified sources" },
  "I.8": { sector: "stationaryEnergy", es: "Emisiones fugitivas de petróleo y gas", en: "Fugitive emissions from oil & gas" },
  "II.1": { sector: "transportation", es: "Vehículos en ruta", en: "On-road" },
  "II.2": { sector: "transportation", es: "Ferrocarriles", en: "Railways" },
  "II.3": { sector: "transportation", es: "Navegación", en: "Waterborne navigation" },
  "II.4": { sector: "transportation", es: "Aviación", en: "Aviation" },
  "II.5": { sector: "transportation", es: "Fuera de ruta", en: "Off-road" },
  "III.1": { sector: "waste", es: "Disposición de residuos sólidos", en: "Solid waste disposal" },
  "III.2": { sector: "waste", es: "Tratamiento biológico de residuos", en: "Biological treatment of waste" },
  "III.3": { sector: "waste", es: "Incineración y quema a cielo abierto", en: "Incineration & open burning" },
  "III.4": { sector: "waste", es: "Tratamiento de aguas residuales", en: "Wastewater treatment" },
  "IV.1": { sector: "ippu", es: "Procesos industriales", en: "Industrial processes" },
  "IV.2": { sector: "ippu", es: "Uso de productos", en: "Product use" },
  "V.1": { sector: "afolu", es: "Ganadería", en: "Livestock" },
  "V.2": { sector: "afolu", es: "Uso del suelo", en: "Land" },
  "V.3": { sector: "afolu", es: "Fuentes agregadas y emisiones no-CO₂ del suelo", en: "Aggregate non-CO₂ sources on land" },
};

/** Look up the parent sector for a GPC code, falling back to `null` for unknown codes. */
export function sectorForGpcCode(code: string): SectorKey | null {
  return GPC_SUBSECTORS[code]?.sector ?? null;
}

/**
 * Map an action's sector field (either `sector` ES or `sectorEn` EN) back
 * to a SectorKey so we can look up its color. Values match what appears in
 * actions.json and `locales.<lang>.sectors.<key>`.
 */
const SECTOR_NAME_TO_KEY: Record<string, SectorKey> = {
  // Spanish
  "Energía estacionaria": "stationaryEnergy",
  Transporte: "transportation",
  Residuos: "waste",
  IPPU: "ippu",
  AFOLU: "afolu",
  // English
  "Stationary energy": "stationaryEnergy",
  Transportation: "transportation",
  Waste: "waste",
};

export function sectorKeyFromName(name: string | null | undefined): SectorKey | null {
  if (!name) return null;
  return SECTOR_NAME_TO_KEY[name] ?? null;
}
