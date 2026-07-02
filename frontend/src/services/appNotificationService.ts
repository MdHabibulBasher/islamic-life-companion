import { api } from './api';

export interface AppNotification {
  id: number;
  title: string;
  message: string;
  notification_type: 'habit' | 'challenge' | 'prayer' | 'achievement' | 'system';
  is_read: boolean;
  action_url?: string | null;
  created_at: string;
}

class NotificationService {
  async list(filters?: {
    notification_type?: string;
    unread_only?: boolean;
  }): Promise<AppNotification[]> {
    const response = await api.get('/notifications', {
      params: filters ?? undefined,
    });
    return response.data;
  }

  async create(payload: {
    title: string;
    message: string;
    notification_type?: string;
    action_url?: string;
  }): Promise<AppNotification> {
    const response = await api.post('/notifications', payload);
    return response.data;
  }

  async markAsRead(id: number): Promise<AppNotification> {
    const response = await api.put(`/notifications/${id}/read`);
    return response.data;
  }

  async markAllAsRead(): Promise<void> {
    await api.put('/notifications/read-all');
  }

  async delete(id: number): Promise<void> {
    await api.delete(`/notifications/${id}`);
  }
}

export const notificationService = new NotificationService();