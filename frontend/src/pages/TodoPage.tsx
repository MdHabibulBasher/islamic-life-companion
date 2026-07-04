import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, AlertCircle, ArrowRight } from 'lucide-react'
import {
  taskService,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from '../services/taskService'
import { useToast } from '../components/Toast'
import {
  OrnateCard,
  PageHeader,
} from '../components/IslamicOrnamentBG'
import { KanbanBoard } from './todo/KanbanBoard'

/**
 * The single column every new task lands in. The user then drags it
 * across the board: Wall of Ideas -> To do -> Doing -> Done. The
 * server also defaults to 'ideas' (see ``TaskCreate.status`` in
 * ``backend/app/schemas/task.py``) so even if a future caller forgets
 * the field, the task still lands here.
 */
const NEW_TASK_STATUS = 'ideas' as const

export const TodoPage = () => {
  const queryClient = useQueryClient()
  const { error: showErrorToast, success: showSuccessToast } = useToast()
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newPriority, setNewPriority] = useState<TaskPriority>('medium')
  const [newDueDate, setNewDueDate] = useState('')

  const {
    data: todos = [],
    isLoading,
    isError,
  } = useQuery<Task[]>({
    queryKey: ['tasks'],
    queryFn: () => taskService.listTasks(),
  })

  const createMutation = useMutation({
    mutationFn: (payload: {
      title: string
      description?: string
      status?: TaskStatus
      priority?: TaskPriority
      due_date?: string | null
    }) => taskService.createTask(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      setNewTitle('')
      setNewDescription('')
      setNewPriority('medium')
      setNewDueDate('')
      showSuccessToast('Task added')
    },
    onError: () => showErrorToast('Failed to add task'),
  })

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number
      payload: {
        title?: string
        description?: string | null
        is_completed?: boolean
        status?: TaskStatus
        priority?: TaskPriority
        due_date?: string | null
      }
    }) => taskService.updateTask(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
    onError: () => showErrorToast('Failed to update task'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => taskService.deleteTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      showSuccessToast('Task deleted')
    },
    onError: () => showErrorToast('Failed to delete task'),
  })

  const handleAddTodo = () => {
    if (!newTitle.trim()) return
    // New tasks always land in the Wall of Ideas. The user drags them
    // across To do -> Doing -> Done.
    createMutation.mutate({
      title: newTitle.trim(),
      description: newDescription.trim() || undefined,
      status: NEW_TASK_STATUS,
      priority: newPriority,
      due_date: newDueDate || null,
    })
  }

  const toggleTodo = (task: Task) => {
    // Toggling = moving to/from the Done column. We use the new status
    // field rather than the legacy is_completed so the column reflects
    // the change immediately.
    const nextStatus: TaskStatus = task.status === 'done' ? 'ideas' : 'done'
    updateMutation.mutate({
      id: task.id,
      payload: { status: nextStatus },
    })
  }

  const deleteTodo = (task: Task) => deleteMutation.mutate(task.id)

  const completedCount = todos.filter((t) => t.status === 'done').length
  const progress = todos.length > 0 ? Math.round((completedCount / todos.length) * 100) : 0

  return (
    <div className="max-w-[1500px] mx-auto px-4 py-8 md:pt-0">
      <PageHeader title="To-Do Board" />

      {/* Flow indicator — a 4-step breadcrumb explaining the intended
          drag path. Stays compact so the 4 columns keep the lion's
          share of the viewport. */}
      <FlowIndicator />

      {isError && !isLoading && (
        <OrnateCard
          topBar
          corners="all"
          className="!p-4 mb-6 flex items-center gap-3"
        >
          <AlertCircle
            size={18}
            style={{ color: 'var(--gold-deep, #9a6b0e)' }}
          />
          <span
            className="text-sm"
            style={{
              color: 'var(--emerald-deep, #064e3b)',
              fontFamily: 'Georgia, "Times New Roman", serif',
            }}
          >
            We couldn&rsquo;t load your tasks. Refresh the page to try again.
          </span>
        </OrnateCard>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 items-start">
        {/* ---- LEFT RAIL ---------------------------------------------
            Progress + Create-task form. Kept narrow so the four Kanban
            columns get the lion's share of the viewport. */}
        <aside className="flex flex-col gap-6 lg:sticky lg:top-4">
          {/* Progress card (compact, PrayerTracker-style on the deep ground) */}
          <div
            className="rounded-xl !p-4"
            style={{
              background:
                'linear-gradient(180deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0.01) 100%)',
              border: '1px solid var(--gold-mid, #d4a017)',
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <h2
                className="text-sm font-bold uppercase tracking-[0.14em]"
                style={{
                  color: 'var(--text-on-glass)',
                  fontFamily: 'Georgia, "Times New Roman", serif',
                }}
              >
                Progress
              </h2>
              <span
                className="text-base font-bold tabular-nums"
                style={{
                  color: 'var(--gold-light, #f0c75e)',
                  fontFamily: 'Georgia, "Times New Roman", serif',
                }}
              >
                {completedCount}/{todos.length}
              </span>
            </div>
            <div
              className="w-full rounded-full h-2 overflow-hidden"
              style={{ background: 'rgba(0, 0, 0, 0.30)' }}
            >
              <div
                className="h-2 rounded-full transition-all duration-500"
                style={{
                  width: `${progress}%`,
                  background:
                    'linear-gradient(90deg, var(--gold-mid) 0%, var(--gold-light) 100%)',
                }}
              />
            </div>
            <p
              className="text-[10px] uppercase font-bold mt-2"
              style={{ color: 'var(--gold-mid, #d4a017)', letterSpacing: '0.18em' }}
            >
              {progress}% Complete
            </p>
          </div>

          {/* Create-task form (compact, PrayerTracker-style on the deep ground) */}
          <div
            className="rounded-xl !p-4"
            style={{
              background:
                'linear-gradient(180deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0.01) 100%)',
              border: '1px solid var(--gold-mid, #d4a017)',
            }}
          >
            <h2
              className="text-sm font-bold uppercase tracking-[0.14em] mb-3"
              style={{
                color: 'var(--text-on-glass)',
                fontFamily: 'Georgia, "Times New Roman", serif',
              }}
            >
              Create New Task
            </h2>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Task title..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTodo()}
                className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 placeholder:opacity-50"
                style={{
                  background: 'rgba(0, 0, 0, 0.30)',
                  border: '1px solid var(--gold-mid, #d4a017)',
                  color: 'var(--text-on-glass)',
                }}
              />
              <textarea
                placeholder="Description (optional)..."
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 placeholder:opacity-50"
                style={{
                  background: 'rgba(0, 0, 0, 0.30)',
                  border: '1px solid var(--gold-mid, #d4a017)',
                  color: 'var(--text-on-glass)',
                }}
              />
              {/* Subtle hint that new tasks always land in Wall of Ideas
                  — the user then drags them right. No dropdown needed. */}
              <p
                className="text-[10px] uppercase font-bold flex items-center gap-1.5"
                style={{ color: 'var(--gold-mid, #d4a017)', letterSpacing: '0.18em' }}
              >
                <ArrowRight size={11} />
                Lands in Wall of Ideas, then drag across
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label
                    className="block text-[10px] uppercase font-bold mb-1"
                    style={{ color: 'var(--gold-mid, #d4a017)', letterSpacing: '0.18em' }}
                  >
                    Priority
                  </label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as TaskPriority)}
                    className="w-full px-2 py-2 rounded-lg text-sm focus:outline-none focus:ring-2"
                    style={{
                      background: 'rgba(0, 0, 0, 0.30)',
                      border: '1px solid var(--gold-mid, #d4a017)',
                      color: 'var(--text-on-glass)',
                    }}
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                <div>
                  <label
                    className="block text-[10px] uppercase font-bold mb-1"
                    style={{ color: 'var(--gold-mid, #d4a017)', letterSpacing: '0.18em' }}
                  >
                    Due
                  </label>
                  <input
                    type="date"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="w-full px-2 py-2 rounded-lg text-sm focus:outline-none focus:ring-2"
                    style={{
                      background: 'rgba(0, 0, 0, 0.30)',
                      border: '1px solid var(--gold-mid, #d4a017)',
                      color: 'var(--text-on-glass)',
                    }}
                  />
                </div>
              </div>
              <button
                onClick={handleAddTodo}
                disabled={createMutation.isPending || !newTitle.trim()}
                className="w-full px-3 py-2 rounded-lg text-sm font-bold uppercase transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{
                  background:
                    'linear-gradient(135deg, var(--gold-mid, #d4a017) 0%, var(--gold-light, #f0c75e) 100%)',
                  color: 'var(--emerald-deep, #064e3b)',
                  border: '1px solid var(--gold-deep, #9a6b0e)',
                  letterSpacing: '0.18em',
                }}
              >
                <Plus size={16} />
                {createMutation.isPending ? 'Adding…' : 'Add Task'}
              </button>
            </div>
          </div>
        </aside>

        {/* ---- RIGHT — Kanban board (takes the rest of the width) --- */}
        <section className="min-w-0">
          {isLoading ? (
            <OrnateCard topBar corners="all" className="!p-8 text-center">
              <p style={{ color: 'var(--gold-deep)' }}>Loading tasks…</p>
            </OrnateCard>
          ) : (
            <KanbanBoard
              tasks={todos}
              onToggle={toggleTodo}
              onDelete={deleteTodo}
            />
          )}
        </section>
      </div>
    </div>
  )
}

/**
 * FlowIndicator
 * -------------
 * Compact 4-step breadcrumb that explains the intended drag path on the
 * board: Wall of Ideas -> To do -> Doing -> Done. Each step is a
 * gold-on-emerald pill with a connecting arrow so the user immediately
 * understands the workflow without having to read instructions.
 */
const FLOW_STEPS: { id: string; label: string; icon: string }[] = [
  { id: 'ideas', label: 'Wall of Ideas', icon: '??' },
  { id: 'todo', label: 'To do', icon: '??' },
  { id: 'doing', label: 'Doing', icon: '??' },
  { id: 'done', label: 'Done', icon: '?' },
]

const FlowIndicator = () => (
  <div className="mb-6 flex items-center gap-2 flex-wrap">
    <span
      className="text-[10px] uppercase font-bold mr-1"
      style={{ color: 'var(--gold-mid, #d4a017)', letterSpacing: '0.18em' }}
    >
      Flow
    </span>
    {FLOW_STEPS.map((step, idx) => (
      <div key={step.id} className="flex items-center gap-2">
        <div
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full"
          style={{
            background: idx === 0
              ? 'linear-gradient(135deg, var(--gold-mid, #d4a017) 0%, var(--gold-light, #f0c75e) 100%)'
              : 'rgba(0, 0, 0, 0.30)',
            color: idx === 0
              ? 'var(--emerald-deep, #064e3b)'
              : 'var(--manuscript-cream, #fbf3df)',
            border: '1px solid var(--gold-mid, #d4a017)',
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.06em',
          }}
        >
          <span aria-hidden="true">{step.icon}</span>
          {step.label}
        </div>
        {idx < FLOW_STEPS.length - 1 && (
          <ArrowRight
            size={14}
            style={{ color: 'var(--gold-mid, #d4a017)' }}
          />
        )}
      </div>
    ))}
  </div>
)
