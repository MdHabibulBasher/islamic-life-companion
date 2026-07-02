import React, { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart3, TrendingUp, Calendar, Award, Zap, Target, Download,
  Flame, Sparkles, BookOpen, CheckCircle2, AlertCircle, Loader2,
} from 'lucide-react'
import { GoldDivider } from '../components/IslamicOrnamentBG'
import { dashboardService, type DashboardData } from '../services/dashboardService'
import { prayerTrackingService, type PrayerStatistics, type AllStreaksResponse } from '../services/prayerTrackingService'
import { habitService, type UserHabit } from '../services/habitService'
import { challengeService, type UserChallengeDetailed } from '../services/challengeService'

/* ============================================================================
 *  Analytics — deep-emerald edition (real data from database)
 * ----------------------------------------------------------------------------
 *  Pulls from:
 *   • Dashboard aggregation (habits, challenges, quran, achievements)
 *   • Prayer tracking statistics + streaks
 *   • Habit statistics + per-habit tracking
 *   • Challenge progress + statistics
 * ========================================================================= */

export const Analytics: React.FC = () => {
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('month')

  // ── Data queries ────────────────────────────────────────────────────
  const { data: dashboard, isLoading: dashLoading } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: () => dashboardService.get(),
  })

  const { data: prayerStats } = useQuery<PrayerStatistics>({
    queryKey: ['prayerStatistics'],
    queryFn: () => prayerTrackingService.getStatistics(),
  })

  const { data: prayerStreaks } = useQuery<AllStreaksResponse>({
    queryKey: ['prayerStreaks'],
    queryFn: () => prayerTrackingService.getStreaks(),
  })

  const { data: habitStats } = useQuery({
    queryKey: ['habitStatistics'],
    queryFn: () => habitService.getStatistics(),
  })

  const { data: habits } = useQuery<UserHabit[]>({
    queryKey: ['habits'],
    queryFn: () => habitService.getHabits(),
  })

  const { data: userChallenges } = useQuery<UserChallengeDetailed[]>({
    queryKey: ['challenges', 'progress'],
    queryFn: () => challengeService.getUserChallenges(),
  })

  const { data: challengeStats } = useQuery({
    queryKey: ['challengeStatistics'],
    queryFn: () => challengeService.getStatistics(),
  })

  // ── Derived data ────────────────────────────────────────────────────
  const last7Days = useMemo(() => {
    const arr = dashboard?.habits?.last_7_days ?? []
    return arr.map((d) => ({
      day: new Date(d.date).toLocaleDateString('en-US', { weekday: 'short' }),
      completed: d.completed_habits,
      total: d.total_habits,
    }))
  }, [dashboard])

  const monthlyData = useMemo(() => {
    // Aggregate last_7_days into 4 weekly buckets if available,
    // otherwise derive from dashboard habits data
    const days = dashboard?.habits?.last_7_days ?? []
    if (days.length === 0) return []
    // Build a simple 4-week approximation from what we have
    const week1 = days.slice(0, 2)
    const week2 = days.slice(2, 4)
    const week3 = days.slice(4, 6)
    const week4 = days.slice(6)
    const bucket = (arr: typeof days) => ({
      week: `Week ${Math.random() > 0.5 ? 1 : 1}`,
      completed: arr.reduce((s, d) => s + d.completed_habits, 0),
      total: arr.reduce((s, d) => s + d.total_habits, 0),
    })
    return [
      { week: 'Week 1', completed: bucket(week1).completed, total: bucket(week1).total || 1 },
      { week: 'Week 2', completed: bucket(week2).completed, total: bucket(week2).total || 1 },
      { week: 'Week 3', completed: bucket(week3).completed, total: bucket(week3).total || 1 },
      { week: 'Week 4', completed: bucket(week4).completed, total: bucket(week4).total || 1 },
    ]
  }, [dashboard])

  // Prayer per-name breakdown for the habits chart section
  const prayerBreakdown = useMemo(() => {
    if (!prayerStats) return []
    return prayerStats.streaks.map((s) => ({
      name: s.prayer_name.charAt(0).toUpperCase() + s.prayer_name.slice(1),
      current: s.current_streak,
      longest: s.longest_streak,
      badges: s.badges,
    }))
  }, [prayerStats])

  // Active challenges with progress
  const activeChallenges = useMemo(() => {
    if (!userChallenges) return []
    return userChallenges.filter((uc) => !uc.progress.is_completed)
  }, [userChallenges])

  const completedChallenges = useMemo(() => {
    if (!userChallenges) return []
    return userChallenges.filter((uc) => uc.progress.is_completed)
  }, [userChallenges])

  // Insights based on real data
  const insights = useMemo(() => {
    const items: { tag: string; tagColor: string; icon: React.ReactNode; text: string }[] = []

    // Streak insight
    const habitStreak = dashboard?.habits?.current_streak ?? 0
    if (habitStreak > 0) {
      items.push({
        tag: 'Habit Streak',
        tagColor: '#22c55e',
        icon: <Flame className="w-4 h-4" />,
        text: `You\u2019ve maintained a ${habitStreak}-day habit streak! Keep up the consistent effort \u2014 small deeds done regularly are most beloved to Allah.`,
      })
    }

    // Prayer completion insight
    const prayerRate = prayerStats?.overall_completion_rate ?? 0
    if (prayerRate > 0) {
      const bestPrayer = prayerStats?.best_prayer_name
      const worstPrayer = prayerStats?.worst_prayer_name
      if (prayerRate >= 80) {
        items.push({
          tag: 'Prayer Consistency',
          tagColor: '#22c55e',
          icon: <CheckCircle2 className="w-4 h-4" />,
          text: `Your prayer completion rate is ${prayerRate.toFixed(0)}%${bestPrayer ? ` \u2014 your most consistent prayer is ${bestPrayer}` : ''}. Excellent dedication!`,
        })
      } else {
        items.push({
          tag: 'Prayer Consistency',
          tagColor: '#f0c75e',
          icon: <AlertCircle className="w-4 h-4" />,
          text: `Your prayer completion rate is ${prayerRate.toFixed(0)}%${worstPrayer ? ` \u2014 ${worstPrayer} needs more attention` : ''}. Every prayer is a step closer to Allah.`,
        })
      }
    }

    // Challenge insight
    const activeCount = activeChallenges.length
    const completedCount = completedChallenges.length
    if (activeCount > 0 || completedCount > 0) {
      items.push({
        tag: 'Challenges',
        tagColor: '#60a5fa',
        icon: <Award className="w-4 h-4" />,
        text: `You have ${activeCount} active challenge${activeCount !== 1 ? 's' : ''} and ${completedCount} completed. ${completedCount > 0 ? 'Masha\u2019Allah, keep growing!' : 'Start by completing your first challenge!'}`,
      })
    }

    // Quran insight
    const quranSessions = dashboard?.quran?.total_sessions ?? 0
    if (quranSessions > 0) {
      items.push({
        tag: 'Quran Journey',
        tagColor: '#a78bfa',
        icon: <BookOpen className="w-4 h-4" />,
        text: `You\u2019ve logged ${quranSessions} Quran reading session${quranSessions !== 1 ? 's' : ''}. The best of you is the one who learns and teaches the Quran.`,
      })
    }

    // Fallback insight
    if (items.length === 0) {
      items.push({
        tag: 'Getting Started',
        tagColor: '#f0c75e',
        icon: <Sparkles className="w-4 h-4" />,
        text: 'Start tracking your habits, prayers, and challenges to see personalized insights here. Every journey begins with a single step.',
      })
    }

    return items
  }, [dashboard, prayerStats, activeChallenges, completedChallenges])

  // ── Statistic cards from real data ─────────────────────────────────
  const statistics = [
    {
      title: 'Habit Completions (Month)',
      value: String(dashboard?.habits?.completed_this_month ?? habitStats?.this_month ?? 0),
      icon: <Target className="w-5 h-5" />,
      sub: `${dashboard?.habits?.completed_today ?? habitStats?.completed_today ?? 0} today`,
    },
    {
      title: 'Current Streak',
      value: `${dashboard?.habits?.current_streak ?? 0} days`,
      icon: <Zap className="w-5 h-5" />,
      sub: `Best: ${dashboard?.habits?.best_streak ?? 0} days`,
    },
    {
      title: 'Prayer Completion',
      value: `${(prayerStats?.overall_completion_rate ?? 0).toFixed(0)}%`,
      icon: <TrendingUp className="w-5 h-5" />,
      sub: `Last 30d: ${(prayerStats?.last_30_days_rate ?? 0).toFixed(0)}%`,
    },
    {
      title: 'Challenges Completed',
      value: String(completedChallenges.length),
      icon: <Award className="w-5 h-5" />,
      sub: `${activeChallenges.length} active`,
    },
  ]

  // ── Shared styles (dark translucent + gold) ─────────────────────────
  const cardStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid var(--gold-mid, #d4a017)',
    borderRadius: '1rem',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 8px 24px -16px rgba(0,0,0,0.5)',
    position: 'relative',
  }

  const goldBar: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: '1.5rem',
    right: '1.5rem',
    height: 2,
    borderRadius: 9999,
    background:
      'linear-gradient(90deg, var(--gold-deep, #9a6b0e) 0%, var(--gold-mid, #d4a017) 25%, var(--gold-light, #f0c75e) 50%, var(--gold-mid, #d4a017) 75%, var(--gold-deep, #9a6b0e) 100%)',
  }

  const tileHeader: React.CSSProperties = {
    color: 'var(--gold-mid, #d4a017)',
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    fontSize: 10,
    fontWeight: 600,
  }
  const tileValue: React.CSSProperties = {
    color: 'var(--manuscript-cream, #fbf3df)',
    fontFamily: 'Georgia, "Times New Roman", serif',
    fontSize: '1.875rem',
    fontWeight: 700,
    lineHeight: 1.2,
  }
  const tileSub: React.CSSProperties = {
    color: 'var(--manuscript-cream, #fbf3df)',
    opacity: 0.55,
    fontSize: '0.75rem',
    fontWeight: 500,
    marginTop: 4,
  }

  const sectionTitle: React.CSSProperties = {
    color: 'var(--manuscript-cream, #fbf3df)',
    fontFamily: 'Georgia, "Times New Roman", serif',
    textShadow: '0 1px 0 rgba(0,0,0,0.45)',
  }

  const labelStyle: React.CSSProperties = {
    color: 'var(--gold-mid, #d4a017)',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    fontSize: 11,
    fontWeight: 600,
  }

  const progressTrack: React.CSSProperties = {
    background: 'rgba(255,255,255,0.06)',
    borderRadius: 9999,
    overflow: 'hidden',
    border: '1px solid rgba(212,160,23,0.15)',
  }

  const loading = dashLoading

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 md:pt-0">
      {/* ── Page header ─────────────────────────────────────────────── */}
      <header className="flex items-end justify-between gap-4 mb-6 mt-1 flex-wrap">
        <div className="flex items-end gap-3 min-w-0">
          <span className="shrink-0 mb-1" style={{ color: 'var(--gold-mid, #d4a017)' }}>
            <BarChart3 size={26} />
          </span>
          <div className="min-w-0">
            <h1
              className="text-2xl sm:text-3xl font-bold tracking-wide leading-tight"
              style={{
                color: 'var(--manuscript-cream, #fbf3df)',
                fontFamily: 'Georgia, "Times New Roman", serif',
                textShadow: '0 1px 0 rgba(0,0,0,0.45)',
              }}
            >
              Analytics
            </h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--manuscript-cream, #fbf3df)', opacity: 0.7 }}>
              Reflect on your spiritual journey
            </p>
          </div>
          <span
            className="hidden sm:block flex-1 h-px mb-2 min-w-[40px]"
            style={{ background: 'linear-gradient(90deg, var(--gold-mid, #d4a017) 0%, transparent 80%)' }}
            aria-hidden
          />
        </div>

        {/* Time range toggle */}
        <div className="flex gap-2">
          {(['week', 'month', 'year'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className="px-3 py-2 rounded-xl text-sm font-semibold transition"
              style={
                timeRange === range
                  ? {
                      background:
                        'linear-gradient(135deg, var(--gold-mid, #d4a017) 0%, var(--gold-light, #f0c75e) 100%)',
                      color: 'var(--emerald-deep, #064e3b)',
                      border: '1px solid var(--gold-deep, #9a6b0e)',
                    }
                  : {
                      background: 'rgba(255,255,255,0.04)',
                      color: 'var(--manuscript-cream, #fbf3df)',
                      border: '1px solid var(--gold-mid, #d4a017)',
                    }
              }
            >
              {range.charAt(0).toUpperCase() + range.slice(1)}
            </button>
          ))}
        </div>
      </header>

      {loading && (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--gold-mid, #d4a017)' }} />
        </div>
      )}

      {!loading && (
        <>
          {/* ── Statistic Cards ──────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {statistics.map((stat) => (
              <div key={stat.title} style={{ ...cardStyle, padding: '1.25rem' }}>
                <div style={goldBar} />
                <div className="flex items-center justify-between mb-3">
                  <span style={tileHeader}>{stat.title}</span>
                  <span style={{ color: 'var(--gold-mid, #d4a017)' }}>{stat.icon}</span>
                </div>
                <div style={tileValue}>{stat.value}</div>
                <div style={tileSub}>{stat.sub}</div>
              </div>
            ))}
          </div>

          {/* ── Charts Section ───────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Weekly Chart */}
            <div style={{ ...cardStyle, padding: '1.5rem' }}>
              <div style={goldBar} />
              <h2 className="text-lg font-semibold mb-5 flex items-center gap-2" style={sectionTitle}>
                <Calendar className="w-5 h-5" style={{ color: 'var(--gold-mid, #d4a017)' }} />
                Weekly Habit Progress
              </h2>
              {last7Days.length > 0 ? (
                <div className="space-y-4">
                  {last7Days.map((day, i) => {
                    const pct = day.total > 0 ? (day.completed / day.total) * 100 : 0
                    return (
                      <div key={i}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-semibold" style={labelStyle}>{day.day}</span>
                          <span className="text-xs" style={{ color: 'var(--manuscript-cream, #fbf3df)', opacity: 0.7 }}>
                            {day.completed}/{day.total}
                          </span>
                        </div>
                        <div className="w-full rounded-full h-3" style={progressTrack}>
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${pct}%`,
                              background: 'linear-gradient(90deg, var(--emerald, #047857) 0%, var(--gold-mid, #d4a017) 100%)',
                            }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-center py-8" style={{ color: 'var(--manuscript-cream, #fbf3df)', opacity: 0.5 }}>
                  No habit data for the past week yet.
                </p>
              )}
            </div>

            {/* Prayer Streaks */}
            <div style={{ ...cardStyle, padding: '1.5rem' }}>
              <div style={goldBar} />
              <h2 className="text-lg font-semibold mb-5 flex items-center gap-2" style={sectionTitle}>
                <BarChart3 className="w-5 h-5" style={{ color: 'var(--gold-mid, #d4a017)' }} />
                Prayer Streaks
              </h2>
              {prayerBreakdown.length > 0 ? (
                <div className="space-y-4">
                  {prayerBreakdown.map((p) => {
                    const maxStreak = Math.max(p.longest, 1)
                    const pct = (p.current / maxStreak) * 100
                    return (
                      <div key={p.name}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-semibold" style={labelStyle}>{p.name}</span>
                          <span className="text-xs" style={{ color: 'var(--manuscript-cream, #fbf3df)', opacity: 0.7 }}>
                            {p.current}d / best {p.longest}d
                          </span>
                        </div>
                        <div className="w-full rounded-full h-3" style={progressTrack}>
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.max(pct, 5)}%`,
                              background: 'linear-gradient(90deg, var(--lapiz, #1e3a8a) 0%, var(--gold-mid, #d4a017) 100%)',
                            }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-center py-8" style={{ color: 'var(--manuscript-cream, #fbf3df)', opacity: 0.5 }}>
                  No prayer streak data yet. Start tracking your prayers!
                </p>
              )}
            </div>
          </div>

          {/* ── Active Challenges ───────────────────────────────────── */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-lg sm:text-xl font-bold tracking-wide" style={sectionTitle}>
                Active Challenges
              </h2>
              <span
                className="flex-1 h-px"
                style={{ background: 'linear-gradient(90deg, var(--gold-mid, #d4a017) 0%, transparent 80%)' }}
                aria-hidden
              />
            </div>

            <div style={{ ...cardStyle, padding: '1.5rem' }}>
              <div style={goldBar} />
              {activeChallenges.length > 0 ? (
                <div className="space-y-4">
                  {activeChallenges.map((uc) => {
                    const target = uc.challenge.streak_target || uc.challenge.duration_days || 1
                    const pct = Math.min((uc.progress.current_streak / target) * 100, 100)
                    return (
                      <div key={uc.challenge.id}>
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-semibold flex items-center gap-2" style={{ color: 'var(--manuscript-cream, #fbf3df)' }}>
                            <span className="text-lg">{uc.challenge.icon || '🎯'}</span>
                            <span style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
                              {uc.challenge.name_en}
                            </span>
                          </span>
                          <span className="text-sm font-bold" style={{ color: 'var(--gold-light, #f0c75e)' }}>
                            {uc.progress.current_streak}/{target}d
                          </span>
                        </div>
                        <div className="w-full rounded-full h-3" style={progressTrack}>
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${pct}%`,
                              background: 'linear-gradient(90deg, var(--emerald, #047857) 0%, var(--gold-mid, #d4a017) 100%)',
                            }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-center py-8" style={{ color: 'var(--manuscript-cream, #fbf3df)', opacity: 0.5 }}>
                  No active challenges. Join one from the Challenges page!
                </p>
              )}
            </div>
          </div>

          {/* ── Prayer Statistics Summary ────────────────────────────── */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-lg sm:text-xl font-bold tracking-wide" style={sectionTitle}>
                Prayer Statistics
              </h2>
              <span
                className="flex-1 h-px"
                style={{ background: 'linear-gradient(90deg, var(--gold-mid, #d4a017) 0%, transparent 80%)' }}
                aria-hidden
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Tracked', value: prayerStats?.total_tracked ?? 0 },
                { label: 'Total Completed', value: prayerStats?.total_completed ?? 0 },
                { label: 'Overall Rate', value: `${(prayerStats?.overall_completion_rate ?? 0).toFixed(0)}%` },
                { label: '30-Day Rate', value: `${(prayerStats?.last_30_days_rate ?? 0).toFixed(0)}%` },
              ].map((stat) => (
                <div key={stat.label} style={{ ...cardStyle, padding: '1rem' }}>
                  <div style={goldBar} />
                  <div style={tileHeader} className="mb-2">{stat.label}</div>
                  <div style={{ ...tileValue, fontSize: '1.5rem' }}>{stat.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Insights & Reflections ───────────────────────────────── */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-lg sm:text-xl font-bold tracking-wide" style={sectionTitle}>
                Insights & Reflections
              </h2>
              <span
                className="flex-1 h-px"
                style={{ background: 'linear-gradient(90deg, var(--gold-mid, #d4a017) 0%, transparent 80%)' }}
                aria-hidden
              />
            </div>

            <div className="space-y-4">
              {insights.map((ins, i) => (
                <div key={i} style={{ ...cardStyle, padding: '1.25rem' }}>
                  <div style={goldBar} />
                  <div className="flex items-center gap-2 mb-2">
                    <span style={{ color: ins.tagColor }}>{ins.icon}</span>
                    <span className="text-xs uppercase tracking-[0.18em] font-semibold" style={{ color: ins.tagColor }}>
                      {ins.tag}
                    </span>
                  </div>
                  <p
                    className="text-sm leading-relaxed"
                    style={{
                      color: 'var(--manuscript-cream, #fbf3df)',
                      opacity: 0.82,
                      fontFamily: 'Georgia, "Times New Roman", serif',
                    }}
                  >
                    {ins.text}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Footer action ────────────────────────────────────────── */}
          <div className="text-center">
            <button
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition"
              style={{
                background:
                  'linear-gradient(135deg, var(--gold-mid, #d4a017) 0%, var(--gold-light, #f0c75e) 100%)',
                color: 'var(--emerald-deep, #064e3b)',
                border: '1px solid var(--gold-deep, #9a6b0e)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45), 0 4px 12px -4px rgba(154,107,14,0.55)',
              }}
            >
              <Download className="w-4 h-4" />
              Download Report (CSV)
            </button>
          </div>

          <GoldDivider className="my-6" />
        </>
      )}
    </div>
  )
}