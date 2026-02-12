import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { habitService, HabitWithTracking, HabitCategory, CreateHabitData, TrackingType } from '../services/habitService'
import { challengeService } from '../services/challengeService'
import { NotificationService } from '../services/notificationService'
import { HabitTimer } from '../components/HabitTimer'
import { HabitCounter } from '../components/HabitCounter'
import { ChallengesSection } from '../components/ChallengesSection'
import { ChallengeStatistics } from '../components/ChallengeStatistics'
import { 
  CheckCircle2, Circle, Plus, Trash2, TrendingUp, Award, 
  Target, Hash, Flame, X, BookOpen, Heart, Moon, Star, Sparkles, Lightbulb, Timer, BarChart3, 
  Activity, Trophy, Calendar, Grid3X3
} from 'lucide-react'

const HabitTracker = () => {
  const getLocalDate = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // Check if selected date is today (use existing function from line 405)
  
  // Check if date is in the past (function is defined below at line 414)

  const [selectedDate, setSelectedDate] = useState(getLocalDate())
  const [showAddModal, setShowAddModal] = useState(false)
  const [showAchievements, setShowAchievements] = useState(false)
  const [showTrackingModal, setShowTrackingModal] = useState(false)
  const [showInsights, setShowInsights] = useState(false)
  const [showChallengesCart, setShowChallengesCart] = useState(false)
  const [selectedHabit, setSelectedHabit] = useState<HabitWithTracking | null>(null)
  const [viewMode, setViewMode] = useState<'daily' | 'weekly' | 'monthly' | 'statistics'>('daily')
  const [joinedChallenges, setJoinedChallenges] = useState<Map<string, { acceptedDate: string; completionsByDate: Map<string, boolean>; currentStreak: number; name: string }>>(new Map())
  const [acceptedChallenges, setAcceptedChallenges] = useState<Set<string>>(new Set())
  const [allChallenges, setAllChallenges] = useState<Array<{ id: string; name_en: string; description?: string; duration_days: number }>>([])
  const [newHabit, setNewHabit] = useState<CreateHabitData>({
    category_id: 1,
    name: '',
    description: '',
    tracking_type: TrackingType.CHECKBOX,
  })
  const [celebratingHabit, setCelebratingHabit] = useState<number | null>(null)
  const [errorToast, setErrorToast] = useState<string | null>(null)
  const [completedHabits, setCompletedHabits] = useState<Set<number>>(new Set())
  const [completedChallenges, setCompletedChallenges] = useState<Set<string>>(new Set())
  const queryClient = useQueryClient()

  // Available challenges
  const availableChallenges = [
    {
      id: 'prayer-consistency',
      name: '📿 Prayer Consistency',
      description: 'Complete this challenge',
      goalDays: 30,
      icon: '📿',
      color: 'purple'
    },
    {
      id: 'dua-practice',
      name: '🤲 Dua Practice',
      description: 'Daily supplications and prayers',
      goalDays: 30,
      icon: '🤲',
      color: 'indigo'
    },
    {
      id: 'quran-reading',
      name: '📖 Quran Reading',
      description: 'Read daily portions',
      goalDays: 30,
      icon: '📖',
      color: 'blue'
    },
    {
      id: 'fajr-challenge',
      name: '⏰ Fajr Challenge',
      description: 'Wake up for Fajr prayer',
      goalDays: 30,
      icon: '⏰',
      color: 'rose'
    }
  ]

  const handleAcceptChallenge = async (challengeId: string) => {
    try {
      // Call API to join the challenge
      const today = getLocalDate()
      await challengeService.joinChallenge(challengeId, today)
      
      // Update local state
      const newAccepted = new Set(acceptedChallenges)
      newAccepted.add(challengeId)
      setAcceptedChallenges(newAccepted)
      
      // Reload challenges from backend
      const userChallenges = await challengeService.getUserChallenges()
      const challengesMap = new Map<string, { acceptedDate: string; completionsByDate: Map<string, boolean>; currentStreak: number; name: string }>()
      
      userChallenges.forEach(detail => {
        const completionsByDate = new Map<string, boolean>()
        detail.completions.forEach(completion => {
          const completionDateStr = typeof completion.completion_date === 'string' 
            ? completion.completion_date 
            : new Date(completion.completion_date).toISOString().split('T')[0]
          completionsByDate.set(completionDateStr, true)
        })
        
        const acceptedDateStr = typeof detail.progress.accepted_date === 'string'
          ? detail.progress.accepted_date
          : new Date(detail.progress.accepted_date).toISOString().split('T')[0]
        
        challengesMap.set(detail.challenge.id, {
          acceptedDate: acceptedDateStr,
          completionsByDate,
          currentStreak: detail.progress.current_streak || 0,
          name: detail.challenge.name_en,
        })
      })
      
      setJoinedChallenges(challengesMap)
      console.log('Challenge accepted and synced with backend')
    } catch (error) {
      console.error('Failed to accept challenge:', error)
      showErrorToast('Failed to accept challenge')
    }
  }

  const handleCancelChallenge = (challengeId: string) => {
    const newAccepted = new Set(acceptedChallenges)
    newAccepted.delete(challengeId)
    setAcceptedChallenges(newAccepted)
  }

  // Show error toast and auto-hide after 3 seconds
  const showErrorToast = (message: string) => {
    setErrorToast(message)
    setTimeout(() => setErrorToast(null), 3000)
  }

  // Get week dates for weekly view
  const getWeekDates = () => {
    const current = new Date(selectedDate)
    const dayOfWeek = current.getDay()
    const diff = current.getDate() - dayOfWeek
    const sunday = new Date(current.setDate(diff))
    
    const dates = []
    for (let i = 0; i < 7; i++) {
      const date = new Date(sunday)
      date.setDate(sunday.getDate() + i)
      dates.push(date.toISOString().split('T')[0])
    }
    return dates
  }

  // Get month dates for monthly view
  const getMonthDates = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth()
    const lastDay = new Date(year, month + 1, 0)
    const dates = []
    
    for (let day = 1; day <= lastDay.getDate(); day++) {
      dates.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`)
    }
    
    return dates
  }

  const weekDates = getWeekDates()
  const monthDates = getMonthDates()

  const { data: habits, isLoading: habitsLoading } = useQuery({
    queryKey: ['habits', selectedDate],
    queryFn: () => habitService.getHabits(false, selectedDate),
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    staleTime: 0,
  })

  // Fetch weekly data for Insights modal
  const { data: weeklyData } = useQuery({
    queryKey: ['weeklyHabits', weekDates],
    queryFn: () => habitService.getMultipleDateTracking(weekDates),
    enabled: weekDates.length > 0,
  })

  // Fetch monthly data when in monthly view
  const { data: monthlyData } = useQuery({
    queryKey: ['monthlyHabits', monthDates],
    queryFn: () => habitService.getMultipleDateTracking(monthDates),
    enabled: viewMode === 'monthly' && monthDates.length > 0,
  })

  // Handle date click to switch to daily view
  const handleDateClick = (date: string) => {
    setSelectedDate(date)
    setViewMode('daily')
  }

  const { data: categories } = useQuery({
    queryKey: ['habitCategories'],
    queryFn: () => habitService.getCategories(),
  })

  // Debug: Log habits data when it changes
  useEffect(() => {
    if (habits) {
      console.log('[DEBUG] Habits loaded:', habits.map((h: HabitWithTracking) => ({
        id: h.habit.id,
        name: h.habit.name,
        today_tracking: h.today_tracking
      })))
    }
  }, [habits])

  // Update default category when categories load
  useEffect(() => {
    if (categories && categories.length > 0 && !newHabit.category_id) {
      setNewHabit({ ...newHabit, category_id: categories[0].id })
    }
  }, [categories])

  // Load user's challenge progress from backend on component mount
  useEffect(() => {
    const loadUserChallenges = async () => {
      try {
        console.log('Loading user challenges...')
        const userChallenges = await challengeService.getUserChallenges()
        console.log('User challenges API response:', userChallenges)
        
        const challengesMap = new Map<string, { acceptedDate: string; completionsByDate: Map<string, boolean>; currentStreak: number }>()
        
        userChallenges.forEach(detail => {
          const completionsByDate = new Map<string, boolean>()
          detail.completions.forEach(completion => {
            // Ensure completion_date is a string
            const completionDateStr = typeof completion.completion_date === 'string' 
              ? completion.completion_date 
              : new Date(completion.completion_date).toISOString().split('T')[0]
            completionsByDate.set(completionDateStr, true)
          })
          
          // Ensure accepted_date is a string
          const acceptedDateStr = typeof detail.progress.accepted_date === 'string'
            ? detail.progress.accepted_date
            : new Date(detail.progress.accepted_date).toISOString().split('T')[0]
          
          challengesMap.set(detail.challenge.id, {
            acceptedDate: acceptedDateStr,
            completionsByDate,
            currentStreak: detail.progress.current_streak || 0,
            name: detail.challenge.name_en,
          })
          
          console.log(`Challenge ${detail.challenge.id}: accepted=${acceptedDateStr}, streak=${detail.progress.current_streak}`)
        })
        
        console.log('Final challenges map:', challengesMap)
        setJoinedChallenges(challengesMap)
        
        // Populate acceptedChallenges from loaded data so they show up when page loads
        const acceptedIds = new Set(challengesMap.keys())
        setAcceptedChallenges(acceptedIds)
        console.log('Accepted challenges loaded from backend:', acceptedIds)
        
        // Fetch all available challenges for the modal
        const allAvailableChallenges = await challengeService.getChallenges()
        setAllChallenges(allAvailableChallenges)
        console.log('All available challenges:', allAvailableChallenges)
      } catch (error) {
        console.error('Failed to load user challenges - Full error:', error)
        let errorMessage = 'Unknown error'
        if (error instanceof Error) {
          errorMessage = error.message
        } else if (typeof error === 'object' && error !== null && 'response' in error) {
          const axiosError = error as any
          if (axiosError.response?.status === 401) {
            errorMessage = 'Unauthorized - please log in again'
          } else if (axiosError.response?.status === 404) {
            errorMessage = 'Challenges endpoint not found (404)'
          } else if (axiosError.response?.data?.detail) {
            errorMessage = axiosError.response.data.detail
          } else {
            errorMessage = `Server error: ${axiosError.response?.status || 'Unknown'}`
          }
        }
        console.error(`Error details: ${errorMessage}`)
        console.log('Check if backend is running at http://localhost:8000')
      }
    }
    
    // Add a small delay to ensure auth is ready
    const timer = setTimeout(loadUserChallenges, 500)
    return () => clearTimeout(timer)
  }, [queryClient])

  // Request notification permission on component mount
  useEffect(() => {
    NotificationService.requestPermission()
  }, [])

  const { data: statistics } = useQuery({
    queryKey: ['habitStatistics'],
    queryFn: () => habitService.getStatistics(),
  })

  const { data: dailySummary } = useQuery({
    queryKey: ['dailySummary', selectedDate],
    queryFn: () => habitService.getDailySummary(selectedDate),
  })

  
  const createHabitMutation = useMutation({
    mutationFn: (data: CreateHabitData) => habitService.createHabit(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['habits'] })
      queryClient.invalidateQueries({ queryKey: ['habitStatistics'] })
      queryClient.invalidateQueries({ queryKey: ['dailySummary'] })
      setShowAddModal(false)
      setNewHabit({ category_id: 1, name: '', description: '', tracking_type: TrackingType.CHECKBOX })
    },
  })

  const updateTrackingMutation = useMutation({
    mutationFn: ({ habitId, date, data }: any) => 
      habitService.updateTracking(habitId, date, data),
    onSuccess: async (result, variables) => {
      console.log('✅ Tracking updated successfully:', result)
      
      // Manually update the cache for immediate UI feedback
      const currentData = queryClient.getQueryData(['habits', variables.date]) as HabitWithTracking[]
      if (currentData) {
        const updatedData = currentData.map((item: HabitWithTracking) => {
          if (item.habit.id === variables.habitId) {
            return {
              ...item,
              today_tracking: {
                id: result.id,
                user_id: result.user_id,
                habit_id: result.habit_id,
                tracking_date: result.tracking_date,
                is_completed: result.is_completed, // Use actual status from API
                counter_value: result.counter_value,
                timer_seconds: result.timer_seconds,
                notes: result.notes,
                created_at: result.created_at,
                updated_at: result.updated_at
              }
            }
          }
          return item
        })
        queryClient.setQueryData(['habits', variables.date], updatedData)
        console.log('🔄 Cache updated with completed=true for habit', variables.habitId)
      }
      
      // Wait a bit then force refetch to ensure consistency
      await new Promise(resolve => setTimeout(resolve, 300))
      await queryClient.refetchQueries({ queryKey: ['habits', variables.date], exact: true })
      queryClient.invalidateQueries({ queryKey: ['dailySummary'] })
      queryClient.invalidateQueries({ queryKey: ['habitStatistics'] })
    },
    onError: (error: any) => {
      console.error('❌ Error updating tracking:', error)
      alert(`Failed to update habit: ${error?.response?.data?.detail || error?.message || 'Unknown error'}`)
    }
  })

  const deleteHabitMutation = useMutation({
    mutationFn: (habitId: number) => habitService.deleteHabit(habitId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['habits'] })
      queryClient.invalidateQueries({ queryKey: ['habitStatistics'] })
      queryClient.invalidateQueries({ queryKey: ['dailySummary'] })
    },
  })

  const joinChallengeMutation = useMutation({
    mutationFn: (data: { challengeId: string; acceptedDate: string }) =>
      challengeService.joinChallenge(data.challengeId, data.acceptedDate),
    onSuccess: async () => {
      try {
        // Reload challenges from backend
        const userChallenges = await challengeService.getUserChallenges()
        const challengesMap = new Map<string, { acceptedDate: string; completionsByDate: Map<string, boolean>; currentStreak: number }>()
        
        userChallenges.forEach(detail => {
          const completionsByDate = new Map<string, boolean>()
          detail.completions.forEach(completion => {
            completionsByDate.set(completion.completion_date, true)
          })
          
          challengesMap.set(detail.challenge.id, {
            acceptedDate: detail.progress.accepted_date,
            completionsByDate,
            currentStreak: detail.progress.current_streak || 0,
          })
        })
        
        setJoinedChallenges(challengesMap)
      } catch (error) {
        console.error('Failed to reload challenges after join:', error)
      }
    },
    onError: (error) => {
      console.error('Error joining challenge:', error)
    }
  })

  const toggleChallengeCompletionMutation = useMutation({
    mutationFn: (data: { challengeId: string; completionDate: string }) =>
      challengeService.toggleChallengeCompletion(data.challengeId, data.completionDate),
    onSuccess: async () => {
      try {
        // Reload challenges from backend
        const userChallenges = await challengeService.getUserChallenges()
        const challengesMap = new Map<string, { acceptedDate: string; completionsByDate: Map<string, boolean>; currentStreak: number }>()
        
        userChallenges.forEach(detail => {
          const completionsByDate = new Map<string, boolean>()
          detail.completions.forEach(completion => {
            completionsByDate.set(completion.completion_date, true)
          })
          
          challengesMap.set(detail.challenge.id, {
            acceptedDate: detail.progress.accepted_date,
            completionsByDate,
            currentStreak: detail.progress.current_streak || 0,
          })
        })
        
        setJoinedChallenges(challengesMap)
      } catch (error) {
        console.error('Failed to reload challenges after toggle:', error)
      }
    },
    onError: (error) => {
      console.error('Error toggling challenge completion:', error)
    }
  })

  const handleToggleHabit = (habitId: number, currentStatus: boolean) => {
    // Can ONLY tick/untick for TODAY - not past, not future
    if (selectedDate !== getLocalDate()) {
      showErrorToast('Can only complete habits for today')
      return
    }
    
    // Toggle the habit - if completed, uncomplete it, if not completed, complete it
    const newStatus = !currentStatus
    
    if (newStatus) {
      // Adding to completed - update local state
      setCompletedHabits(prev => new Set(prev).add(habitId))
    } else {
      // Removing from completed - update local state
      setCompletedHabits(prev => {
        const newSet = new Set(prev)
        newSet.delete(habitId)
        return newSet
      })
    }
    
    updateTrackingMutation.mutate({
      habitId,
      date: selectedDate,
      data: { is_completed: newStatus },
    })
  }

  const handleCreateHabit = () => {
    if (newHabit.name.trim()) {
      createHabitMutation.mutate(newHabit)
    }
  }

  const handleJoinChallenge = (challengeId: string, _challengeName: string) => {
    const today = getLocalDate()
    
    // Save to backend
    joinChallengeMutation.mutate({
      challengeId,
      acceptedDate: today,
    })
    
    // Update local state immediately for UI feedback
    setJoinedChallenges(prev => {
      const updated = new Map(prev)
      const completionsByDate = new Map<string, boolean>()
      updated.set(challengeId, { acceptedDate: today, completionsByDate, currentStreak: 0 })
      return updated
    })
  }

  const handleToggleChallengeComplete = (challengeId: string) => {
    // Only allow completing challenges for today
    if (!isDateToday(selectedDate)) {
      alert('You can only complete challenges for today')
      return
    }
    
    // Save to backend
    toggleChallengeCompletionMutation.mutate({
      challengeId,
      completionDate: selectedDate,
    })
    
    // Update local state immediately for UI feedback
    setJoinedChallenges(prev => {
      const updated = new Map(prev)
      const currentChallenge = updated.get(challengeId)
      if (currentChallenge) {
        const completionsByDate = new Map(currentChallenge.completionsByDate)
        const currentStatus = completionsByDate.get(selectedDate) || false
        completionsByDate.set(selectedDate, !currentStatus)
        updated.set(challengeId, { ...currentChallenge, completionsByDate })
      }
      return updated
    })
  }

  const isChallengeActiveOnDate = (acceptedDate: string, date: string): boolean => {
    return date >= acceptedDate
  }

  const isChallengeCompletedOnDate = (completionsByDate: Map<string, boolean>, date: string): boolean => {
    return completionsByDate.get(date) || false
  }

  const getTodayDate = (): string => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const isDateToday = (date: string): boolean => {
    return date === getTodayDate()
  }

  const getCategoryIcon = (categoryId: number) => {
    const icons: { [key: number]: any } = {
      1: BookOpen,
      2: Heart,
      3: Moon,
      4: Star,
    }
    return icons[categoryId] || Sparkles
  }

  // Calculate unlocked achievements
  const achievements = [
    { name: 'First Step', desc: 'Complete your first habit', icon: '🌱', unlocked: (habits?.length || 0) > 0 },
    { name: '3-Day Streak', desc: 'Maintain a 3-day streak', icon: '🔥', unlocked: habits?.some(h => (h.streak?.current_streak || 0) >= 3) },
    { name: 'Week Warrior', desc: 'Maintain a 7-day streak', icon: '⚡', unlocked: habits?.some(h => (h.streak?.current_streak || 0) >= 7) },
    { name: 'Consistency King', desc: 'Maintain a 30-day streak', icon: '👑', unlocked: habits?.some(h => (h.streak?.current_streak || 0) >= 30) },
    { name: 'Habit Builder', desc: 'Create 5 different habits', icon: '🏗️', unlocked: (statistics?.total_habits_created || 0) >= 5 },
    { name: 'Perfect Day', desc: 'Complete all habits in one day', icon: '✨', unlocked: (dailySummary?.completion_rate || 0) === 100 && (dailySummary?.total_habits || 0) > 0 },
    
    // Monthly achievements
    { name: 'Monthly Master', desc: 'Complete all habits for a full month', icon: '📅', unlocked: false }, // TODO: Implement monthly tracking
    { name: 'Early Bird', desc: 'Complete habits before 8 AM for 7 days', icon: '🌅', unlocked: false }, // TODO: Track completion time
    { name: 'Night Owl', desc: 'Complete habits after 10 PM for 7 days', icon: '🦉', unlocked: false }, // TODO: Track completion time
    
    // Category-specific achievements
    { name: 'Worship Warrior', desc: 'Complete all worship habits for 7 days', icon: '🕌', unlocked: false }, // TODO: Category tracking
    { name: 'Knowledge Seeker', desc: 'Complete all knowledge habits for 7 days', icon: '📚', unlocked: false },
    { name: 'Health Hero', desc: 'Complete all health habits for 7 days', icon: '💪', unlocked: false },
    { name: 'Character Champion', desc: 'Complete all character habits for 7 days', icon: '🌟', unlocked: false },
    
    // Milestone achievements
    { name: 'Habit Master', desc: 'Create 10 different habits', icon: '🎯', unlocked: (statistics?.total_habits_created || 0) >= 10 },
    { name: 'Streak Master', desc: 'Achieve 100-day streak', icon: '💎', unlocked: habits?.some(h => (h.streak?.current_streak || 0) >= 100) },
    { name: 'Perfectionist', desc: '30 days of 100% completion', icon: '🏆', unlocked: false }, // TODO: Track perfect days
    
    // Special achievements
    { name: 'Ramadan Champion', desc: 'Complete all habits during Ramadan', icon: '🌙', unlocked: false }, // TODO: Ramadan tracking
    { name: 'Weekend Warrior', desc: 'Complete all habits on weekends for 4 weeks', icon: '🎉', unlocked: false },
    { name: 'Consistency Queen', desc: 'Maintain 90% completion rate for 30 days', icon: '👸', unlocked: false },
  ]
  
  const unlockedAchievementsCount = achievements.filter(a => a.unlocked).length

  if (habitsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">Loading habits...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-sky-50 p-6 relative">
      {/* Error Toast Notification */}
      {errorToast && (
        <div className="fixed top-24 left-1/2 transform -translate-x-1/2 z-50 animate-bounce">
          <div className="bg-coral-500 text-white px-6 py-4 rounded-2xl shadow-soft-lg flex items-center gap-3">
            <span className="text-xl">⚠️</span>
            <span className="font-semibold">{errorToast}</span>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto space-y-6">
        {/* Main Header - Soft Sage Design */}
        <div className="bg-sky-50 rounded-3xl p-6 shadow-soft border border-amber-600">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-sage-800">
              Habit Tracker
            </h1>
            <p className="text-sm text-sage-600 mt-1">
              Build consistent Islamic habits
            </p>
          </div>
          
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setShowInsights(true)}
              className="bg-gradient-to-r from-amber-500 to-amber-600 text-white px-5 py-3 rounded-2xl font-semibold shadow-amber-400 hover:shadow-amber-500 transition-all duration-300 flex items-center gap-2 hover:scale-105 hover:from-amber-600 hover:to-amber-700"
            >
              <BarChart3 className="w-5 h-5" />
              Insights
            </button>
            <button
              onClick={() => setShowChallengesCart(true)}
              className="bg-gradient-to-r from-purple-500 to-purple-600 text-white px-5 py-3 rounded-2xl font-semibold shadow-purple-400 hover:shadow-purple-500 transition-all duration-300 flex items-center gap-2 hover:scale-105 hover:from-purple-600 hover:to-purple-700"
            >
              <Target className="w-5 h-5" />
              Challenges
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white px-5 py-3 rounded-2xl font-semibold shadow-emerald-400 hover:shadow-emerald-500 transition-all duration-300 flex items-center gap-2 hover:scale-105 hover:from-emerald-600 hover:to-emerald-700"
            >
              <Plus className="w-5 h-5" />
              Add Habit
            </button>
          </div>
        </div>

        {/* View Mode Toggle & Date Selector */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="flex bg-white rounded-lg p-1 shadow border border-gray-200">
            <button
              onClick={() => setViewMode('daily')}
              className={`px-4 py-2 rounded font-medium text-sm transition-all ${
                viewMode === 'daily'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Daily
            </button>
            <button
              onClick={() => setViewMode('weekly')}
              className={`px-4 py-2 rounded font-medium text-sm transition-all ${
                viewMode === 'weekly'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Weekly
            </button>
            <button
              onClick={() => setViewMode('monthly')}
              className={`px-4 py-2 rounded font-medium text-sm transition-all ${
                viewMode === 'monthly'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setViewMode('statistics')}
              className={`px-4 py-2 rounded font-medium text-sm transition-all ${
                viewMode === 'statistics'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Statistics
            </button>
          </div>
          
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 font-medium focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-5 shadow border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Total Habits</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {habits?.length || 0}
              </p>
            </div>
            <div className="bg-blue-50 p-3 rounded-lg">
              <Target className="w-8 h-8 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-5 shadow border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Completed Today</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {habits?.filter(h => h.today_tracking?.is_completed).length || 0}/{habits?.length || 0}
              </p>
            </div>
            <div className="bg-green-50 p-3 rounded-lg">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-5 shadow border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Completion Rate</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {habits && habits.length > 0 ? Math.round((habits?.filter(h => h.today_tracking?.is_completed).length || 0) / habits.length * 100) : 0}%
              </p>
            </div>
            <div className="bg-orange-50 p-3 rounded-lg">
              <TrendingUp className="w-8 h-8 text-orange-600" />
            </div>
          </div>
        </div>

        <div 
          onClick={() => setShowAchievements(true)}
          className="bg-white rounded-lg p-5 shadow border border-gray-200 cursor-pointer hover:shadow-md hover:border-gray-300 transition-all"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Achievements</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {unlockedAchievementsCount}
              </p>
            </div>
            <div className="bg-yellow-50 p-3 rounded-lg">
              <Award className="w-8 h-8 text-yellow-600" />
            </div>
          </div>
        </div>
      </div>
      </div>

      {/* Habits View - Daily/Weekly/Monthly */}
      {viewMode === 'daily' && (
        <div className="space-y-4">
          {/* Active Challenges Section */}
          {acceptedChallenges.size > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-gray-900">
                Active Challenges
              </h3>
              {Array.from(acceptedChallenges).map((challengeId) => {
                const joinedChallenge = joinedChallenges.get(challengeId)
                if (!joinedChallenge) return null

                const completedKey = `challenge-${challengeId}-${selectedDate}`
                const isCompleted = completedChallenges.has(completedKey) || localStorage.getItem(completedKey) === 'true'

                return (
                  <div
                    key={challengeId}
                    className="bg-white rounded-lg p-4 shadow border border-gray-200 hover:border-gray-300 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <Trophy className={`w-5 h-5 flex-shrink-0 ${isCompleted ? 'text-green-600' : 'text-gray-400'}`} />
                        <div>
                          <h4 className="font-semibold text-gray-900">
                            {joinedChallenge.name}
                          </h4>
                          <p className="text-xs text-gray-600 mt-1">30 days challenge</p>
                        </div>
                      </div>

                      {/* Buttons Group */}
                      <div className="flex items-center gap-2">
                        {/* Complete Button */}
                        <button
                          onClick={() => {
                            const completedKey = `challenge-${challengeId}-${selectedDate}`
                            if (isCompleted) {
                              localStorage.removeItem(completedKey)
                              setCompletedChallenges(prev => {
                                const newSet = new Set(prev)
                                newSet.delete(completedKey)
                                return newSet
                              })
                            } else {
                              localStorage.setItem(completedKey, 'true')
                              setCompletedChallenges(prev => new Set(prev).add(completedKey))
                            }
                          }}
                          disabled={!isDateToday(selectedDate)}
                          className={`p-2 rounded-lg transition-all border ${
                            !isDateToday(selectedDate)
                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50'
                              : isCompleted
                              ? 'bg-green-100 text-green-600 border-green-300'
                              : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200'
                          }`}
                          title={!isDateToday(selectedDate) ? 'You can only complete challenges for today' : 'Mark as complete'}
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="w-5 h-5" />
                          ) : (
                            <Circle className="w-5 h-5" />
                          )}
                        </button>

                        {/* Remove Button */}
                        <button
                          onClick={() => handleCancelChallenge(challengeId)}
                          className="p-2 rounded-lg transition-all bg-red-50 text-red-600 border border-red-200 hover:bg-red-100"
                          title="Remove this challenge"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Today's Habits */}
          <div className="pt-2">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Today's Habits</h3>
          </div>

          {habits && habits.length > 0 ? (
            habits.map((item: HabitWithTracking) => {
              const CategoryIcon = getCategoryIcon(item.habit.category_id)
              const isCompleted = item.today_tracking?.is_completed || false
              const currentStreak = item.streak?.current_streak || 0
              const isJustCompleted = completedHabits.has(item.habit.id)
              const finalIsCompleted = isCompleted || isJustCompleted

              return (
                <div
                  key={item.habit.id}
                  className="bg-white rounded-lg p-4 shadow border border-gray-200 hover:border-gray-300 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <CategoryIcon className={`w-5 h-5 flex-shrink-0 ${finalIsCompleted ? 'text-green-600' : 'text-gray-400'}`} />
                      <div>
                        <h4 className="font-semibold text-gray-900">
                          {item.habit.name}
                        </h4>
                        {item.habit.description && (
                          <p className="text-xs text-gray-600 mt-0.5">{item.habit.description}</p>
                        )}
                        {currentStreak > 0 && (
                          <div className="flex items-center gap-2 mt-2">
                            <div className="bg-orange-50 text-orange-700 px-2 py-1 rounded text-xs font-semibold flex items-center gap-1">
                              <Flame className="w-3 h-3" />
                              {currentStreak} day streak
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Complete Button */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          if (selectedDate !== getLocalDate()) return
                          handleToggleHabit(item.habit.id, finalIsCompleted)
                        }}
                        disabled={selectedDate !== getLocalDate()}
                        className={`p-2 rounded-lg transition-all border ${
                          selectedDate !== getLocalDate()
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50 border-gray-200'
                          : finalIsCompleted
                          ? 'bg-green-100 text-green-600 border-green-300'
                          : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200'
                        }`}
                        title={
                          selectedDate !== getLocalDate()
                            ? 'Can only complete habits for today' 
                            : finalIsCompleted 
                            ? 'Completed for today!' 
                            : 'Complete this habit'
                        }
                      >
                        {finalIsCompleted ? (
                          <CheckCircle2 className="w-5 h-5" />
                        ) : (
                          <Circle className="w-5 h-5" />
                        )}
                      </button>
                      
                      {/* Delete Button */}
                      <button
                        onClick={() => {
                          if (window.confirm(`Delete habit "${item.habit.name}"? This cannot be undone.`)) {
                            deleteHabitMutation.mutate(item.habit.id)
                          }
                        }}
                        className="p-2 rounded-lg bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-all"
                        title="Delete habit"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })
          ) : (
            <div className="bg-gray-50 rounded-lg p-8 text-center border border-gray-200">
              <Sparkles className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-700 font-medium">
                {Array.from(joinedChallenges.entries()).some(([, data]) => isChallengeActiveOnDate(data.acceptedDate, selectedDate))
                  ? "No habits yet. Create your first habit to get started!"
                  : "No habits yet. Create your first habit to get started!"}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Weekly View */}
      {viewMode === 'weekly' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Weekly Tracker
          </h3>
          <div className="bg-white rounded-lg p-6 shadow border border-gray-200">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left p-3 text-gray-900 font-semibold">Habit</th>
                    {weekDates.map((date) => {
                      const d = new Date(date)
                      const isToday = date === getLocalDate()
                      return (
                        <th key={date} className={`p-3 text-center font-semibold ${isToday ? 'bg-blue-50 text-blue-900' : 'text-gray-700'}`}>
                          <div className="text-xs">{d.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                          <div className="text-base font-bold">{d.getDate()}</div>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {habits && habits.map((item: HabitWithTracking) => (
                    <tr key={item.habit.id} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="p-3 font-medium text-gray-900">{item.habit.name}</td>
                      {weekDates.map((date) => {
                        const dateHabits = weeklyData?.[date] || []
                        const habitForDate = dateHabits.find(h => h.habit.id === item.habit.id)
                        const isCompleted = habitForDate?.today_tracking?.is_completed || false
                        const isToday = date === getLocalDate()
                        
                        return (
                          <td key={date} className={`p-3 text-center ${isToday ? 'bg-blue-50' : ''}`}>
                            <div className={`w-8 h-8 mx-auto rounded flex items-center justify-center font-bold border ${
                              isCompleted 
                                ? 'bg-green-100 text-green-700 border-green-300' 
                                : 'bg-gray-100 text-gray-600 border-gray-300'
                            }`}>
                              {isCompleted ? '✓' : '○'}
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-600 mt-4 text-center">
              ✓ = Completed  |  ○ = Not Completed
            </p>
          </div>
        </div>
      )}

      {/* Monthly View */}
      {viewMode === 'monthly' && (
        <div className="bg-white rounded-lg p-6 shadow border border-gray-200">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6 text-center">
            {new Date(selectedDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </h2>
          <div className="grid grid-cols-7 gap-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="text-center text-xs font-semibold text-white p-2 bg-gray-800 rounded-t">
                {day}
              </div>
            ))}
            {monthDates.map((date) => {
              const d = new Date(date)
              const isToday = date === getLocalDate()
              const dateHabits = monthlyData?.[date] || []
              const completedCount = dateHabits.filter(h => h.today_tracking?.is_completed).length
              const totalHabits = dateHabits.length
              const completionRate = totalHabits > 0 ? (completedCount / totalHabits) * 100 : 0
              
              // Determine background color based on completion rate
              let bgColor = 'bg-gray-50 border border-gray-200'
              if (isToday) {
                bgColor = 'bg-blue-100 border-2 border-blue-500'
              } else if (completionRate >= 100) {
                bgColor = 'bg-green-50 border border-green-300'
              } else if (completionRate > 0) {
                bgColor = 'bg-orange-50 border border-orange-300'
              }
              
              return (
                <div
                  key={date}
                  onClick={() => handleDateClick(date)}
                  className={`aspect-square p-2 rounded cursor-pointer hover:shadow-md transition-all duration-200 ${bgColor}`}
                  title={`${completedCount}/${totalHabits} habits completed (${Math.round(completionRate)}%)`}
                >
                  <div className="text-sm font-semibold text-gray-900">{d.getDate()}</div>
                  <div className="text-xs text-gray-700 mt-1">
                    {completedCount}/{totalHabits}
                  </div>
                  {totalHabits > 0 && (
                    <div className="mt-1">
                      <div className="w-full bg-gray-200 rounded-full h-1">
                        <div 
                          className={`h-1 rounded-full ${
                            completionRate >= 100 ? 'bg-green-600' :
                            completionRate >= 50 ? 'bg-orange-500' :
                            completionRate > 0 ? 'bg-orange-400' : 'bg-gray-400'
                          }`}
                          style={{ width: `${completionRate}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center justify-center gap-6 text-xs text-gray-700 font-medium flex-wrap">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-600 rounded-full"></div>
                <span>Complete</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-orange-400 rounded-full"></div>
                <span>Partial</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                <span>Incomplete</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Statistics View */}
      {viewMode === 'statistics' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Statistics & Analytics
          </h3>
          <div className="bg-white rounded-lg p-6 shadow border-2 border-amber-500">
            <ChallengeStatistics />
          </div>
        </div>
      )}

      {/* Add Habit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold text-gray-900">
                Add New Habit
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Habit Name
                </label>
                <input
                  type="text"
                  value={newHabit.name}
                  onChange={(e) => setNewHabit({ ...newHabit, name: e.target.value })}
                  placeholder="e.g., Read Quran"
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors placeholder-gray-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  value={newHabit.description}
                  onChange={(e) => setNewHabit({ ...newHabit, description: e.target.value })}
                  placeholder="Add details about your habit..."
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors placeholder-gray-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <select
                  value={newHabit.category_id}
                  onChange={(e) => setNewHabit({ ...newHabit, category_id: parseInt(e.target.value) })}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                >
                  {categories?.map((cat: HabitCategory) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name_en}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 mt-6 pt-2">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateHabit}
                  disabled={!newHabit.name.trim()}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Create Habit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      
      {/* Tracking Modal */}
      {showTrackingModal && selectedHabit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-soft-lg border border-sage-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-sage-800">
                {selectedHabit.habit.name}
              </h2>
              <button
                onClick={() => setShowTrackingModal(false)}
                className="p-2 hover:bg-sage-100 rounded-full transition-colors"
              >
                <X className="w-6 h-6 text-sage-600" />
              </button>
            </div>

            {selectedHabit.habit.tracking_type === 'timer' && (
              <HabitTimer
                targetValue={selectedHabit.habit.target_value || 15}
                unit={selectedHabit.habit.unit || 'minutes'}
                onComplete={(_seconds) => {
                  handleToggleHabit(selectedHabit.habit.id, false)
                  setShowTrackingModal(false)
                }}
              />
            )}

            {selectedHabit.habit.tracking_type === 'timer' && (
              <HabitTimer
                targetValue={selectedHabit.habit.target_value || 15}
                unit={selectedHabit.habit.unit || 'minutes'}
                onComplete={(_seconds) => {
                  handleToggleHabit(selectedHabit.habit.id, false)
                  setShowTrackingModal(false)
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* Insights Modal */}
      {showInsights && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-4xl w-full shadow-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold text-gray-900">
                Habit Insights & Analytics
              </h2>
              <button
                onClick={() => setShowInsights(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-6">
              {/* Weekly Performance */}
              <div className="border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Weekly Performance
                </h3>
                <div className="space-y-2">
                  {weekDates && weekDates.length > 0 ? (
                    weekDates.slice(0, 7).map((date) => {
                      const dateHabits = weeklyData && weeklyData[date] ? weeklyData[date] : []
                      const completedCount = dateHabits.filter(h => h?.today_tracking?.is_completed).length
                      const totalHabits = dateHabits.length
                      const percentage = totalHabits > 0 ? (completedCount / totalHabits) * 100 : 0
                      
                      return (
                        <div key={date} className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            <span className="text-sm font-medium text-gray-700 w-12">
                              {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' })}
                            </span>
                            <div className="flex-1 bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                          <span className="text-sm font-medium text-gray-700 ml-3">
                            {Math.round(percentage)}%
                          </span>
                        </div>
                      )
                    })
                  ) : (
                    <p className="text-gray-500 text-sm">Loading weekly data...</p>
                  )}
                </div>
              </div>

              {/* Habit Categories */}
              <div className="border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Habit Categories
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {categories?.map((category) => {
                    const categoryHabits = habits?.filter(h => h.habit.category_id === category.id) || []
                    const completedCount = categoryHabits.filter(h => h.today_tracking?.is_completed).length
                    const percentage = categoryHabits.length > 0 ? (completedCount / categoryHabits.length) * 100 : 0
                    
                    return (
                      <div key={category.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: category.color }}></div>
                          <h4 className="text-sm font-medium text-gray-900">{category.name_en}</h4>
                        </div>
                        <div className="flex items-baseline justify-between">
                          <span className="text-xs text-gray-600">{completedCount}/{categoryHabits.length}</span>
                          <span className="text-sm font-semibold text-gray-900">{Math.round(percentage)}%</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Insights & Tips */}
              <div className="border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Insights & Recommendations
                </h3>
                <div className="space-y-3">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 text-sm mb-1">
                      Best Streak: {Math.max(...(habits?.map(h => h.streak?.current_streak || 0) || [0]))} days
                    </h4>
                    <p className="text-xs text-gray-600">
                      Keep up the consistency! Your progress is building strong habit patterns.
                    </p>
                  </div>
                  
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 text-sm mb-1">
                      Today's Progress
                    </h4>
                    <p className="text-xs text-gray-600">
                      {(habits?.filter(h => h.today_tracking?.is_completed).length ?? 0) > 0 
                        ? `You've completed ${habits?.filter(h => h.today_tracking?.is_completed).length ?? 0} habits today.`
                        : "Start with your easiest habit to build momentum."}
                    </p>
                  </div>
                  
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 text-sm mb-1">
                      Completion Rate: {dailySummary?.completion_rate ?? 0}%
                    </h4>
                    <p className="text-xs text-gray-600">
                      {(dailySummary?.completion_rate ?? 0) >= 80 
                        ? "Excellent consistency! You're maintaining great habits."
                        : (dailySummary?.completion_rate ?? 0) >= 60 
                        ? "Good progress! Keep building your routine."
                        : "Every day is a new opportunity to improve."}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Challenges Cart Modal */}
      {showChallengesCart && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-2xl w-full shadow-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold text-gray-900">
                Available Challenges
              </h2>
              <button
                onClick={() => setShowChallengesCart(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-3">
              {allChallenges && allChallenges.length > 0 ? (
                allChallenges.map((challenge) => {
                  const isAccepted = acceptedChallenges.has(challenge.id)

                  return (
                    <div 
                      key={challenge.id} 
                      className={`rounded-lg p-4 border flex items-start justify-between transition-colors ${
                        isAccepted 
                          ? 'bg-green-50 border-green-200' 
                          : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex-1 pr-4">
                        <h3 className="font-semibold text-gray-900">{challenge.name_en}</h3>
                        {challenge.description && (
                          <p className="text-sm text-gray-600 mt-1">{challenge.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <span className="inline-block text-xs font-medium text-gray-600 bg-white px-2 py-1 rounded border border-gray-300">
                            {challenge.duration_days} days
                          </span>
                          {isAccepted && (
                            <span className="inline-block text-xs font-medium text-white bg-green-600 px-2 py-1 rounded">
                              Accepted
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        {isAccepted ? (
                          <button
                            onClick={() => handleCancelChallenge(challenge.id)}
                            className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors whitespace-nowrap"
                          >
                            Remove
                          </button>
                        ) : (
                          <button
                            onClick={() => handleAcceptChallenge(challenge.id)}
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
                          >
                            Accept
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="p-6 text-center text-gray-500">
                  <p>Loading challenges...</p>
                </div>
              )}
            </div>

            <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="text-sm text-gray-600 text-center">
                {acceptedChallenges.size} of {allChallenges?.length || 0} challenges accepted
              </p>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default HabitTracker
