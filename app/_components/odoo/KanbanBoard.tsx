"use client";

import { MoreHorizontal, Plus } from "lucide-react";
import type { ReactNode } from "react";
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from "@hello-pangea/dnd";

export type KanbanColumn<T> = {
  id: string;
  title: string;
  records: T[];
  /** Optional accent color (hex or CSS color). Default uses theme primary tint. */
  color?: string;
  /** Optional fold target (count badge). */
  count?: number;
  onAdd?: () => void;
};

type Props<T> = {
  columns: KanbanColumn<T>[];
  renderCard: (record: T, column: KanbanColumn<T>) => ReactNode;
  /** Per-card click handler — fires when the user clicks a card body. */
  onCardClick?: (record: T, column: KanbanColumn<T>) => void;
  /**
   * Fires when the user drags a card to a different column (or reorders within one).
   * The page is responsible for performing the API call + state update.
   * Required when you want drag-and-drop; if omitted, dragging is disabled.
   */
  onCardMove?: (
    record: T,
    fromColumnId: string,
    toColumnId: string,
    newIndex: number,
  ) => void;
  /** Unique stable id per record (needed for drag-and-drop). */
  getCardId?: (record: T) => string | number;
  className?: string;
};

/**
 * Odoo-style kanban board — horizontal columns of cards. Each column has a
 * coloured header with title + count and optional "+" button. The renderCard
 * prop is responsible for the card body markup so pages can show different
 * fields per workflow.
 *
 * Drag-and-drop is enabled when both `onCardMove` and `getCardId` are provided.
 */
export default function KanbanBoard<T>({
  columns,
  renderCard,
  onCardClick,
  onCardMove,
  getCardId,
  className = "",
}: Props<T>) {
  const dndEnabled = !!(onCardMove && getCardId);

  const handleDragEnd = (result: DropResult) => {
    if (!onCardMove || !getCardId) return;
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return;
    }
    const fromCol = columns.find((c) => c.id === source.droppableId);
    if (!fromCol) return;
    const record = fromCol.records.find(
      (r) => String(getCardId(r)) === draggableId,
    );
    if (!record) return;
    onCardMove(record, source.droppableId, destination.droppableId, destination.index);
  };

  const renderColumnBody = (col: KanbanColumn<T>, droppableProvided?: Parameters<Parameters<typeof Droppable>[0]["children"]>[0]) => {
    return (
      <div
        ref={droppableProvided?.innerRef}
        {...(droppableProvided?.droppableProps || {})}
        className="theme-scrollbar flex max-h-[calc(100vh-260px)] flex-1 flex-col gap-2 overflow-y-auto p-2"
      >
        {col.records.length === 0 ? (
          <div className="rounded border border-dashed border-[var(--theme-border)] bg-white/60 p-3 text-center text-[11px] text-[var(--theme-text-mute)]">
            ບໍ່ມີຂໍ້ມູນ
          </div>
        ) : (
          col.records.map((rec, i) => {
            const interactive = !!onCardClick;
            const cardId =
              getCardId ? String(getCardId(rec)) : `${col.id}-${i}`;

            const cardBody = (
              dragProps?: Parameters<Parameters<typeof Draggable>[0]["children"]>[0],
            ) => (
              <div
                ref={dragProps?.innerRef}
                {...(dragProps?.draggableProps || {})}
                {...(dragProps?.dragHandleProps || {})}
                role={interactive ? "button" : undefined}
                tabIndex={interactive ? 0 : -1}
                onClick={interactive ? () => onCardClick?.(rec, col) : undefined}
                onKeyDown={
                  interactive
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onCardClick?.(rec, col);
                        }
                      }
                    : undefined
                }
                className={[
                  "rounded border border-[var(--theme-border)] bg-white p-3 text-[12px] text-[var(--theme-text)] shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition select-none",
                  interactive
                    ? "cursor-pointer hover:border-[var(--theme-primary-soft)] hover:shadow-md"
                    : "",
                ].join(" ")}
                style={dragProps?.draggableProps.style}
              >
                {renderCard(rec, col)}
              </div>
            );

            if (dndEnabled) {
              return (
                <Draggable key={cardId} draggableId={cardId} index={i}>
                  {(provided) => cardBody(provided)}
                </Draggable>
              );
            }
            return <div key={cardId}>{cardBody()}</div>;
          })
        )}
        {droppableProvided?.placeholder}
      </div>
    );
  };

  const board = (
    <div
      className={`theme-scrollbar -mx-3 flex gap-3 overflow-x-auto px-3 pb-3 md:-mx-4 md:px-4 ${className}`}
    >
      {columns.map((col) => {
        const accent = col.color || "var(--theme-primary)";
        const total = col.count ?? col.records.length;

        return (
          <div
            key={col.id}
            className="flex w-[280px] flex-shrink-0 flex-col rounded border border-[var(--theme-border)] bg-[var(--theme-bg-muted)]"
          >
            <div
              className="flex items-center gap-2 rounded-t border-b border-[var(--theme-border)] bg-white px-3 py-2"
              style={{ boxShadow: `inset 3px 0 0 0 ${accent}` }}
            >
              <h3 className="flex-1 truncate text-[12px] font-semibold text-[var(--theme-text)]">
                {col.title}
              </h3>
              <span className="rounded-full bg-[var(--theme-bg-muted)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--theme-text-soft)]">
                {total}
              </span>
              {col.onAdd && (
                <button
                  type="button"
                  onClick={col.onAdd}
                  className="flex h-6 w-6 items-center justify-center rounded text-[var(--theme-text-mute)] transition hover:bg-[var(--theme-primary-tint)] hover:text-[var(--theme-primary)]"
                  aria-label="Add"
                >
                  <Plus size={13} />
                </button>
              )}
              <button
                type="button"
                className="flex h-6 w-6 items-center justify-center rounded text-[var(--theme-text-mute)] transition hover:bg-[var(--theme-bg-muted)]"
                aria-label="Column options"
              >
                <MoreHorizontal size={13} />
              </button>
            </div>

            {dndEnabled ? (
              <Droppable droppableId={col.id}>
                {(provided) => renderColumnBody(col, provided)}
              </Droppable>
            ) : (
              renderColumnBody(col)
            )}
          </div>
        );
      })}
    </div>
  );

  if (dndEnabled) {
    return <DragDropContext onDragEnd={handleDragEnd}>{board}</DragDropContext>;
  }
  return board;
}
