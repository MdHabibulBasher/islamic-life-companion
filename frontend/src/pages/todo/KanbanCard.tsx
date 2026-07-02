import { memo } from 'react';
import { CSS } from '@dnd-kit/utilities';
import { useSortable } from '@dnd-kit/sortable';
import { Check, Circle, Trash2, GripVertical, CalendarDays, AlertCircle } from 'lucide-react';
import type { Task, TaskPriority } from '../../services/taskService';

/**
 * KanbanCard
 * ----------
 * A draggable task card. Wired to dnd-kit's ``useSortable`` so it can be
 * picked up by its grip handle, reordered within a column, and dropped
 * into a sibling column.
 *
 * Theme colours are read from CSS variables so the cards repaint with the
 * rest of the page when the user switches themes.
 *
 * Props
 * -----
 * task       : the task payload
 * isOverlay  : true when this card is the floating "ghost" dragged by
 *              ``<DragOverlay>`` — in that case we skip the sortable
 *              transform listeners and just render the styled shell.
 * onToggle   : mark complete / incomplete
 * onDelete   : delete
 */

interface KanbanCardProps {
  task: Task;
  isOverlay?: boolean;
  onToggle?: (task: Task) => void;
  onDelete?: (task: Task) => void;
}

const PRIORITY_STYLES: Record<
  TaskPriority,
  { label: string; bg: string; fg: string; border: string }
> = {
  high: {
    label: 'High',
    bg: 'rgba(228, 66, 68, 0.18)',
    fg: 'var(--gold-light, #f0c75e)',
    border: 'var(--missed, #e44244)',
  },
  medium: {
    label: 'Med',
    bg: 'rgba(245, 158, 11, 0.18)',
    fg: 'var(--gold-light, #f0c75e)',
    border: 'var(--accent, #f59e0b)',
  },
  low: {
    label: 'Low',
    bg: 'rgba(212, 160, 23, 0.14)',
    fg: 'var(--gold-mid, #d4a017)',
    border: 'var(--gold-deep, #9a6b0e)',
  },
};

const isOverdue = (due: string | null | undefined): boolean => {
  if (!due) return false;
  // due is a YYYY-MM-DD string. Compare against today's local date.
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return due < todayIso;
};

const formatDueDate = (due: string | null | undefined): string => {
  if (!due) return '';
  // Render the date in the user's locale, e.g. "Jul 1, 2026".
  const [y, m, d] = due.split('-').map(Number);
  if (!y || !m || !d) return due;
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const KanbanCardImpl = ({ task, isOverlay, onToggle, onDelete }: KanbanCardProps) => {
  const sortable = useSortable({
    id: task.id,
    data: { type: 'card', task },
    disabled: isOverlay,
  });

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    sortable;

  const style: React.CSSProperties = isOverlay
    ? {}
    : {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.35 : 1,
      };

  const priority = PRIORITY_STYLES[task.priority] ?? PRIORITY_STYLES.medium;
  const done = task.status === 'done';
  const overdue = isOverdue(task.due_date) && !done;

  return (
    <div
      ref={isOverlay ? undefined : setNodeRef}
      style={style}
      className="rounded-xl"
      data-completed={done ? 'true' : 'false'}
    >
      {/* Card shell — translucent on the deep emerald ground, gold hairline
          border, exactly mirroring the PrayerTracker's PrayerReferenceCard
          and Qada tiles. */}
      <div
        className="rounded-xl p-3 flex flex-col gap-2"
        style={{
          background: done
            ? 'linear-gradient(180deg, rgba(65, 126, 56, 0.10) 0%, rgba(65, 126, 56, 0.04) 100%)'
            : 'linear-gradient(180deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.02) 100%)',
          border: '1px solid var(--gold-mid, #d4a017)',
          boxShadow: isOverlay
            ? '0 24px 48px -16px rgba(0, 0, 0, 0.6), 0 0 0 2px var(--gold-mid, #d4a017)'
            : '0 1px 2px rgba(0, 0, 0, 0.10)',
          opacity: done ? 0.65 : 1,
          transform: isOverlay ? 'rotate(2deg)' : undefined,
        }}
      >
        <div className="flex items-start gap-2">
          {/* Drag handle — gold-leaf disc (matches the PrayerTracker icon discs) */}
          <button
            {...(isOverlay ? {} : attributes)}
            {...(isOverlay ? {} : listeners)}
            aria-label="Drag task"
            className="mt-0.5 flex-shrink-0 w-7 h-7 inline-flex items-center justify-center rounded-full cursor-grab active:cursor-grabbing transition"
            style={{
              background:
                'linear-gradient(135deg, var(--gold-mid, #d4a017) 0%, var(--gold-light, #f0c75e) 100%)',
              color: 'var(--emerald-deep, #064e3b)',
              border: '1px solid var(--gold-deep, #9a6b0e)',
            }}
            onClick={(e) => e.preventDefault()}
          >
            <GripVertical size={14} />
          </button>

          {/* Title + description */}
          <div className="flex-1 min-w-0">
            <h4
              className={`text-sm font-bold leading-snug ${done ? 'line-through' : ''}`}
              style={{
                color: 'var(--manuscript-cream, #fbf3df)',
                fontFamily: 'Georgia, "Times New Roman", serif',
              }}
            >
              {task.title}
            </h4>
            {task.description && (
              <p
                className="text-[11px] mt-1 leading-snug"
                style={{ color: 'var(--gold-mid, #d4a017)' }}
              >
                {task.description}
              </p>
            )}
          </div>

          {/* Toggle done — gold-rimmed pill, exactly like the "DONE" pill in
              the PrayerTracker screenshot. */}
          <button
            onClick={() => onToggle?.(task)}
            aria-label={done ? 'Mark active' : 'Mark done'}
            disabled={isOverlay}
            className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full transition text-[10px] font-bold uppercase"
            style={{
              background: done
                ? 'linear-gradient(135deg, var(--gold-mid, #d4a017) 0%, var(--gold-light, #f0c75e) 100%)'
                : 'transparent',
              color: done
                ? 'var(--emerald-deep, #064e3b)'
                : 'var(--gold-mid, #d4a017)',
              border: '1px solid var(--gold-mid, #d4a017)',
              letterSpacing: '0.18em',
            }}
          >
            {done ? <Check size={10} /> : <Circle size={10} />}
            {done ? 'Done' : 'Mark'}
          </button>
        </div>

        {/* Footer row: priority pill + due date + delete */}
        <div className="flex items-center gap-2 flex-wrap pt-1">
          <span
            className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full"
            style={{
              background: priority.bg,
              color: priority.fg,
              border: `1px solid ${priority.border}`,
              letterSpacing: '0.18em',
            }}
          >
            {priority.label}
          </span>

          {task.due_date && (
            <span
              className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full flex items-center gap-1"
              style={{
                background: overdue
                  ? 'rgba(228, 66, 68, 0.18)'
                  : 'rgba(212, 160, 23, 0.14)',
                color: overdue
                  ? 'var(--gold-light, #f0c75e)'
                  : 'var(--gold-mid, #d4a017)',
                border: overdue
                  ? '1px solid var(--missed, #e44244)'
                  : '1px solid var(--gold-deep, #9a6b0e)',
                letterSpacing: '0.18em',
              }}
              title={overdue ? 'Overdue' : 'Due'}
            >
              {overdue ? <AlertCircle size={10} /> : <CalendarDays size={10} />}
              {formatDueDate(task.due_date)}
            </span>
          )}

          <button
            onClick={() => onDelete?.(task)}
            aria-label="Delete task"
            className="ml-auto p-1 rounded-md transition opacity-70 hover:opacity-100"
            style={{
              color: 'var(--missed, #e44244)',
              background: 'transparent',
            }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

export const KanbanCard = memo(KanbanCardImpl);