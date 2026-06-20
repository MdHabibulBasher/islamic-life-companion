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
