"use client";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT, useActionText, useLang } from "@/app/LangProvider";
import { ActionRationale } from "./ActionRationale";
import { ActionContextSheet } from "./ActionContextSheet";
import type { RankedAction } from "./page";
import type { PolicyScore, FeasibilityScore, LegalAssessment } from "@/lib/fixtures";

/**
 * Stage 3 — reveal model ranks for the top 5 actions, allow the expert to drag-reorder.
 *
 * Differs from the old SectionD: the model rank is visible alongside the expert's
 * current order, and the section is mandatory-visible (not collapsible). Stage 3
 * is the FIRST time the user sees what the model thinks the ranks are.
 */
export function Stage3Reorder({
  modelTop5,
  customOrder,
  onChange,
  onReset,
  readOnly,
  cityPolicy,
  cityFeasibility,
  legalAssessments,
  comment,
  onCommentBlur,
}: {
  modelTop5: RankedAction[];
  customOrder: string[] | null;
  onChange: (next: string[]) => void;
  onReset: () => void;
  readOnly?: boolean;
  cityPolicy: Record<string, PolicyScore>;
  cityFeasibility: Record<string, FeasibilityScore>;
  legalAssessments: Record<string, LegalAssessment>;
  /** Optional free-text qualifying the reorder. Persisted on blur. */
  comment: string;
  onCommentBlur: (next: string) => void;
}) {
  const t = useT();
  const orderIds: string[] = (() => {
    if (customOrder && customOrder.length === 5) return customOrder;
    return modelTop5.map((r) => r.action.actionId);
  })();
  const byId = new Map(modelTop5.map((r) => [r.action.actionId, r]));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (e: DragEndEvent) => {
    if (readOnly) return;
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = orderIds.indexOf(active.id as string);
    const newIndex = orderIds.indexOf(over.id as string);
    onChange(arrayMove(orderIds, oldIndex, newIndex));
  };

  const hasCustom = !!customOrder;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("evaluate.stage3Title")}</CardTitle>
        <CardDescription>{t("evaluate.stage3Intro")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-[auto_auto_1fr] items-center gap-x-3 text-xs text-muted-foreground uppercase tracking-wide font-medium pb-1 border-b">
          <span>{t("evaluate.stage3ModelOrderLabel")}</span>
          <span>{t("evaluate.stage3ExpertOrderLabel")}</span>
          <span></span>
        </div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={orderIds} strategy={verticalListSortingStrategy}>
            <ol className="space-y-2">
              {orderIds.map((id, idx) => {
                const ranked = byId.get(id);
                if (!ranked) return null;
                return (
                  <SortableItem
                    key={id}
                    id={id}
                    modelRank={ranked.rank}
                    expertRank={idx + 1}
                    action={ranked.action}
                    rationaleEs={ranked.rationaleEs}
                    rationaleEn={ranked.rationaleEn}
                    explanationEs={ranked.explanationEs}
                    explanationEn={ranked.explanationEn}
                    policy={cityPolicy[ranked.action.actionId]}
                    feasibility={cityFeasibility[ranked.action.actionId]}
                    legal={legalAssessments[ranked.action.actionId]}
                    disabled={readOnly}
                  />
                );
              })}
            </ol>
          </SortableContext>
        </DndContext>
        {hasCustom && !readOnly && (
          <Button variant="outline" size="sm" type="button" onClick={onReset}>
            {t("evaluate.stage3Reset")}
          </Button>
        )}
        <ReorderComment value={comment} onBlur={onCommentBlur} disabled={!!readOnly} />
      </CardContent>
    </Card>
  );
}

/**
 * Optional free-text the expert can leave to explain a reorder (or to note
 * "I would have moved X but wasn't confident"). Same shape and 1000-char
 * cap as the reveal-stage AgreementComment so the data column behaves the
 * same way downstream.
 */
function ReorderComment({
  value,
  onBlur,
  disabled,
}: {
  value: string;
  onBlur: (next: string) => void;
  disabled: boolean;
}) {
  const t = useT();
  const [local, setLocal] = useState(value);
  useEffect(() => {
    setLocal(value);
  }, [value]);
  const MAX = 1000;
  return (
    <div className="space-y-1.5 pt-3 border-t border-dashed">
      <label
        htmlFor="reorder-comment"
        className="text-xs font-medium text-muted-foreground"
      >
        {t("evaluate.stage3CommentLabel")}
      </label>
      <textarea
        id="reorder-comment"
        value={local}
        onChange={(e) => setLocal(e.target.value.slice(0, MAX))}
        onBlur={() => {
          if (local !== value) onBlur(local);
        }}
        disabled={disabled}
        placeholder={t("evaluate.stage3CommentPlaceholder")}
        rows={3}
        className={cn(
          "w-full rounded-md border bg-background px-3 py-2 text-sm leading-relaxed",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-60"
        )}
      />
      <p className="text-[10px] text-muted-foreground text-right">
        {t("evaluate.characterCount", { count: local.length, max: MAX })}
      </p>
    </div>
  );
}

function SortableItem({
  id,
  modelRank,
  expertRank,
  action,
  rationaleEs,
  rationaleEn,
  explanationEs,
  explanationEn,
  policy,
  feasibility,
  legal,
  disabled,
}: {
  id: string;
  modelRank: number;
  expertRank: number;
  action: import("@/lib/fixtures").Action;
  rationaleEs: string;
  rationaleEn: string;
  explanationEs?: string;
  explanationEn?: string;
  policy: PolicyScore | undefined;
  feasibility: FeasibilityScore | undefined;
  legal: LegalAssessment | undefined;
  disabled?: boolean;
}) {
  const at = useActionText();
  const [lang] = useLang();
  const [sheetOpen, setSheetOpen] = useState(false);
  // Presence of the LLM explanation is the signal that we're past the
  // explanation gate (i.e. the user is on Reveal-1 or later). When it's
  // missing — during the active Stage 3 blind reorder — we hide the
  // "Contexto" / "Ver explicación del modelo" surfaces so the templated
  // pillar-band fallback doesn't slip in and bias the expert's reorder.
  const hasExplanation =
    (typeof explanationEs === "string" && explanationEs.length > 0) ||
    (typeof explanationEn === "string" && explanationEn.length > 0);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const moved = modelRank !== expertRank;
  // Grid columns: when the Contexto button is hidden, drop a column so the
  // action name + drag handle stay properly spaced.
  const gridCols = hasExplanation
    ? "grid-cols-[auto_auto_1fr_auto_auto]"
    : "grid-cols-[auto_auto_1fr_auto]";
  return (
    <>
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-md border bg-card p-3",
        isDragging && "shadow-lg ring-2 ring-primary",
        disabled && "opacity-60"
      )}
    >
      <div className={cn("grid items-center gap-3", gridCols)}>
        <Badge variant="muted" className="font-mono w-10 justify-center">
          #{modelRank}
        </Badge>
        <Badge variant={moved ? "accent" : "default"} className="font-mono w-10 justify-center">
          #{expertRank}
        </Badge>
        <span className="text-sm">{at.name(action)}</span>
        {hasExplanation && (
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="shrink-0 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground border rounded-md px-2 py-1 transition-colors"
            aria-label={lang === "en" ? "View ranking context" : "Ver contexto del ranking"}
          >
            <Info className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden sm:inline">
              {lang === "en" ? "Context" : "Contexto"}
            </span>
          </button>
        )}
        <button
          type="button"
          className="shrink-0 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing disabled:cursor-not-allowed"
          aria-label="Arrastrar"
          {...attributes}
          {...listeners}
          disabled={disabled}
        >
          <GripVertical className="h-5 w-5" />
        </button>
      </div>
      {/* Surface the reasoning ONLY when the LLM explanation is in the
          payload. During an active Stage 3 reorder the explanation is gated
          out (it would bias the reorder), so the templated band rationale
          would be the only thing left to display — and that's also somewhat
          biasing. Hide both surfaces entirely in that case; they'll reappear
          once the expert advances into Reveal-1 and explanations unlock. */}
      {hasExplanation && (
        <ActionRationale
          rationaleEs={rationaleEs}
          rationaleEn={rationaleEn}
          explanationEs={explanationEs}
          explanationEn={explanationEn}
        />
      )}
    </li>
    {hasExplanation && (
      <ActionContextSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        action={action}
        rationaleEs={rationaleEs}
        rationaleEn={rationaleEn}
        explanationEs={explanationEs}
        explanationEn={explanationEn}
        modelRank={modelRank}
        policy={policy}
        feasibility={feasibility}
        legal={legal}
      />
    )}
    </>
  );
}
