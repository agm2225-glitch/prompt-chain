"use client";
import { useState, useTransition } from "react";
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
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { deleteStep, reorderSteps, updateStep } from "@/app/(admin)/actions";
import ConfirmSubmit from "./ConfirmSubmit";
import StepFields from "./StepFields";
import type { Model, Step } from "@/lib/types";

export default function StepList({ chainId, initial, models }: { chainId: number; initial: Step[]; models: Model[] }) {
  const [items, setItems] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function commit(next: Step[]) {
    const previous = items;
    setItems(next);
    setError(null);
    startTransition(async () => {
      try {
        await reorderSteps(chainId, next.map((s) => s.id));
      } catch (e) {
        setItems(previous);
        setError(e instanceof Error ? e.message : "Could not reorder steps.");
      }
    });
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = items.findIndex((s) => s.id === active.id);
    const to = items.findIndex((s) => s.id === over.id);
    commit(arrayMove(items, from, to));
  }

  const move = (index: number, dir: -1 | 1) => commit(arrayMove(items, index, index + dir));

  return (
    <div className="mt-4">
      {error && <p className="mb-3 text-sm text-danger">{error}</p>}
      <DndContext id="steps-dnd" sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={items.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <ol className={`relative space-y-3 ${pending ? "opacity-70" : ""}`}>
            <span aria-hidden className="absolute bottom-6 left-[19px] top-6 w-px bg-line" />
            {items.map((s, i) => (
              <StepCard
                key={s.id}
                step={s}
                index={i}
                last={i === items.length - 1}
                chainId={chainId}
                models={models}
                onMove={move}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function StepCard({
  step,
  index,
  last,
  chainId,
  models,
  onMove,
}: {
  step: Step;
  index: number;
  last: boolean;
  chainId: number;
  models: Model[];
  onMove: (index: number, dir: -1 | 1) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: step.id });
  const [editing, setEditing] = useState(false);

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : undefined }}
      className="relative flex gap-3"
    >
      <span className="relative z-[1] mt-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-sm font-semibold">
        {index + 1}
      </span>
      <div className={`min-w-0 flex-1 rounded-md border bg-surface p-4 ${isDragging ? "border-accent shadow-lg" : "border-line"}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-medium">{step.description}</h3>
            <p className="text-xs text-muted">
              {models.find((m) => m.id === step.llm_model_id)?.name ?? "Default model"} · temperature {step.llm_temperature ?? 0.7}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button className="btn px-2" aria-label="Move up" disabled={index === 0} onClick={() => onMove(index, -1)}>↑</button>
            <button className="btn px-2" aria-label="Move down" disabled={last} onClick={() => onMove(index, 1)}>↓</button>
            <button
              className="btn cursor-grab touch-none px-2"
              aria-label="Drag to reorder"
              {...attributes}
              {...listeners}
            >
              ⠿
            </button>
          </div>
        </div>

        {!editing ? (
          <>
            {step.llm_system_prompt && (
              <p className="mt-2 whitespace-pre-wrap text-sm text-muted"><span className="font-medium text-ink">System: </span>{step.llm_system_prompt}</p>
            )}
            {step.llm_user_prompt && (
              <p className="mt-2 whitespace-pre-wrap text-sm text-muted"><span className="font-medium text-ink">User: </span>{step.llm_user_prompt}</p>
            )}
            <div className="mt-3 flex gap-2">
              <button className="btn" onClick={() => setEditing(true)}>Edit</button>
              <form action={deleteStep.bind(null, step.id, chainId)}>
                <ConfirmSubmit label="Delete" message={`Delete step “${step.description}”?`} />
              </form>
            </div>
          </>
        ) : (
          <form
            action={async (fd) => {
              await updateStep(step.id, chainId, fd);
              setEditing(false);
            }}
            className="mt-3 space-y-3"
          >
            <StepFields id={`s${step.id}`} models={models} step={step} />
            <div className="flex gap-2">
              <button className="btn-primary">Save step</button>
              <button type="button" className="btn" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </form>
        )}
      </div>
    </li>
  );
}
