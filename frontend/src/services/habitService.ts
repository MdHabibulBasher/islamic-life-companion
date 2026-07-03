import { api } from './api'

export enum TrackingType {
  CHECKBOX = 'checkbox',
  COUNTER = 'counter',
  TIMER = 'timer',
}

export interface HabitCategory {
  id: number
  name_en: string
  name_bn?: string
  icon?: string
  color: string
  is_default: boolean
}

export interface HabitTracking {
  id: number
  user_id: number
  habit_id: number
  tracking_date: string
  is_completed: boolean
  counter_value: number
  timer_seconds: number
  notes?: string
  created_at: string
  updated_at?: string
}

export interface UserHabit {
  id: number
  user_id: number
  category_id: number
  name: string
  description?: string
  tracking_type: TrackingType
  target_value?: number
  unit?: string
  is_active: boolean
  is_deleted: boolean
  created_at: string
  updated_at?: string
}

export interface HabitStreak {
  id: number
  user_id: number
  habit_id: number
  current_streak: number
  longest_streak: number
  last_completed_date?: string
  created_at: string
  updated_at?: string
}

export interface HabitWithTracking {
  habit: UserHabit
  today_tracking?: HabitTracking
  streak?: HabitStreak
}

export interface DailyHabitSummary {
  id: number
  user_id: number
  summary_date: string
  total_habits: number
  completed_habits: number
  completion_rate: number
  created_at: string
}

export interface HabitRangeDayPoint {
  date: string
  total_habits: number
  completed_habits: number
  completion_rate: number
}

export interface HabitRangeSummary {
  start: string
  end: string
  days_in_range: number
  total_habits: number
  completed_habits: number
  completion_rate: number
  per_day: HabitRangeDayPoint[]
}

export interface CreateHabitData {
  category_id: number
  name: string
  description?: string
  tracking_type: TrackingType
  target_value?: number
  unit?: string
}

export interface UpdateHabitData {
  category_id?: number
  name?: string
  description?: string
  tracking_type?: TrackingType
  target_value?: number
  unit?: string
  is_active?: boolean
}

export const habitService = {
  // Get habit categories
  getCategories: async (): Promise<HabitCategory[]> => {
    try {
      const response = await api.get(`/habits/categories`)
      console.log('Habit categories fetched:', response.data)
      return response.data
    } catch (error) {
      console.error('Error fetching habit categories:', error)
      throw error
    }
  },

  // Get all user habits with optional start_date parameter
  getHabits: async (includeInactive: boolean = false, startDate?: string): Promise<HabitWithTracking[]> => {
    try {
      const params = new URLSearchParams()
      if (includeInactive) params.append('include_inactive', 'true')
      if (startDate) params.append('tracking_date', startDate)
      
      const url = `/habits${params.toString() ? '?' + params.toString() : ''}`
      const response = await api.get(url)
      console.log('Habits fetched:', response.data)
      return response.data
    } catch (error) {
      console.error('Error fetching habits:', error)
      throw error
    }
  },

  // Get habits for multiple dates (for weekly/monthly view)
  getMultipleDateTracking: async (dates: string[]): Promise<Record<string, HabitWithTracking[]>> => {
    try {
      const result: Record<string, HabitWithTracking[]> = {}
      
      // Fetch habits for each date
      for (const date of dates) {
        try {
          const response = await api.get(`/habits?tracking_date=${date}`)
          result[date] = response.data
        } catch (error) {
          console.error(`Error fetching habits for ${date}:`, error)
          result[date] = []
        }
      }
      
      return result
    } catch (error) {
      console.error('Error fetching multiple date tracking:', error)
      throw error
    }
  },

  // Create a new habit
  createHabit: async (data: CreateHabitData): Promise<UserHabit> => {
    try {
      const response = await api.post(`/habits`, data)
      console.log('Habit created:', response.data)
      return response.data
    } catch (error) {
      console.error('Error creating habit:', error)
      throw error
    }
  },

  // Update habit
  updateHabit: async (habitId: number, data: UpdateHabitData): Promise<UserHabit> => {
    try {
      const response = await api.put(`/habits/${habitId}`, data)
      console.log('Habit updated:', response.data)
      return response.data
    } catch (error) {
      console.error('Error updating habit:', error)
      throw error
    }
  },

  // Delete habit
  deleteHabit: async (habitId: number): Promise<void> => {
    try {
      await api.delete(`/habits/${habitId}`)
      console.log('Habit deleted')
    } catch (error) {
      console.error('Error deleting habit:', error)
      throw error
    }
  },

  // Update habit tracking for a specific date
  updateTracking: async (habitId: number, trackingDate: string, data: any): Promise<HabitTracking> => {
    try {
      console.log('📤 Sending tracking update:', { habitId, trackingDate, data })
      const response = await api.put(`/habits/tracking/${habitId}/${trackingDate}`, data)
      console.log('📥 Tracking updated:', response.data)
      return response.data
    } catch (error: any) {
      console.error('❌ Error updating tracking:', error)
      console.error('Error response:', error?.response?.data)
      console.error('Error status:', error?.response?.status)
      throw error
    }
  },

  // Track habit completion (create or update)
  trackHabit: async (habitId: number, trackingDate: string, isCompleted: boolean, counterValue?: number, timerSeconds?: number, notes?: string): Promise<HabitTracking> => {
    try {
      const response = await api.post(`/habits/${habitId}/track`, {
        tracking_date: trackingDate,
        is_completed: isCompleted,
        counter_value: counterValue || 0,
        timer_seconds: timerSeconds || 0,
        notes: notes || ''
      })
      console.log('Habit tracked:', response.data)
      return response.data
    } catch (error) {
      console.error('Error tracking habit:', error)
      throw error
    }
  },

  // Get habit statistics
  getStatistics: async (): Promise<any> => {
    try {
      const response = await api.get(`/habits/statistics`)
      console.log('Statistics fetched:', response.data)
      return response.data
    } catch (error) {
      console.error('Error fetching statistics:', error)
      throw error
    }
  },

  // Get habit completion across an arbitrary date range
  getRangeSummary: async (start: string, end: string): Promise<HabitRangeSummary> => {
    const r = await api.get<HabitRangeSummary>(`/habits/range-summary`, {
      params: { start, end },
    })
    return r.data
  },

  // Get daily summary
  getDailySummary: async (date: string): Promise<DailyHabitSummary> => {
    try {
      console.log('[API] Fetching daily summary for date:', date)
      const response = await api.get(`/habits/summary/${date}`)
      console.log('[API] Daily summary response:', response.data)
      return response.data
    } catch (error) {
      console.error('[API] Error fetching daily summary:', error)
      throw error
    }
  },
}
