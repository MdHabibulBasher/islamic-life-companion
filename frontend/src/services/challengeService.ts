import { api } from './api'

export interface Challenge {
  id: string
  name_en: string
  description?: string
  category?: string
  duration_days: number
  difficulty: string
  required_difficulty?: string
  icon?: string
  reward?: string
  notification_time?: string
  is_active: boolean
  level: number
  prerequisite_challenge_id?: string | null
  // ── Journey-specific metadata ─────────────────────────────────────
  challenge_type?: 'daily' | 'streak' | 'learning' | 'spiritual' | 'sunnah' | 'boss'
  position?: number
  streak_target?: number | null
  reward_tier?: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | null
  dua_reminder?: string | null
}

export interface Hadith {
  id: number
  text_en: string
  source?: string
  context?: string
  level?: number
}

export interface Reward {
  id: string
  name_en: string
  description?: string
  icon?: string
  tier: string
  reward_kind: 'badge' | 'frame' | 'title' | 'theme'
  challenge_id?: string | null
  level?: number | null
  is_unlocked: boolean
}

export interface CurrentChallengeResponse {
  current: Challenge | null
  hadith: Hadith | null
}

export interface UserChallengeProgress {
  id: number
  challenge_id: string
  accepted_date: string
  is_completed: boolean
  current_streak: number
  max_streak: number
  last_completion_date?: string
  is_unlocked: boolean
  notification_enabled: boolean
  grace_day_used: boolean
}

export interface ChallengeCompletion {
  id: number
  challenge_id: string
  completion_date: string
}

export interface UserChallengeDetailed {
  challenge: Challenge
  progress: UserChallengeProgress
  completions: ChallengeCompletion[]
}

export const challengeService = {
  // Get all available challenges
  getChallenges: async (): Promise<Challenge[]> => {
    try {
      const response = await api.get(`/challenges`)
      console.log('Challenges fetched:', response.data)
      return response.data
    } catch (error) {
      console.error('Error fetching challenges:', error)
      throw error
    }
  },

  // Get only the challenges the user is allowed to see right now
  // (Level 1 always; Level 2 only after completing all Level 1; etc.)
  getAvailableChallenges: async (): Promise<Challenge[]> => {
    try {
      const response = await api.get(`/challenges/available`)
      console.log('Available challenges fetched:', response.data)
      return response.data
    } catch (error) {
      console.error('Error fetching available challenges:', error)
      throw error
    }
  },

  // Get the user's CURRENT challenge (the one they should be working on)
  getCurrentChallenge: async (): Promise<CurrentChallengeResponse> => {
    try {
      const response = await api.get(`/challenges/current`)
      return response.data
    } catch (error) {
      console.error('Error fetching current challenge:', error)
      throw error
    }
  },

  // Get the curated hadith library
  getHadiths: async (): Promise<Hadith[]> => {
    try {
      const response = await api.get(`/challenges/hadiths`)
      return response.data
    } catch (error) {
      console.error('Error fetching hadiths:', error)
      throw error
    }
  },

  // Get the reward catalog with unlocked status
  getRewards: async (): Promise<Reward[]> => {
    try {
      const response = await api.get(`/challenges/rewards`)
      return response.data
    } catch (error) {
      console.error('Error fetching rewards:', error)
      throw error
    }
  },

  // Get user's joined challenges with progress
  getUserChallenges: async (): Promise<UserChallengeDetailed[]> => {
    try {
      const response = await api.get(`/challenges/progress`)
      console.log('User challenges fetched:', response.data)
      return response.data
    } catch (error) {
      console.error('Error fetching user challenges:', error)
      throw error
    }
  },

  // Join a challenge
  joinChallenge: async (challengeId: string, acceptedDate: string): Promise<UserChallengeProgress> => {
    try {
      const response = await api.post(`/challenges/join`, {
        challenge_id: challengeId,
        accepted_date: acceptedDate,
      })
      console.log('Challenge joined:', response.data)
      return response.data
    } catch (error) {
      console.error('Error joining challenge:', error)
      throw error
    }
  },

  // Auto-populate a prayer-related challenge from the Prayer Tracker.
  // Used right after the user selects a daily/streak prayer challenge so
  // today's data flows in automatically.
  syncFromPrayers: async (challengeId: string): Promise<{
    challenge_id: string
    joined: boolean
    changed: boolean
    action?: string
    streak?: number
    completions_today?: number
    current_streak: number
    is_completed: boolean
  }> => {
    try {
      const response = await api.post(`/challenges/sync-from-prayers/${challengeId}`)
      return response.data
    } catch (error) {
      console.error('Error syncing challenge from prayers:', error)
      throw error
    }
  },

  // Leave a challenge the user previously joined
  leaveChallenge: async (challengeId: string): Promise<{ message: string; challenge_id: string }> => {
    try {
      const response = await api.delete(`/challenges/leave/${challengeId}`)
      console.log('Challenge left:', response.data)
      return response.data
    } catch (error) {
      console.error('Error leaving challenge:', error)
      throw error
    }
  },

  // Mark challenge as completed for a specific date (or remove if already marked)
  toggleChallengeCompletion: async (challengeId: string, completionDate: string): Promise<void> => {
    try {
      console.log(`[CHALLENGE_SERVICE] Toggling completion - ID: ${challengeId}, Date: ${completionDate}`)
      const response = await api.post(`/challenges/complete/${challengeId}`, {
        challenge_id: challengeId,
        completion_date: completionDate,
      })
      console.log('[CHALLENGE_SERVICE] Challenge completion response:', response.data)
      return response.data
    } catch (error) {
      console.error('[CHALLENGE_SERVICE] Error toggling challenge completion:', error)
      throw error
    }
  },

  // Use grace day to complete yesterday's challenge
  useGraceDay: async (challengeId: string): Promise<{ message: string; streak: number }> => {
    try {
      const response = await api.post(`/challenges/grace-day/${challengeId}`)
      console.log('Grace day used:', response.data)
      return response.data
    } catch (error) {
      console.error('Error using grace day:', error)
      throw error
    }
  },

  // Get challenge statistics
  getStatistics: async () => {
    try {
      const response = await api.get(`/challenges/statistics`)
      return response.data
    } catch (error) {
      console.error('Error fetching challenge statistics:', error)
      throw error
    }
  },
}
