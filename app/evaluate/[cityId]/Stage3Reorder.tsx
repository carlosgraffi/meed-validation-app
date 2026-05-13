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
import { cn, t } from "@/lib/utils";
import type { RankedAction } from "./page";

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
}: {
  modelTop5: RankedAction[];
  customOrder: string[] | null;
  onChange: (next: string[]) => void;
  onReset: () => void;
  readOnly?: boolean;
}) {
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
                    name={ranked.action.nameEs}
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
      </CardContent>
    </Card>
  );
}

function SortableItem({
  id,
  modelRank,
  expertRank,
  name,
  disabled,
}: {
  id: string;
  modelRank: number;
  expertRank: number;
  name: string;
  disabled?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const moved = modelRank !== expertRank;
  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "grid grid-cols-[auto_auto_1fr_auto] items-center gap-3 rounded-md border bg-card p-3",
        isDragging && "shadow-lg ring-2 ring-primary",
        disabled && "opacity-60"
      )}
    >
      <Badge variant="muted" className="font-mono w-10 justify-center">
        #{modelRank}
      </Badge>
      <Badge variant={moved ? "accent" : "default"} className="font-mono w-10 justify-center">
        #{expertRank}
      </Badge>
      <span className="text-sm">{name}</span>
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
    </li>
  );
}
