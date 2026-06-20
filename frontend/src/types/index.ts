// Prayer times interface
export interface PrayerTime {
  name: string
  time: string
  arabic?: string
}

export interface DailyPrayerTimes {
  date: string
  fajr: string
  dhuhr: string
  asr: string
  maghrib: string
  isha: string
}

// User interface
export interface User {
  id: number
  email: string
  username?: string
  full_name?: string
  created_at: string
  updated_at?: string
}

// Auth response
export interface AuthResponse {
  access_token: string
  refresh_token: string
  user: User
}

// Achievement interface
export interface Achievement {
  id: number
  name_en: string
  name_bn?: string
  description_en?: string
  description_bn?: string
  badge_icon?: string
  requirement_type: string
  requirement_value: number
}

export interface UserAchievement {
  id: number
  achievement_id: number
  unlocked_at: string
  achievement?: Achievement
}

// Challenge interfaces (already in challengeService)
export interface ChallengeCategory {
  id: string
  name: string
  icon: string
}

// Statistics response
export interface StatisticsResponse {
  active_habits: number
  total_habits: number
  completed_today: number
  completion_rate: number
  this_week: number
  this_month: number
  best_streak: number
}

// Notification interface
export interface Notification {
  id: string
  type: 'success' | 'error' | 'info' | 'warning'
  message: string
  duration?: number
}

// Form data
export interface LoginFormData {
  email: string
  password: string
}

export interface SignupFormData {
  email: string
  username: string
  full_name: string
  password: string
  confirmPassword: string
}
