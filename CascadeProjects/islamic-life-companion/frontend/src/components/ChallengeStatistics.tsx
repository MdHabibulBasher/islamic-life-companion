import { useQuery } from '@tanstack/react-query'
import { Trophy, TrendingUp, Flame, Target, CheckCircle2, Zap, Activity } from 'lucide-react'
import { api } from '../services/api'
import { useAuthStore } from '../store/authStore'

interface ChallengeStats {
  total_challenges_joined: number
  total_challenges_completed: number
  completion_rate: number
  best_streak: number
  by_category: Record<string, { total: number; completed: number }>
}

interface HabitStats {
  total_habits: number
  completed_today: number
  completion_rate: number
  best_streak: number
  this_week: number
  this_month: number
}

export const ChallengeStatistics = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  
  // If not authenticated, show login message
  if (!isAuthenticated) {
    return (
      <div className="bg-gradient-to-br from-emerald-100 to-purple-100 border border-emerald-300 rounded-2xl p-6">
        <p className="text-emerald-700 font-semibold">Sign in to View Statistics</p>
        <p className="text-sm text-emerald-600 mt-2">
          Please log in to see your habit and challenge statistics.
        </p>
      </div>
    )
  }
  
  const { data: stats, isLoading, error: statsError } = useQuery({
    queryKey: ['challenge-statistics'],
    queryFn: async () => {
      try {
        console.log('[API] Requesting /challenges/statistics')
        const response = await api.get('/challenges/statistics')
        console.log('[API] Challenge response received:', response.data)
        return response.data as ChallengeStats
      } catch (error) {
        console.error('[API ERROR] Challenge stats error:', error)
        if (error instanceof Error) {
          console.error('[API ERROR] Message:', error.message)
        }
        // @ts-ignore
        if (error?.response) {
          // @ts-ignore
          console.error('[API ERROR] Response status:', error.response.status)
          // @ts-ignore
          console.error('[API ERROR] Response data:', error.response.data)
        }
        // Return default values on error
        return {
          total_challenges_joined: 0,
          total_challenges_completed: 0,
          completion_rate: 0,
          best_streak: 0,
          by_category: {}
        }
      }
    },
    retry: 1,
  })

  const { data: habitStats, isLoading: habitStatsLoading, error: habitError } = useQuery({
    queryKey: ['habit-statistics'],
    queryFn: async () => {
      try {
        console.log('[API] Requesting /habits/statistics')
        const response = await api.get('/habits/statistics')
        console.log('[API] Response received:', response.data)
        return response.data as HabitStats
      } catch (error) {
        console.error('[API ERROR] Habit stats error:', error)
        if (error instanceof Error) {
          console.error('[API ERROR] Message:', error.message)
        }
        // @ts-ignore
        if (error?.response) {
          // @ts-ignore
          console.error('[API ERROR] Response status:', error.response.status)
          // @ts-ignore
          console.error('[API ERROR] Response data:', error.response.data)
        }
        // Return default values on error
        return {
          total_habits: 0,
          completed_today: 0,
          completion_rate: 0,
          best_streak: 0,
          this_week: 0,
          this_month: 0
        }
      }
    },
    retry: 1,
  })

  if (isLoading || habitStatsLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 bg-gradient-to-br from-emerald-200 to-purple-200 rounded-2xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (statsError || habitError) {
    return (
      <div className="bg-gradient-to-br from-red-100 to-orange-100 border border-red-300 rounded-2xl p-6">
        <p className="text-red-700 font-semibold">Failed to load statistics</p>
        <p className="text-sm text-red-600 mt-2">
          {statsError ? 'Challenge stats error' : ''} {habitError ? 'Habit stats error' : ''}
        </p>
      </div>
    )
  }

  const statCards = [
    // Challenge Stats
    ...(stats ? [
      {
        label: 'Challenges Joined',
        value: stats.total_challenges_joined,
        icon: Target,
        color: 'from-emerald-500 to-emerald-600',
        bgColor: 'gradient-emerald',
      },
      {
        label: 'Challenges Completed',
        value: stats.total_challenges_completed,
        icon: Trophy,
        color: 'from-purple-500 to-purple-600',
        bgColor: 'gradient-purple',
      },
      {
        label: 'Challenge Completion Rate',
        value: `${Math.round(stats.completion_rate)}%`,
        icon: TrendingUp,
        color: 'from-teal-500 to-teal-600',
        bgColor: 'gradient-teal',
      },
      {
        label: 'Best Challenge Streak',
        value: `${stats.best_streak} days`,
        icon: Flame,
        color: 'from-violet-500 to-violet-600',
        bgColor: 'gradient-violet',
      },
    ] : []),
    // Habit Stats
    ...(habitStats ? [
      {
        label: 'Total Habits',
        value: habitStats.total_habits,
        icon: Activity,
        color: 'from-emerald-500 to-emerald-600',
        bgColor: 'gradient-emerald',
      },
      {
        label: 'Completed Today',
        value: habitStats.completed_today,
        icon: CheckCircle2,
        color: 'from-purple-500 to-purple-600',
        bgColor: 'gradient-purple',
      },
      {
        label: 'Habit Completion %',
        value: `${Math.round(habitStats.completion_rate)}%`,
        icon: TrendingUp,
        color: 'from-teal-500 to-teal-600',
        bgColor: 'gradient-teal',
      },
      {
        label: 'Best Habit Streak',
        value: `${habitStats.best_streak} days`,
        icon: Zap,
        color: 'from-violet-500 to-violet-600',
        bgColor: 'gradient-violet',
      },
    ] : []),
  ]

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex items-center gap-2">
        <Zap className="w-8 h-8 text-emerald-500" />
        <h2 className="text-2xl font-bold text-emerald-900">Your Statistics</h2>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon
          return (
            <div
              key={card.label}
              className={`${card.bgColor} rounded-3xl border border-emerald-300 p-6 transition-all duration-300 hover:shadow-soft hover:scale-105`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`bg-gradient-to-r ${card.color} p-3 rounded-xl text-white`}>
                  <Icon className="w-6 h-6" />
                </div>
              </div>
              <p className="text-emerald-700 text-sm font-medium">{card.label}</p>
              <p className="text-3xl font-bold text-emerald-900 mt-2">{card.value}</p>
            </div>
          )
        })}
      </div>
      {/* Summary Card */}
      <div className="gradient-magic rounded-3xl p-8 border border-purple-300">
        <h3 className="text-xl font-bold text-purple-900 mb-4">Your Journey 🚀</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-purple-700 text-sm mb-1">Total Commitments</p>
            <p className="text-3xl font-bold text-purple-900">{(stats?.total_challenges_joined || 0) + (habitStats?.total_habits || 0)}</p>
          </div>
          <div>
            <p className="text-purple-700 text-sm mb-1">Keep Going!</p>
            <p className="text-lg text-purple-800">You're building amazing habits and completing challenges. Stay consistent!</p>
          </div>
          <div>
            <p className="text-purple-700 text-sm mb-1">Overall Progress</p>
            <p className="text-3xl font-bold text-purple-900">
              {stats && habitStats 
                ? Math.round(((stats.total_challenges_completed + habitStats.completed_today) / ((stats.total_challenges_joined || 1) + (habitStats.total_habits || 1))) * 100)
                : 0}%
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
