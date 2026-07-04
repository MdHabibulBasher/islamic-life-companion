import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Task } from '../../services/taskService';
import { KanbanCard } from './KanbanCard';
import type { KanbanColumnDef } from './columns';

/**
 * KanbanColumn
 * ------------
 * Renders one Kanban column. The whole column is registered as a dnd-kit
 * droppable so that an empty column can still receive cards (you can drag
 * the last "Doing" card out and the "Doing" column remains a valid drop
 * target).
 *
 * The list of cards lives inside a SortableContext so the Sortable items
 * can be reordered within the column.
 */

interface KanbanColumnProps {
  column: KanbanColumnDef;
  tasks: Task[];
  onToggle?: (task: Task) => void;
  onDelete?: (task: Task) => void;
}

export const KanbanColumn = ({
  column,
  tasks,
  onToggle,
  onDelete,
}: KanbanColumnProps) => {
  const { isOver, setNodeRef } = useDroppable({
    id: `column-${column.id}`,
    data: { type: 'column', status: column.id },
  });

  return (
    <div
      ref={setNodeRef}
      className="flex flex-col rounded-2xl min-w-0 w-full"
      style={{
        background: isOver
          ? 'linear-gradient(180deg, rgba(245, 158, 11, 0.10) 0%, rgba(245, 158, 11, 0.04) 100%)'
          : 'linear-gradient(180deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0.01) 100%)',
        border: isOver
          ? '2px dashed var(--gold-light, #f0c75e)'
          : '1px solid var(--gold-mid, #d4a017)',
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.10)',
        transition: 'background 150ms ease, border-color 150ms ease',
      }}
    >
      {/* Header */}
      <div className="px-3 sm:px-4 pt-2.5 sm:pt-4 pb-1.5 sm:pb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            aria-hidden="true"
            className="shrink-0 w-5 h-5 sm:w-7 sm:h-7 inline-flex items-center justify-center rounded-full text-xs sm:text-base"
            style={{
              background:
                'linear-gradient(135deg, var(--gold-mid, #d4a017) 0%, var(--gold-light, #f0c75e) 100%)',
              border: '1px solid var(--gold-deep, #9a6b0e)',
            }}
          >
            {column.ornament}
          </span>
          <div className="min-w-0">
            <h3
              className="font-bold text-xs sm:text-sm truncate"
              style={{
                color: 'var(--manuscript-cream, #fbf3df)',
                fontFamily: 'Georgia, "Times New Roman", serif',
                letterSpacing: '0.02em',
              }}
            >
              {column.title}
            </h3>
            <p
              className="text-[8px] sm:text-[10px] uppercase font-bold"
              style={{ color: 'var(--gold-light, #f0c75e)', letterSpacing: '0.18em' }}
            >
              {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
            </p>
          </div>
        </div>
      </div>

      {/* Header rule — gold gradient on the deep ground */}
      <div
        className="mx-3 sm:mx-4 mb-2 sm:mb-3 h-px"
        style={{ background: column.headerRule }}
        aria-hidden="true"
      />

      {/* Cards */}
      <div className="px-2 sm:px-3 pb-2 sm:pb-3 flex flex-col gap-1.5 sm:gap-2 flex-1 min-h-[60px]">
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((task) => (
            <KanbanCard
              key={task.id}
              task={task}
              onToggle={onToggle}
              onDelete={onDelete}
            />
          ))}
        </SortableContext>

        {tasks.length === 0 && (
          <div
            className="rounded-xl py-4 sm:py-6 text-center text-[10px] sm:text-[11px] uppercase font-bold"
            style={{
              border: '1px dashed var(--gold-deep, #9a6b0e)',
              color: 'var(--gold-light, #f0c75e)',
              background: 'rgba(0, 0, 0, 0.18)',
              letterSpacing: '0.18em',
            }}
          >
            Drop tasks here
          </div>
        )}
      </div>
    </div>
  );
};