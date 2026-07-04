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
 * server also defaults to 'ideas' (see TaskCreate.status in
 * backend/app/schemas/task.py) so even if a future caller forgets
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
    createMutation.mutate({
      title: newTitle.trim(),
      description: newDescription.trim() || undefined,
      status: NEW_TASK_STATUS,
      priority: newPriority,
      due_date: newDueDate || null,
    })
  }

  const toggleTodo = (task: Task) => {
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
    <div className="max-w-[1500px] mx-auto px-2 sm:px-4 py-3 md:py-8 md:pt-0">
      <PageHeader title="To-Do Board" centered />

      {isError && !isLoading && (
        <OrnateCard
          topBar
          corners="all"
          className="!p-3 sm:!p-4 mb-3 sm:mb-6 flex items-center gap-3"
        >
          <AlertCircle
            size={18}
            style={{ color: 'var(--gold-light, #f0c75e)' }}
          />
          <span
            className="text-sm"
            style={{
              color: 'var(--manuscript-cream, #fbf3df)',
              fontFamily: 'Georgia, "Times New Roman", serif',
            }}
          >
            We couldn&rsquo;t load your tasks. Refresh the page to try again.
          </span>
        </OrnateCard>
      )}

      {/* Create New Task - shown at the top on mobile, in the left rail on desktop */}
      <div className="mb-3 lg:mb-0 lg:hidden">
        <CreateTaskForm
          newTitle={newTitle}
          newDescription={newDescription}
          newPriority={newPriority}
          newDueDate={newDueDate}
          setNewTitle={setNewTitle}
          setNewDescription={setNewDescription}
          setNewPriority={setNewPriority}
          setNewDueDate={setNewDueDate}
          handleAddTodo={handleAddTodo}
          isPending={createMutation.isPending}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-3 lg:gap-6 items-start">
        {/* LEFT RAIL: Progress + Create-task form (desktop only).
            On mobile the board is the priority, so we render the board
            first and push this rail below it. */}
        <aside className="flex flex-col gap-4 lg:gap-6 order-2 lg:order-1 lg:sticky lg:top-4">
          {/* Progress card */}
          <div
            className="rounded-xl !p-2.5 sm:!p-4"
            style={{
              background:
                'linear-gradient(180deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0.01) 100%)',
              border: '1px solid var(--gold-mid, #d4a017)',
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <h2
                className="text-xs sm:text-sm font-bold uppercase tracking-[0.14em]"
                style={{
                  color: 'var(--manuscript-cream, #fbf3df)',
                  fontFamily: 'Georgia, "Times New Roman", serif',
                }}
              >
                Progress
              </h2>
              <span
                className="text-sm sm:text-base font-bold tabular-nums"
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
              className="text-[9px] sm:text-[10px] uppercase font-bold mt-2"
              style={{ color: 'var(--gold-light, #f0c75e)', letterSpacing: '0.18em' }}
            >
              {progress}% Complete
            </p>
          </div>

          {/* Create-task form - desktop only (mobile shows it at the top) */}
          <div className="hidden lg:block">
            <CreateTaskForm
              newTitle={newTitle}
              newDescription={newDescription}
              newPriority={newPriority}
              newDueDate={newDueDate}
              setNewTitle={setNewTitle}
              setNewDescription={setNewDescription}
              setNewPriority={setNewPriority}
              setNewDueDate={setNewDueDate}
              handleAddTodo={handleAddTodo}
              isPending={createMutation.isPending}
            />
          </div>
        </aside>

        {/* RIGHT - Kanban board (takes the rest of the width) */}
        <section className="min-w-0 order-1 lg:order-2">
          {isLoading ? (
            <OrnateCard topBar corners="all" className="!p-5 sm:!p-8 text-center">
              <p style={{ color: 'var(--gold-light, #f0c75e)' }}>Loading tasks...</p>
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
 * CreateTaskForm
 * -------------
 * Reusable create-task form component. Rendered at the top of the page
 * on mobile (where the FlowIndicator used to be) and in the left rail
 * on desktop.
 */
interface CreateTaskFormProps {
  newTitle: string
  newDescription: string
  newPriority: TaskPriority
  newDueDate: string
  setNewTitle: (v: string) => void
  setNewDescription: (v: string) => void
  setNewPriority: (v: TaskPriority) => void
  setNewDueDate: (v: string) => void
  handleAddTodo: () => void
  isPending: boolean
}

const CreateTaskForm = ({
  newTitle,
  newDescription,
  newPriority,
  newDueDate,
  setNewTitle,
  setNewDescription,
  setNewPriority,
  setNewDueDate,
  handleAddTodo,
  isPending,
}: CreateTaskFormProps) => (
  <div
    className="rounded-xl !p-2.5 sm:!p-4"
    style={{
      background:
        'linear-gradient(180deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0.01) 100%)',
      border: '1px solid var(--gold-mid, #d4a017)',
    }}
  >
    <h2
      className="text-xs sm:text-sm font-bold uppercase tracking-[0.14em] mb-2 sm:mb-3"
      style={{
        color: 'var(--manuscript-cream, #fbf3df)',
        fontFamily: 'Georgia, "Times New Roman", serif',
      }}
    >
      Create New Task
    </h2>
    <div className="space-y-1.5 sm:space-y-3">
      <input
        type="text"
        placeholder="Task title..."
        value={newTitle}
        onChange={(e) => setNewTitle(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleAddTodo()}
        className="w-full px-2.5 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 placeholder:opacity-50"
        style={{
          background: 'rgba(0, 0, 0, 0.30)',
          border: '1px solid var(--gold-mid, #d4a017)',
          color: 'var(--manuscript-cream, #fbf3df)',
        }}
      />
      <textarea
        placeholder="Description (optional)..."
        value={newDescription}
        onChange={(e) => setNewDescription(e.target.value)}
        rows={2}
        className="w-full px-2.5 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 placeholder:opacity-50"
        style={{
          background: 'rgba(0, 0, 0, 0.30)',
          border: '1px solid var(--gold-mid, #d4a017)',
          color: 'var(--manuscript-cream, #fbf3df)',
        }}
      />
      <p
        className="hidden sm:flex text-[10px] uppercase font-bold items-center gap-1.5"
        style={{ color: 'var(--gold-light, #f0c75e)', letterSpacing: '0.18em' }}
      >
        <ArrowRight size={11} />
        Lands in Wall of Ideas, then drag across
      </p>
      <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
        <div>
          <label
            className="block text-[9px] sm:text-[10px] uppercase font-bold mb-0.5 sm:mb-1"
            style={{ color: 'var(--gold-light, #f0c75e)', letterSpacing: '0.18em' }}
          >
            Priority
          </label>
          <select
            value={newPriority}
            onChange={(e) => setNewPriority(e.target.value as TaskPriority)}
            className="w-full px-2 py-1.5 sm:py-2.5 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2"
            style={{
              background: 'rgba(0, 0, 0, 0.30)',
              border: '1px solid var(--gold-mid, #d4a017)',
              color: 'var(--manuscript-cream, #fbf3df)',
            }}
          >
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
        <div>
          <label
            className="block text-[9px] sm:text-[10px] uppercase font-bold mb-0.5 sm:mb-1"
            style={{ color: 'var(--gold-light, #f0c75e)', letterSpacing: '0.18em' }}
          >
            Due
          </label>
          <input
            type="date"
            value={newDueDate}
            onChange={(e) => setNewDueDate(e.target.value)}
            className="w-full px-2 py-1.5 sm:py-2.5 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2"
            style={{
              background: 'rgba(0, 0, 0, 0.30)',
              border: '1px solid var(--gold-mid, #d4a017)',
              color: 'var(--manuscript-cream, #fbf3df)',
            }}
          />
        </div>
      </div>
      <button
        onClick={handleAddTodo}
        disabled={isPending || !newTitle.trim()}
        className="w-full px-3 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-bold uppercase transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        style={{
          background:
            'linear-gradient(135deg, var(--gold-mid, #d4a017) 0%, var(--gold-light, #f0c75e) 100%)',
          color: 'var(--emerald-deep, #064e3b)',
          border: '1px solid var(--gold-deep, #9a6b0e)',
          letterSpacing: '0.18em',
        }}
      >
        <Plus size={16} />
        {isPending ? 'Adding...' : 'Add Task'}
      </button>
    </div>
  </div>
)