import type { ReactNode } from 'react';
import type { TaskStatus } from '../../services/taskService';

/**
 * Kanban column definitions.
 *
 * Each column has an id that maps 1:1 to the backend ``Task.status``
 * Literal, a display title, a short helper text shown under the header,
 * and an ornament slot for the column header.
 *
 * To add or rename a column, change this file AND the backend
 * ``TaskStatus`` Literal in ``backend/app/schemas/task.py`` — the two
 * are intentionally kept in sync by hand.
 */

export interface KanbanColumnDef {
  id: TaskStatus;
  title: string;
  /** Short caption shown under the column title. */
  hint: string;
  /** Lucide / SVG ornament to render in the header. */
  ornament: ReactNode;
  /** Tailwind / CSS gradient for the header rule. CSS variables OK. */
  headerRule: string;
}

export const COLUMNS: KanbanColumnDef[] = [
  {
    id: 'ideas',
    title: 'Wall of Ideas',
    hint: 'List all the tasks related to this project',
    ornament: '💡',
    headerRule: 'linear-gradient(90deg, transparent 0%, var(--gold-mid) 50%, transparent 100%)',
  },
  {
    id: 'todo',
    title: 'To do',
    hint: 'Committed work, ready to pick up',
    ornament: '📋',
    headerRule: 'linear-gradient(90deg, transparent 0%, var(--gold-mid) 50%, transparent 100%)',
  },
  {
    id: 'doing',
    title: 'Doing',
    hint: 'In progress right now',
    ornament: '⚙️',
    headerRule: 'linear-gradient(90deg, transparent 0%, var(--gold-light) 50%, transparent 100%)',
  },
  {
    id: 'done',
    title: 'Done',
    hint: 'Completed — celebrate!',
    ornament: '✅',
    headerRule: 'linear-gradient(90deg, transparent 0%, var(--gold-light) 50%, transparent 100%)',
  },
];

export const COLUMN_IDS = COLUMNS.map((c) => c.id);