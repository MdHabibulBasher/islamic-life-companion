import { api } from './api';

export interface DailySummaryPoint {
  date: string;
  total_habits: number;
  completed_habits: number;
  completion_rate: number;
}

export interface DashboardData {
  user: {
    id: number;
    full_name: string | null;
    email: string;
  };
  habits: {
    total_habits: number;
    active_habits: number;
    completed_today: number;
    completed_this_week: number;
    completed_this_month: number;
    completion_rate_today: number;
    current_streak: number;
    best_streak: number;
    last_7_days: DailySummaryPoint[];
  };
  challenges: {
    active: number;
    completed: number;
    completions_today: number;
  };
  quran: {
    total_sessions: number;
  };
  achievements: {
    unlocked: number;
  };
  generated_at: string;
}

class DashboardService {
  async get(): Promise<DashboardData> {
    const response = await api.get('/dashboard');
    return response.data;
  }
}

export const dashboardService = new DashboardService();