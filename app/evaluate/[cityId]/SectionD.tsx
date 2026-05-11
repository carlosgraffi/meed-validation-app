"use client";

import { useState } from "react";
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
import { cn, t } from "@/lib/utils";
import type { Action } from "@/lib/fixtures";

export function SectionD({
  modelTop5,
  customOrder,
  onChange,
  onReset,
  disabled,
}: {
  modelTop5: Action[];
  customOrder: string[] | null;
  onChange: (next: string[]) => void;
  onReset: () => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const orderIds: string[] = (() => {
    if (customOrder && customOrder.length === 5) return customOrder;
    return modelTop5.map((a) => a.actionId);
  })();
  const idToAction = new Map(modelTop5.map((a) => [a.actionId, a]));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = orderIds.indexOf(active.id as string);
    const newIndex = orderIds.indexOf(over.id as string);
    onChange(arrayMove(orderIds, oldIndex, newIndex));
  };

  const hasCustom = !!customOrder;

  return (
    <Card>
      <CardHeader className="cursor-pointer" onClick={() => setOpen((v) => !v)}>
        <div className="flex items-center justify-between">
          <CardTitle>{t("evaluate.sectionDtitle")}</CardTitle>
          <Button variant="ghost" size="sm" type="button">
            {open ? t("evaluate.sectionDclose") : t("evaluate.sectionDopen")}
          </Button>
        </div>
        <CardDescription>{t("evaluate.sectionDsubtitle")}</CardDescription>
      </CardHeader>
      {open && (
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">{t("evaluate.sectionDhelp")}</p>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={orderIds} strategy={verticalListSortingStrategy}>
              <ol className="space-y-2">
                {orderIds.map((id, idx) => {
                  const action = idToAction.get(id);
                  if (!action) return null;
                  return (
                    <SortableItem
                      key={id}
                      id={id}
                      idx={idx + 1}
                      name={action.nameEs}
                      disabled={disabled}
                    />
                  );
                })}
              </ol>
            </SortableContext>
          </DndContext>
          {hasCustom && (
            <Button variant="outline" size="sm" type="button" onClick={onReset} disabled={disabled}>
              {t("evaluate.sectionDreset")}
            </Button>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function SortableItem({
  id,
  idx,
  name,
  disabled,
}: {
  id: string;
  idx: number;
  name: string;
  disabled?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 rounded-md border bg-card p-3",
        isDragging && "shadow-lg ring-2 ring-primary",
        disabled && "opacity-60"
      )}
    >
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
      <span className="text-sm font-mono w-6 text-muted-foreground">{idx}.</span>
      <span className="text-sm flex-1">{name}</span>
    </li>
  );
}
