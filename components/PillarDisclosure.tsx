"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { PILLARS, PILLAR_KEYS, type PillarKey } from "@/lib/pillars";
import { cn } from "@/lib/utils";
import { useT } from "@/app/LangProvider";

const PILLAR_COLORS: Record<PillarKey, string> = {
  impact: "bg-primary",
  alignment: "bg-accent",
  feasibility: "bg-foreground/70",
};

export function PillarDisclosure({
  variant,
  className,
}: {
  variant: "full" | "compact";
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  if (variant === "full") return <FullVariant className={className} />;
  return (
    <CompactVariant
      className={className}
      expanded={expanded}
      onToggle={() => setExpanded((v) => !v)}
    />
  );
}

function FullVariant({ className }: { className?: string }) {
  const t = useT();
  return (
    <section className={cn("rounded-lg border bg-card p-5 space-y-4", className)}>
      <header className="space-y-1">
        <h3 className="text-base font-semibold">{t("pillars.fullTitle")}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{t("pillars.fullIntro")}</p>
      </header>
      <ul className="space-y-3">
        {PILLAR_KEYS.map((k) => (
          <li key={k}>
            <PillarRow pillarKey={k} showDescription />
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground italic">{t("pillars.fullNote")}</p>
    </section>
  );
}

function CompactVariant({
  className,
  expanded,
  onToggle,
}: {
  className?: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const t = useT();
  return (
    <section className={cn("rounded-lg border bg-muted/30 px-4 py-3 space-y-2", className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <span className="text-xs font-medium text-muted-foreground shrink-0">
            {t("pillars.compactLabel")}
          </span>
          <ul className="flex items-center gap-3 flex-1 min-w-0">
            {PILLAR_KEYS.map((k) => (
              <li key={k} className="flex items-center gap-1.5 text-xs">
                <span
                  className={cn("inline-block h-2 w-2 rounded-full", PILLAR_COLORS[k])}
                  aria-hidden
                />
                <span className="font-medium">{t(`pillars.${k}.label` as never)}</span>
                <span className="text-muted-foreground">{pct(PILLARS[k].weight)}</span>
              </li>
            ))}
          </ul>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 shrink-0"
          aria-expanded={expanded}
        >
          {expanded ? t("pillars.compactCollapse") : t("pillars.compactExpand")}
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
      </div>
      {expanded && (
        <ul className="space-y-2 pt-2 border-t">
          {PILLAR_KEYS.map((k) => (
            <li key={k}>
              <PillarRow pillarKey={k} showDescription compact />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PillarRow({
  pillarKey,
  showDescription,
  compact,
}: {
  pillarKey: PillarKey;
  showDescription?: boolean;
  compact?: boolean;
}) {
  const t = useT();
  const weight = PILLARS[pillarKey].weight;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-3">
        <span className={cn("font-medium", compact ? "text-xs" : "text-sm")}>
          {t(`pillars.${pillarKey}.label` as never)}
        </span>
        <span
          className={cn(
            "font-mono text-muted-foreground",
            compact ? "text-[10px]" : "text-xs"
          )}
        >
          {pct(weight)}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full", PILLAR_COLORS[pillarKey])}
          style={{ width: `${weight * 100}%` }}
          aria-label={`${t("pillars.weightLabel")} ${pct(weight)}`}
        />
      </div>
      {showDescription && (
        <p className={cn("text-muted-foreground leading-relaxed", compact ? "text-[11px]" : "text-xs")}>
          {t(`pillars.${pillarKey}.description` as never)}
        </p>
      )}
    </div>
  );
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}
