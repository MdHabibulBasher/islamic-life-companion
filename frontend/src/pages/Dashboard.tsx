import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Calendar, Flame, Target, Sparkles } from 'lucide-react'
import { LoadingSpinner } from '../components/Loading'
import { habitService } from '../services/habitService'

interface DashboardStats {
  active_habits: number
  total_habits: number
  completed_today: number
  completion_rate: number
  this_week: number
  this_month: number
  best_streak: number
}

export const Dashboard = () => {
  const [badges, setBadges] = useState([
    { id: 1, name: 'Week Warrior', icon: '⚔️', earned: false },
    { id: 2, name: 'Early Bird', icon: '🌅', earned: false },
    { id: 3, name: 'Consistency King', icon: '👑', earned: false },
    { id: 4, name: 'Marathon Runner', icon: '🏃', earned: false },
  ])

  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['habitStatistics'],
    queryFn: async () => {
      try {
        const response = await habitService.getStatistics()
        console.log('Statistics response:', response)
        return response as DashboardStats
      } catch (err) {
        console.error('Failed to fetch statistics:', err)
        return {
          active_habits: 0,
          total_habits: 0,
          completed_today: 0,
          completion_rate: 0,
          this_week: 0,
          this_month: 0,
          best_streak: 0,
        } as DashboardStats
      }
    },
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 10,
  })

  useEffect(() => {
    if (stats) {
      const updatedBadges = [...badges]
      if (stats.this_week >= 5) updatedBadges[0].earned = true
      if (stats.completion_rate >= 80) updatedBadges[1].earned = true
      if (stats.best_streak >= 7) updatedBadges[2].earned = true
      if (stats.this_month >= 20) updatedBadges[3].earned = true
      setBadges(updatedBadges)
    }
  }, [stats])

  if (isLoading) return <LoadingSpinner fullScreen text="Loading dashboard..." />

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="bg-coral-50 border border-coral-200 rounded-2xl p-8 max-w-md text-center">
          <p className="text-coral-700 font-semibold">Unable to load dashboard</p>
          <p className="text-sm text-coral-600 mt-2">Please try again later</p>
        </div>
      </div>
    )
  }

  if (!stats) return <LoadingSpinner fullScreen text="Loading dashboard..." />

  return (
    <div className="min-h-screen bg-cream-50 pt-24 md:pt-8 pb-20">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-6xl font-bold text-sage-800 mb-4">
            Welcome Back
          </h1>
          <p className="text-lg text-sage-600">
            {stats.completion_rate >= 80
              ? "🔥 You're on fire! Keep it up!"
              : stats.completion_rate >= 50
              ? "💪 Great progress! Keep going!"
              : "🌟 Let's start your journey!"}
          </p>
        </div>

        {/* Main Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {/* Completed Today */}
          <div className="gradient-mint rounded-3xl p-8 shadow-soft border border-mint-200 hover:shadow-soft-lg transition">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-mint-200 rounded-2xl flex items-center justify-center">
                <Calendar className="text-mint-600" size={24} />
              </div>
              <h3 className="text-xl font-semibold text-sage-800">Completed Today</h3>
            </div>
            <p className="text-5xl font-bold text-sage-800 mb-2">
              {stats.completed_today}/{stats.total_habits}
            </p>
            <div className="w-full bg-white rounded-full h-2 mb-4">
              <div
                className="bg-mint-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, (stats.completed_today / Math.max(1, stats.total_habits)) * 100)}%` }}
              ></div>
            </div>
            <p className="text-sm text-sage-600">tasks completed</p>
          </div>

          {/* Completion Rate */}
          <div className="gradient-sage rounded-3xl p-8 shadow-soft border border-sage-200 hover:shadow-soft-lg transition">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-sage-200 rounded-2xl flex items-center justify-center">
                <Target className="text-sage-600" size={24} />
              </div>
              <h3 className="text-xl font-semibold text-sage-800">Completion Rate</h3>
            </div>
            <p className="text-5xl font-bold text-sage-800 mb-2">
              {stats.completion_rate}%
            </p>
            <div className="w-full bg-white rounded-full h-2 mb-4">
              <div
                className="bg-sage-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${stats.completion_rate}%` }}
              ></div>
            </div>
            <p className="text-sm text-sage-600">of your goals achieved</p>
          </div>
        </div>

        {/* Secondary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {/* This Week */}
          <div className="bg-white rounded-3xl p-8 shadow-soft border border-sage-200 hover:shadow-soft-lg transition text-center">
            <p className="text-6xl font-bold text-sage-800 mb-2">{stats.this_week}</p>
            <p className="text-sage-600 font-medium">completions this week</p>
          </div>

          {/* This Month */}
          <div className="bg-white rounded-3xl p-8 shadow-soft border border-sage-200 hover:shadow-soft-lg transition text-center">
            <p className="text-6xl font-bold text-sage-800 mb-2">{stats.this_month}</p>
            <p className="text-sage-600 font-medium">completions this month</p>
          </div>

          {/* Best Streak */}
          <div className="bg-white rounded-3xl p-8 shadow-soft border border-sage-200 hover:shadow-soft-lg transition text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <p className="text-6xl font-bold text-sage-800">{stats.best_streak}</p>
              <Flame className="text-coral-500" size={32} />
            </div>
            <p className="text-sage-600 font-medium">day best streak</p>
          </div>
        </div>

        {/* Achievements */}
        <div className="bg-white rounded-3xl p-8 shadow-soft border border-sage-200">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-coral-100 rounded-2xl flex items-center justify-center">
              <Sparkles className="text-coral-600" size={24} />
            </div>
            <h2 className="text-2xl font-semibold text-sage-800">Achievements</h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {badges.map((badge) => (
              <div
                key={badge.id}
                className={`p-6 rounded-2xl text-center transition-all ${
                  badge.earned
                    ? 'gradient-coral border-2 border-coral-300 shadow-soft'
                    : 'bg-sage-50 border-2 border-sage-200 opacity-50'
                }`}
              >
                <div className="text-4xl mb-3">{badge.icon}</div>
                <p className="text-sm font-semibold text-sage-800 mb-2">{badge.name}</p>
                {badge.earned && (
                  <span className="inline-block bg-mint-100 text-mint-700 text-xs font-bold px-3 py-1 rounded-full">
                    ✓ Earned
                  </span>
                )}
                {!badge.earned && (
                  <span className="text-xs text-sage-500">Locked</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
