import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Task, TaskStatus, TaskReorderUpdate } from '../../services/taskService';
import { taskService } from '../../services/taskService';
import { useToast } from '../../components/Toast';
import { KanbanColumn } from './KanbanColumn';
import { KanbanCard } from './KanbanCard';
import { COLUMNS, COLUMN_IDS } from './columns';

/**
 * KanbanBoard
 * -----------
 * The drag-and-drop container. Hosts the dnd-kit ``DndContext`` and the
 * four Kanban columns, and translates drag events into mutations on the
 * ``/tasks/reorder`` endpoint.
 *
 * Optimistic update flow:
 *
 *   1. User starts dragging a card → ``onDragStart`` records the id and
 *      status so we can render the floating overlay.
 *   2. While the card is over a different column, ``onDragOver`` mutates
 *      local state so the visual layout updates immediately.
 *   3. When the user releases the mouse, ``onDragEnd``:
 *      - computes the new (status, position) for every card whose index
 *        shifted as a result of the move,
 *      - fires the ``reorderTasks`` mutation,
 *      - on success the React Query cache is invalidated so the server
 *        state re-asserts itself,
 *      - on error local state is rolled back and a toast is shown.
 */

interface KanbanBoardProps {
  tasks: Task[];
  onToggle?: (task: Task) => void;
  onDelete?: (task: Task) => void;
}

type ColumnMap = Record<TaskStatus, Task[]>;

const buildColumns = (tasks: Task[]): ColumnMap => {
  const out: ColumnMap = { ideas: [], todo: [], doing: [], done: [] };
  for (const task of tasks) {
    const col = COLUMN_IDS.includes(task.status) ? task.status : 'ideas';
    out[col].push(task);
  }
  // Ensure each column is sorted by position so the UI reflects the
  // server's canonical ordering.
  for (const id of COLUMN_IDS) {
    out[id].sort((a, b) => a.position - b.position);
  }
  return out;
};

export const KanbanBoard = ({ tasks, onToggle, onDelete }: KanbanBoardProps) => {
  const queryClient = useQueryClient();
  const { error: showErrorToast } = useToast();

  // Local copy of the grouped columns. We mutate this optimistically during
  // a drag and roll back if the server rejects the reorder.
  const [columns, setColumns] = useState<ColumnMap>(() => buildColumns(tasks));

  // Whether a drag is currently in progress. While ``true`` we MUST NOT
  // sync ``columns`` from the ``tasks`` prop — otherwise the in-progress
  // optimistic move gets clobbered on the next render and the card
  // visually snaps back. This was the root cause of the "can't drag
  // across columns" symptom.
  const isDraggingRef = useRef(false);

  // Whenever the server-driven ``tasks`` prop changes (refetch, add,
  // delete, or successful reorder), rebuild the local grouping — but
  // skip the sync while a drag is in flight, so the optimistic move
  // stays put until the user releases the mouse.
  //
  // The flow:
  //   1. onDragStart   -> isDraggingRef.current = true
  //   2. onDragOver    -> optimistic setColumns() (visual only)
  //   3. onDragEnd     -> POST /tasks/reorder (mutates server)
  //   4. mutation ok   -> setQueryData([...]) flips the cache; that
  //                       triggers a re-render with the new ``tasks``,
  //                       and isDraggingRef flips back to false
  //                       so the prop-sync updates local state cleanly.
  const incoming = useMemo(() => buildColumns(tasks), [tasks]);
  useEffect(() => {
    if (isDraggingRef.current) return;
    if (incoming === columns) return;
    setColumns(incoming);
  }, [incoming, columns]);

  const [activeId, setActiveId] = useState<number | null>(null);
  const activeTask = useMemo<Task | null>(() => {
    if (activeId == null) return null;
    for (const id of COLUMN_IDS) {
      const found = columns[id].find((t) => t.id === activeId);
      if (found) return found;
    }
    return null;
  }, [activeId, columns]);

  // dnd-kit sensors — pointer for desktop, touch for mobile, keyboard
  // for accessibility.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const reorderMutation = useMutation({
    mutationFn: (updates: TaskReorderUpdate[]) => taskService.reorderTasks(updates),
    onSuccess: (refreshed) => {
      // Drop the server's authoritative list into the cache so React
      // Query re-renders every consumer (e.g. the progress card).
      queryClient.setQueryData(['tasks'], refreshed);
    },
    onError: () => {
      // Roll back: rebuild from the current server state.
      setColumns(buildColumns(tasks));
      showErrorToast('Failed to reorder tasks');
    },
  });

  /**
   * Resolve which column a given drop event is targeting. We accept both
   * ``column-<status>`` (empty column hit) and the parent column of a
   * card hit (``over.id`` is a task id).
   */
  const resolveColumnId = useCallback(
    (over: DragOverEvent['over'] | null | undefined): TaskStatus | null => {
      if (!over) return null;
      const data = over.data.current as { type?: string; status?: TaskStatus } | undefined;
      if (data?.type === 'column' && data.status && COLUMN_IDS.includes(data.status)) {
        return data.status;
      }
      // ``over.id`` is either a task id (so look up its column) or a
      // column container id.
      if (typeof over.id === 'number') {
        for (const id of COLUMN_IDS) {
          if (columns[id].some((t) => t.id === over.id)) return id;
        }
      }
      if (typeof over.id === 'string' && over.id.startsWith('column-')) {
        const id = over.id.replace('column-', '') as TaskStatus;
        if (COLUMN_IDS.includes(id)) return id;
      }
      return null;
    },
    [columns],
  );

  const handleDragStart = (event: DragStartEvent) => {
    isDraggingRef.current = true;
    setActiveId(event.active.id as number);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeColumn = (() => {
      for (const id of COLUMN_IDS) {
        if (columns[id].some((t) => t.id === active.id)) return id;
      }
      return null;
    })();
    const overColumn = resolveColumnId(over);
    if (!activeColumn || !overColumn) return;

    if (activeColumn === overColumn) {
      // Reordering within a column. We don't bother computing exact
      // positions here — dnd-kit handles the visual reorder via the
      // SortableContext's array order, and we only persist on drag end.
      // We still need to reflect the new order in local state so the
      // overlay doesn't snap back.
      const overId = typeof over.id === 'number' ? over.id : null;
      if (overId == null || overId === active.id) return;
      setColumns((prev) => {
        const list = [...prev[activeColumn]];
        const fromIdx = list.findIndex((t) => t.id === active.id);
        const toIdx = list.findIndex((t) => t.id === overId);
        if (fromIdx === -1 || toIdx === -1) return prev;
        const [moved] = list.splice(fromIdx, 1);
        list.splice(toIdx, 0, moved);
        return { ...prev, [activeColumn]: list };
      });
      return;
    }

    // Cross-column move. Move the card into the target column at the
    // drop position.
    setColumns((prev) => {
      const fromList = [...prev[activeColumn]];
      const fromIdx = fromList.findIndex((t) => t.id === active.id);
      if (fromIdx === -1) return prev;
      const [moved] = fromList.splice(fromIdx, 1);

      const toList = [...prev[overColumn]];
      // Insert position: if hovering over a card, before it; otherwise append.
      let insertAt = toList.length;
      if (typeof over.id === 'number' && over.id !== active.id) {
        const overIdx = toList.findIndex((t) => t.id === over.id);
        if (overIdx !== -1) insertAt = overIdx;
      }
      // Stamp the new status on the card so the next render shows the
      // right column. We don't persist yet — that happens on drag end.
      moved.status = overColumn;
      toList.splice(insertAt, 0, moved);

      return { ...prev, [activeColumn]: fromList, [overColumn]: toList };
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active } = event;
    isDraggingRef.current = false;
    setActiveId(null);

    // Find the card's current column + index in our local state.
    let foundColumn: TaskStatus | null = null;
    let foundIndex = -1;
    for (const id of COLUMN_IDS) {
      const idx = columns[id].findIndex((t) => t.id === active.id);
      if (idx !== -1) {
        foundColumn = id;
        foundIndex = idx;
        break;
      }
    }
    if (!foundColumn || foundIndex === -1) return;

    // Build the update list: the moved card + every sibling whose index
    // shifted as a result.
    const updates: TaskReorderUpdate[] = [];
    const movedTask = columns[foundColumn][foundIndex];

    // The moved card itself
    updates.push({ id: movedTask.id, status: foundColumn, position: foundIndex });

    // Re-stamp the moved card's status field so a later render doesn't
    // disagree with the local column.
    movedTask.status = foundColumn;

    // Re-stamp every column the move touched. Simpler & safer to just
    // restamp every column whose ordering we have in local state — for
    // a within-column reorder that's the source column, for a
    // cross-column move it's both source and destination.
    for (const id of COLUMN_IDS) {
      for (let i = 0; i < columns[id].length; i++) {
        const t = columns[id][i];
        if (t.id === movedTask.id) continue;
        // Only push if the server's position disagrees with the local one
        // — keeps the payload small when nothing actually moved.
        if (t.position !== i || t.status !== id) {
          updates.push({ id: t.id, status: id, position: i });
        }
      }
    }

    // Don't bother hitting the server if the order is unchanged.
    const looksUnchanged =
      updates.length === 1 &&
      updates[0].id === movedTask.id &&
      updates[0].status === movedTask.status &&
      updates[0].position === movedTask.position;
    if (looksUnchanged) return;

    reorderMutation.mutate(updates);
  };

  const handleDragCancel = () => {
    isDraggingRef.current = false;
    setActiveId(null);
    // Roll back local state to the server's authoritative ordering.
    setColumns(buildColumns(tasks));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {COLUMNS.map((column) => (
          <KanbanColumn
            key={column.id}
            column={column}
            tasks={columns[column.id]}
            onToggle={onToggle}
            onDelete={onDelete}
          />
        ))}
      </div>

      <DragOverlay
        dropAnimation={{
          duration: 200,
          easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
        }}
      >
        {activeTask ? <KanbanCard task={activeTask} isOverlay /> : null}
      </DragOverlay>
    </DndContext>
  );
};