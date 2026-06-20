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
      <div className="bg-white border-2 border-amber-500 rounded-lg p-6 shadow">
        <p className="text-gray-900 font-semibold text-lg">Sign in to View Statistics</p>
        <p className="text-sm text-gray-600 mt-2">
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
          <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse border-2 border-amber-500" />
        ))}
      </div>
    )
  }

  if (statsError || habitError) {
    return (
      <div className="bg-white border-2 border-amber-500 rounded-lg p-6 shadow">
        <p className="text-gray-900 font-semibold text-lg">Failed to load statistics</p>
        <p className="text-sm text-gray-600 mt-2">
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
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, index) => {
          const Icon = card.icon
          const colors = [
            { bg: 'bg-blue-50', icon: 'bg-blue-100', text: 'text-gray-900', label: 'text-gray-600' },
            { bg: 'bg-green-50', icon: 'bg-green-100', text: 'text-gray-900', label: 'text-gray-600' },
            { bg: 'bg-orange-50', icon: 'bg-orange-100', text: 'text-gray-900', label: 'text-gray-600' },
            { bg: 'bg-purple-50', icon: 'bg-purple-100', text: 'text-gray-900', label: 'text-gray-600' },
          ]
          const colorScheme = colors[index % 4]
          
          return (
            <div
              key={card.label}
              className={`${colorScheme.bg} rounded-lg border-2 border-amber-500 p-6 transition-all duration-300 hover:shadow-lg`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`${colorScheme.icon} p-3 rounded-lg text-amber-600`}>
                  <Icon className="w-6 h-6" />
                </div>
              </div>
              <p className={`${colorScheme.label} text-sm font-medium`}>{card.label}</p>
              <p className={`${colorScheme.text} text-3xl font-bold mt-2`}>{card.value}</p>
            </div>
          )
        })}
      </div>
      {/* Summary Card */}
      <div className="bg-white rounded-lg p-8 border-2 border-amber-500 shadow">
        <h3 className="text-2xl font-bold text-gray-900 mb-4">Your Journey</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-blue-50 rounded-lg p-4 border border-gray-200">
            <p className="text-gray-600 font-medium text-sm mb-2">Total Commitments</p>
            <p className="text-4xl font-bold text-gray-900">{(stats?.total_challenges_joined || 0) + (habitStats?.total_habits || 0)}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-4 border border-gray-200">
            <p className="text-gray-600 font-medium text-sm mb-2">Keep Going</p>
            <p className="text-base text-gray-700 font-medium">You're building amazing habits and completing challenges. Stay consistent!</p>
          </div>
          <div className="bg-orange-50 rounded-lg p-4 border border-gray-200">
            <p className="text-gray-600 font-medium text-sm mb-2">Overall Progress</p>
            <p className="text-4xl font-bold text-gray-900">
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




