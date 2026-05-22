"use client";

import { useMemo } from "react";
import { Scale, Sparkles, TrendingUp, TrendingDown, Quote } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { useT, useLang, useActionText } from "@/app/LangProvider";
import { cn } from "@/lib/utils";
import type {
  Action,
  PolicyScore,
  FeasibilityScore,
  LegalAssessment,
} from "@/lib/fixtures";

/**
 * Full ranking-context sheet for a single action, surfaced from a Stage 3
 * card. Shows everything the model used to rank this action for this city:
 *   - LLM rationale (the qualitative why)
 *   - Policy support score + top evidence (real Chilean policy quotes)
 *   - Legal verdict + justification + references (already bilingual upstream)
 *   - Feasibility: top boosting / constraining city_indicators per dimension
 *
 * No numeric pillar scores are shown — those are kept out of the expert view
 * intentionally (the feasibility pillar is noisy when legal data is sparse).
 */
export function ActionContextSheet({
  open,
  onOpenChange,
  action,
  rationaleEs,
  rationaleEn,
  modelRank,
  policy,
  feasibility,
  legal,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  action: Action;
  rationaleEs: string;
  rationaleEn: string;
  modelRank: number;
  policy: PolicyScore | undefined;
  feasibility: FeasibilityScore | undefined;
  legal: LegalAssessment | undefined;
}) {
  const t = useT();
  const [lang] = useLang();
  const at = useActionText();

  const cityIndicatorDrivers = useMemo(
    () => extractTopCityIndicators(feasibility),
    [feasibility]
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={at.name(action)}>
      <div className="p-5 space-y-6">
        {/* Header */}
        <section className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
            <Badge variant="muted" className="font-mono">
              #{modelRank}
            </Badge>
            <span>{at.sector(action)}</span>
            {at.subsector(action) && (
              <>
                <span>·</span>
                <span>{at.subsector(action)}</span>
              </>
            )}
          </div>
          <h3 className="text-base font-semibold leading-tight">{at.name(action)}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {at.description(action)}
          </p>
        </section>

        {/* LLM rationale */}
        <section className="space-y-2">
          <h4 className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground font-medium">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            {t("evaluate.rationaleLabel")}
          </h4>
          <p className="text-sm leading-relaxed italic rounded-md bg-muted/40 p-3">
            {lang === "en" ? rationaleEn : rationaleEs}
          </p>
        </section>

        {/* Policy support */}
        {policy && (
          <section className="space-y-2">
            <h4 className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
              {lang === "en" ? "Policy support" : "Apoyo de políticas"}
            </h4>
            <div className="flex items-center gap-2 flex-wrap text-sm">
              <Badge variant={policyToneBadge(policy.policy_support_category)} className="capitalize">
                {translatePolicyCategory(policy.policy_support_category, lang)}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {policy.n_docs} {lang === "en" ? "docs" : "documentos"} · {policy.n_findings}{" "}
                {lang === "en" ? "findings" : "hallazgos"}
              </span>
            </div>
            {policy.policy_evidence.length > 0 && (
              <ul className="space-y-2 mt-2">
                {policy.policy_evidence.slice(0, 3).map((e) => (
                  <li key={e.evidence_rank} className="text-xs leading-relaxed">
                    <div className="flex items-start gap-2">
                      <Quote className="h-3 w-3 mt-1 text-muted-foreground shrink-0" aria-hidden />
                      <div className="space-y-1">
                        <p className="italic">"{e.evidence_text}"</p>
                        <p className="text-[10px] text-muted-foreground">
                          <span className="font-medium">{e.document_name}</span>
                          {e.page != null && ` · p. ${e.page}`} ·{" "}
                          <span className="capitalize">{e.signal_strength}</span>{" "}
                          {translatePolicyRelation(e.signal_relation, lang)}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* Legal verdict */}
        {legal && (
          <section className="space-y-2">
            <h4 className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground font-medium">
              <Scale className="h-3.5 w-3.5" aria-hidden />
              {lang === "en" ? "Legal feasibility (Chile)" : "Factibilidad legal (Chile)"}
            </h4>
            <div className="flex items-center gap-2 flex-wrap text-sm">
              <Badge variant={legalToneBadge(legal.verdictCategory)} className="capitalize">
                {translateLegalVerdict(legal.verdictCategory, lang)}
              </Badge>
              <span className="text-[10px] text-muted-foreground">
                {lang === "en" ? "Analyzed" : "Analizado"} {legal.analysisDate} ·{" "}
                {legal.generationMethod}
              </span>
            </div>
            <p className="text-xs leading-relaxed text-foreground/85 mt-1">
              {lang === "en"
                ? legal.legalJustificationI18n.en
                : legal.legalJustificationI18n.es}
            </p>
            {legal.legalReferences.length > 0 && (
              <div className="text-[10px] text-muted-foreground">
                <span className="font-medium uppercase tracking-wide">
                  {lang === "en" ? "References" : "Referencias"}
                </span>
                <ul className="mt-1 space-y-0.5">
                  {legal.legalReferences.map((r) => (
                    <li key={r}>· {r}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}
        {!legal && (
          <section className="space-y-2">
            <h4 className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground font-medium">
              <Scale className="h-3.5 w-3.5" aria-hidden />
              {lang === "en" ? "Legal feasibility (Chile)" : "Factibilidad legal (Chile)"}
            </h4>
            <p className="text-xs text-muted-foreground italic">
              {lang === "en"
                ? "No legal assessment is available for this action. The model uses a neutral default (0.5) — it neither penalizes nor favors this action legally."
                : "No hay evaluación legal para esta acción. El modelo usa un valor neutro por defecto (0.5) — no penaliza ni favorece la acción."}
            </p>
          </section>
        )}

        {/* Feasibility city_indicators */}
        {feasibility && (
          <section className="space-y-2 pb-6">
            <h4 className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
              {lang === "en"
                ? "Feasibility drivers (city indicators)"
                : "Factores de factibilidad (indicadores de la ciudad)"}
            </h4>
            <p className="text-[11px] text-muted-foreground">
              {lang === "en"
                ? "Indicators of this specific city that boosted (↑) or constrained (↓) the model's feasibility score for this action."
                : "Indicadores propios de esta ciudad que reforzaron (↑) o restringieron (↓) el puntaje de factibilidad del modelo para esta acción."}
            </p>
            <DriversList drivers={cityIndicatorDrivers} lang={lang} />
          </section>
        )}
      </div>
    </Sheet>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

type Driver = {
  cityIndicator: string;
  contribution: number;
  category: string;
  direction: string;
  dimension: string;
};

function extractTopCityIndicators(f: FeasibilityScore | undefined): {
  boost: Driver[];
  drag: Driver[];
} {
  if (!f) return { boost: [], drag: [] };
  const all: Driver[] = [];
  for (const [dimension, payload] of Object.entries(f.breakdown)) {
    for (const gi of payload.global_indicators) {
      for (const ci of gi.city_indicators) {
        all.push({
          cityIndicator: ci.city_indicator,
          contribution: ci.contribution,
          category: ci.category,
          direction: ci.direction,
          dimension,
        });
      }
    }
  }
  // Sort by capacity * sign — boosters are direction=positive with high contribution,
  // drags are direction=negative with high contribution.
  const boost = all
    .filter((d) => d.direction === "positive" || d.direction === "supportive")
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 4);
  const drag = all
    .filter((d) => d.direction === "negative" || d.direction === "constraining")
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 4);
  return { boost, drag };
}

function DriversList({
  drivers,
  lang,
}: {
  drivers: { boost: Driver[]; drag: Driver[] };
  lang: "es" | "en";
}) {
  const labelFor = (key: string) => INDICATOR_LABELS[key]?.[lang] ?? snakeToTitle(key);
  return (
    <div className="space-y-2">
      {drivers.boost.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
            <TrendingUp className="h-3.5 w-3.5" aria-hidden />
            {lang === "en" ? "Boosted by" : "Refuerzan"}
          </div>
          <ul className="mt-1 space-y-1">
            {drivers.boost.map((d, i) => (
              <li key={`${d.cityIndicator}-${i}`} className="text-xs flex items-center justify-between gap-2">
                <span>{labelFor(d.cityIndicator)}</span>
                <span className="text-muted-foreground capitalize">{d.category}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {drivers.drag.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-rose-700">
            <TrendingDown className="h-3.5 w-3.5" aria-hidden />
            {lang === "en" ? "Constrained by" : "Restringen"}
          </div>
          <ul className="mt-1 space-y-1">
            {drivers.drag.map((d, i) => (
              <li key={`${d.cityIndicator}-${i}`} className="text-xs flex items-center justify-between gap-2">
                <span>{labelFor(d.cityIndicator)}</span>
                <span className="text-muted-foreground capitalize">{d.category}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const INDICATOR_LABELS: Record<string, { es: string; en: string }> = {
  median_household_income: { es: "Ingreso mediano del hogar", en: "Median household income" },
  poverty_rate: { es: "Pobreza", en: "Poverty rate" },
  unemployment_rate: { es: "Desempleo", en: "Unemployment rate" },
  literacy_rate: { es: "Alfabetización", en: "Literacy rate" },
  mean_years_schooling: { es: "Años de escolaridad", en: "Mean years of schooling" },
  indigenous_identification_rate: {
    es: "Identificación indígena",
    en: "Indigenous identification",
  },
  population: { es: "Población", en: "Population" },
  populationDensity: { es: "Densidad poblacional", en: "Population density" },
  electricity_access_rate: { es: "Acceso a electricidad", en: "Electricity access" },
  fixed_internet_household_share: { es: "Internet fijo en hogares", en: "Fixed internet households" },
  public_transport_share: { es: "Uso de transporte público", en: "Public transport share" },
  pasture_share: { es: "Pastizal manejado", en: "Pasture" },
  primary_forest_share: { es: "Bosque primario", en: "Primary forest" },
  secondary_forest_share: { es: "Bosque secundario", en: "Secondary forest" },
  silviculture_share: { es: "Silvicultura", en: "Silviculture" },
  urban_built_share: { es: "Suelo urbano", en: "Urban built-up land" },
  employment_agriculture_utilities: {
    es: "Empleo en agricultura",
    en: "Employment in agriculture",
  },
  employment_in_transport_and_logistics: {
    es: "Empleo en transporte y logística",
    en: "Employment in transport and logistics",
  },
  industry_construction_employment: {
    es: "Empleo en industria y construcción",
    en: "Employment in industry and construction",
  },
  home_ownership: { es: "Propiedad de vivienda", en: "Home ownership" },
};

function snakeToTitle(s: string): string {
  return s
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function policyToneBadge(category: string): "default" | "muted" | "destructive" | "accent" {
  if (category === "strong") return "default";
  if (category === "medium" || category === "moderate") return "accent";
  if (category === "weak") return "muted";
  return "muted";
}
function translatePolicyCategory(category: string, lang: "es" | "en"): string {
  const map: Record<string, { es: string; en: string }> = {
    strong: { es: "Fuerte", en: "Strong" },
    medium: { es: "Media", en: "Medium" },
    moderate: { es: "Moderada", en: "Moderate" },
    weak: { es: "Débil", en: "Weak" },
  };
  return map[category]?.[lang] ?? category;
}
function translatePolicyRelation(relation: string, lang: "es" | "en"): string {
  const map: Record<string, { es: string; en: string }> = {
    commits: { es: "compromete", en: "commits" },
    supports: { es: "respalda", en: "supports" },
    identifies: { es: "identifica", en: "identifies" },
    provides: { es: "provee", en: "provides" },
    assigns: { es: "asigna", en: "assigns" },
    ceiling: { es: "limita", en: "ceiling" },
  };
  return map[relation]?.[lang] ?? relation;
}

function legalToneBadge(category: string): "default" | "muted" | "destructive" | "accent" {
  if (category === "enabled") return "default";
  if (category === "conditional") return "accent";
  if (category === "blocked") return "destructive";
  return "muted";
}
function translateLegalVerdict(category: string, lang: "es" | "en"): string {
  const map: Record<string, { es: string; en: string }> = {
    enabled: { es: "Habilitada", en: "Enabled" },
    conditional: { es: "Condicional", en: "Conditional" },
    blocked: { es: "Bloqueada", en: "Blocked" },
  };
  return map[category]?.[lang] ?? category;
}
