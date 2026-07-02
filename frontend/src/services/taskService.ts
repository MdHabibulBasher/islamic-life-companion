import { api } from './api';

export type TaskStatus = 'ideas' | 'todo' | 'doing' | 'done';
export type TaskPriority = 'high' | 'medium' | 'low';

export interface Task {
  id: number;
  user_id: number;
  title: string;
  description?: string | null;
  is_completed: boolean;
  /** Kanban column. Drives the legacy ``is_completed`` flag in the API. */
  status: TaskStatus;
  /** Stable ordering within a column (ascending). */
  position: number;
  priority: TaskPriority;
  /** ISO date string (YYYY-MM-DD), or null. */
  due_date?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface TaskReorderUpdate {
  id: number;
  status: TaskStatus;
  position: number;
}

export interface CreateTaskPayload {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  due_date?: string | null;
}

export interface UpdateTaskPayload {
  title?: string;
  description?: string | null;
  is_completed?: boolean;
  status?: TaskStatus;
  priority?: TaskPriority;
  due_date?: string | null;
  position?: number;
}

class TaskService {
  async listTasks(filter?: {
    completed?: boolean;
    status?: TaskStatus;
  }): Promise<Task[]> {
    const params: Record<string, string | boolean> = {};
    if (filter?.completed !== undefined) params.completed = filter.completed;
    if (filter?.status) params.status = filter.status;
    const response = await api.get('/tasks', { params });
    return response.data;
  }

  async createTask(payload: CreateTaskPayload): Promise<Task> {
    const response = await api.post('/tasks', payload);
    return response.data;
  }

  async updateTask(id: number, payload: UpdateTaskPayload): Promise<Task> {
    const response = await api.put(`/tasks/${id}`, payload);
    return response.data;
  }

  async deleteTask(id: number): Promise<void> {
    await api.delete(`/tasks/${id}`);
  }

  /**
   * Persist a drag-and-drop reorder in one round trip. Returns the refreshed
   * task list so the client can drop it straight into its React Query cache
   * without a follow-up GET.
   */
  async reorderTasks(updates: TaskReorderUpdate[]): Promise<Task[]> {
    const response = await api.post<{ tasks: Task[] }>('/tasks/reorder', {
      updates,
    });
    return response.data.tasks;
  }
}

export const taskService = new TaskService();