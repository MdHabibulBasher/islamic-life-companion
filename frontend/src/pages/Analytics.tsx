import React, { useState, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart3, TrendingUp, Calendar, Award, Zap, Target, Download,
  Flame, Sparkles, BookOpen, CheckCircle2, AlertCircle, Loader2,
  Moon,
} from 'lucide-react'
import { GoldDivider } from '../components/IslamicOrnamentBG'
import { dashboardService, type DashboardData } from '../services/dashboardService'
import {
  prayerTrackingService,
  type PrayerStatistics,
} from '../services/prayerTrackingService'
import {
  habitService,
  type HabitRangeSummary,
} from '../services/habitService'
import { challengeService, type UserChallengeDetailed } from '../services/challengeService'
import { fastingService, type FastingMonthSummary } from '../services/fastingService'
import { quranService, type QuranProgress } from '../services/quranService'
import { api } from '../services/api'

/* ============================================================================
 *  Analytics — deep-emerald edition (real data from database)
 * ----------------------------------------------------------------------------
 *  Pulls from:
 *   • Dashboard aggregation (habits, challenges, quran, achievements)
 *   • Prayer tracking statistics + streaks + range summary + qada stats
 *   • Habit statistics + per-habit tracking + range summary
 *   • Challenge progress + statistics
 *   • Fasting month summary (Hijri-month scoped)
 *   • Quran reading progress
 * ========================================================================= */

type TimeRange = 'week' | 'month' | 'year'

/** Compute the [start, end] Gregorian window for the selected toggle. */
function useRange(range: TimeRange) {
  return useMemo(() => {
    const end = new Date()
    end.setHours(0, 0, 0, 0)
    const start = new Date(end)
    if (range === 'week') start.setDate(start.getDate() - 6)
    else if (range === 'month') start.setDate(start.getDate() - 29)
    else start.setDate(start.getDate() - 364)
    const iso = (d: Date) => d.toISOString().slice(0, 10)
    return { startStr: iso(start), endStr: iso(end) }
  }, [range])
}

/** Fetch today's Hijri date so the fasting card can default to the
 *  current Hijri month. */
function useHijriToday() {
  return useQuery({
    queryKey: ['hijri-today'],
    queryFn: async () => {
      const todayStr = new Date().toISOString().slice(0, 10)
      const r = await api.get('/prayer-times/islamic-date', {
        params: { target_date: todayStr },
      })
      return {
        hijriYear: r.data.hijri_year as number,
        hijriMonth: r.data.hijri_month_number as number,
        hijriMonthName: r.data.hijri_month as string,
      }
    },
    staleTime: 1000 * 60 * 60, // 1h — Hijri date won't change mid-session
  })
}

export const Analytics: React.FC = () => {
  const [timeRange, setTimeRange] = useState<TimeRange>('month')

  // ── Range window for the toggle ─────────────────────────────────────
  const { startStr, endStr } = useRange(timeRange)

  // ── Hijri today (for fasting card) ──────────────────────────────────
  const hijriToday = useHijriToday()
  const hijriYear = hijriToday.data?.hijriYear ?? new Date().getFullYear()
  const hijriMonth = hijriToday.data?.hijriMonth ?? 1

  // ── Data queries (range-aware where possible) ───────────────────────
  const { data: dashboard, isLoading: dashLoading } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: () => dashboardService.get(),
  })

  const { data: prayerStats } = useQuery<PrayerStatistics>({
    queryKey: ['prayerStatistics'],
    queryFn: () => prayerTrackingService.getStatistics(),
  })

  const { data: prayerSummary } = useQuery({
    queryKey: ['prayerSummary', startStr, endStr],
    queryFn: () => prayerTrackingService.getSummary(startStr, endStr),
  })

  const { data: habitStats } = useQuery({
    queryKey: ['habitStatistics'],
    queryFn: () => habitService.getStatistics(),
  })

  const { data: habitRange } = useQuery<HabitRangeSummary>({
    queryKey: ['habitRangeSummary', startStr, endStr],
    queryFn: () => habitService.getRangeSummary(startStr, endStr),
  })

  const { data: userChallenges } = useQuery<UserChallengeDetailed[]>({
    queryKey: ['challenges', 'progress'],
    queryFn: () => challengeService.getUserChallenges(),
  })

  const { data: challengeStats } = useQuery({
    queryKey: ['challengeStatistics'],
    queryFn: () => challengeService.getStatistics(),
  })

  const { data: fastingSummary } = useQuery<FastingMonthSummary>({
    queryKey: ['fastingMonthSummary', hijriYear, hijriMonth],
    queryFn: () => fastingService.monthSummary(hijriYear, hijriMonth),
    enabled: !!hijriToday.data,
  })

  const { data: quranProgress } = useQuery<QuranProgress>({
    queryKey: ['quranProgress'],
    queryFn: () => quranService.getReadingProgress(),
  })

  // prayerSummary (from getSummary) powers the Missed Prayers card and CSV

  // ── Derived data ────────────────────────────────────────────────────
  const prayerTrend = useMemo(() => {
    if (!prayerSummary?.per_prayer) return []
    return prayerSummary.per_prayer.map((p) => ({
      name: p.prayer_name.charAt(0).toUpperCase() + p.prayer_name.slice(1),
      prayed: p.prayed,
      missed: p.missed,
    }))
  }, [prayerSummary])

  const habitTrend = useMemo(() => {
    if (!habitRange?.per_day) return []
    return habitRange.per_day.map((d) => ({
      day: new Date(d.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
      completed: d.completed_habits,
      total: d.total_habits,
      rate: d.completion_rate,
    }))
  }, [habitRange])

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

    // Fasting insight
    const fastedDays = fastingSummary?.fasted_days ?? 0
    if (fastedDays > 0) {
      items.push({
        tag: 'Fasting',
        tagColor: '#38bdf8',
        icon: <Moon className="w-4 h-4" />,
        text: `You\u2019ve fasted ${fastedDays} day${fastedDays !== 1 ? 's' : ''} this Hijri month (${fastingSummary?.hijri_month_name ?? ''}). May Allah accept your fasting.`,
      })
    }

    // Missed prayers insight (from range summary)
    const totalMissed = prayerSummary?.missed ?? 0
    const totalPrayed = prayerSummary?.prayed ?? 0
    if (totalMissed > 0) {
      // Find the prayer with the most misses in range
      const worst = prayerSummary?.per_prayer?.slice().sort((a, b) => b.missed - a.missed)[0]
      items.push({
        tag: 'Missed Prayers',
        tagColor: '#f0c75e',
        icon: <AlertCircle className="w-4 h-4" />,
        text: `You missed ${totalMissed} prayer${totalMissed !== 1 ? 's' : ''} this ${timeRange}${worst && worst.missed > 0 ? ` \u2014 ${worst.prayer_name} has the most misses (${worst.missed})` : ''}. Don't be discouraged; every effort to pray on time counts.`,
      })
    } else if (totalPrayed > 0) {
      items.push({
        tag: 'Missed Prayers',
        tagColor: '#22c55e',
        icon: <CheckCircle2 className="w-4 h-4" />,
        text: `Alhamdulillah, you have no missed prayers recorded this ${timeRange} \u2014 ${totalPrayed} prayed. May Allah keep you steadfast.`,
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
  }, [dashboard, prayerStats, activeChallenges, completedChallenges, fastingSummary, prayerSummary, timeRange])

  // ── Statistic cards from real data (respect selected range) ────────
  const statistics = [
    {
      title: 'Habit Completions',
      value: String(habitRange?.completed_habits ?? dashboard?.habits?.completed_this_month ?? habitStats?.this_month ?? 0),
      icon: <Target className="w-5 h-5" />,
      sub: `${timeRange} \u2022 ${dashboard?.habits?.completed_today ?? habitStats?.completed_today ?? 0} today`,
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
    color: 'var(--text-on-glass)',
    fontFamily: 'Georgia, "Times New Roman", serif',
    fontSize: '1.875rem',
    fontWeight: 700,
    lineHeight: 1.2,
  }
  const tileSub: React.CSSProperties = {
    color: 'var(--text-on-glass)',
    opacity: 0.55,
    fontSize: '0.75rem',
    fontWeight: 500,
    marginTop: 4,
  }

  const sectionTitle: React.CSSProperties = {
    color: 'var(--text-on-glass)',
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

  const emptyText: React.CSSProperties = {
    color: 'var(--text-on-glass)',
    opacity: 0.5,
  }

  // Combine loading flags so partial loads don't show stale state.
  const loading =
    dashLoading ||
    (timeRange === 'month' && habitRange === undefined)

  // ── CSV export ──────────────────────────────────────────────────────
  const downloadCsv = useCallback(() => {
    const rows: string[] = []
    const push = (line: string) => rows.push(line)

    push('# Islamic Life Companion \u2014 Analytics Report')
    push(`# Range: ${timeRange} (${startStr} to ${endStr})`)
    push(`# Generated: ${new Date().toISOString()}`)
    push('')

    push('## Summary Cards')
    push('Metric,Value,Sub')
    statistics.forEach((s) => push(`${csv(s.title)},${csv(s.value)},${csv(s.sub)}`))
    push('')

    if (prayerSummary) {
      push('## Missed Prayers (range)')
      push('Metric,Value')
      push(`Days in range,${prayerSummary.days_in_range}`)
      push(`Days tracked,${prayerSummary.days_tracked}`)
      push(`Prayed,${prayerSummary.prayed}`)
      push(`Missed,${prayerSummary.missed}`)
      push(`Full days,${prayerSummary.full_days}`)
      push('')
      push('Prayer,Prayed,Missed')
      prayerSummary.per_prayer.forEach((p) =>
        push(`${csv(p.prayer_name)},${p.prayed},${p.missed}`),
      )
      push('')
    }

    if (habitRange) {
      push('## Habit Range Summary')
      push('Metric,Value')
      push(`Days in range,${habitRange.days_in_range}`)
      push(`Total habits,${habitRange.total_habits}`)
      push(`Completed habits,${habitRange.completed_habits}`)
      push(`Completion rate,${habitRange.completion_rate}%`)
      push('')
      push('Date,Completed,Total,Rate%')
      habitRange.per_day.forEach((d) =>
        push(`${d.date},${d.completed_habits},${d.total_habits},${d.completion_rate}`),
      )
      push('')
    }

    if (fastingSummary) {
      push('## Fasting Month Summary')
      push('Metric,Value')
      push(`Hijri month,${csv(fastingSummary.hijri_month_name)} ${fastingSummary.hijri_year}`)
      push(`Total days,${fastingSummary.total_days}`)
      push(`Fasted days,${fastingSummary.fasted_days}`)
      push(`Ramadan days,${fastingSummary.ramadan_days}`)
      push(`Sunnah days,${fastingSummary.sunnah_days}`)
      push(`White days,${fastingSummary.white_days}`)
      push(`Total donations,${fastingSummary.total_donations}`)
      push(`Good deeds done,${fastingSummary.good_deeds_done}`)
      push('')
    }

    if (quranProgress) {
      push('## Quran Progress')
      push('Metric,Value')
      push(`Total surahs read,${quranProgress.totalSurahsRead}`)
      push(`Total ayahs read,${quranProgress.totalAyahsRead}`)
      push(`Current surah,${quranProgress.currentSurah}`)
      push(`Current ayah,${quranProgress.currentAyah}`)
      push(`Reading streak,${quranProgress.readingStreak} days`)
      push(`Last read date,${csv(quranProgress.lastReadDate)}`)
      push('')
    }

    if (challengeStats) {
      push('## Challenge Statistics')
      push('Metric,Value')
      Object.entries(challengeStats as Record<string, unknown>).forEach(([k, v]) => {
        if (Array.isArray(v)) {
          push(`${csv(k)},${csv(JSON.stringify(v))}`)
        } else {
          push(`${csv(k)},${csv(String(v))}`)
        }
      })
      push('')
    }

    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `analytics-${timeRange}-${startStr}_to_${endStr}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [statistics, prayerSummary, habitRange, fastingSummary, quranProgress, challengeStats, timeRange, startStr, endStr])

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
                color: 'var(--text-on-glass)',
                fontFamily: 'Georgia, "Times New Roman", serif',
                textShadow: '0 1px 0 rgba(0,0,0,0.45)',
              }}
            >
              Analytics
            </h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-on-glass)', opacity: 0.7 }}>
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
                      color: 'var(--text-on-glass)',
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

          {/* ── Trend Charts Section (range-aware) ───────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Prayer completion trend (range-aware) */}
            <div style={{ ...cardStyle, padding: '1.5rem' }}>
              <div style={goldBar} />
              <h2 className="text-lg font-semibold mb-5 flex items-center gap-2" style={sectionTitle}>
                <TrendingUp className="w-5 h-5" style={{ color: 'var(--gold-mid, #d4a017)' }} />
                Prayer Completion — {timeRange}
              </h2>
              {prayerTrend.length > 0 ? (
                <div className="space-y-4">
                  {prayerTrend.map((p) => {
                    const total = p.prayed + p.missed
                    const prayedPct = total > 0 ? (p.prayed / total) * 100 : 0
                    return (
                      <div key={p.name}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-semibold" style={labelStyle}>{p.name}</span>
                          <span className="text-xs" style={{ color: 'var(--text-on-glass)', opacity: 0.7 }}>
                            {p.prayed} prayed / {p.missed} missed
                          </span>
                        </div>
                        <div className="w-full rounded-full h-3" style={progressTrack}>
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.max(prayedPct, 5)}%`,
                              background: 'linear-gradient(90deg, var(--emerald, #047857) 0%, var(--gold-mid, #d4a017) 100%)',
                            }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-center py-8" style={emptyText}>
                  No prayer data for this range yet.
                </p>
              )}
            </div>

            {/* Habit completion trend (range-aware) */}
            <div style={{ ...cardStyle, padding: '1.5rem' }}>
              <div style={goldBar} />
              <h2 className="text-lg font-semibold mb-5 flex items-center gap-2" style={sectionTitle}>
                <Calendar className="w-5 h-5" style={{ color: 'var(--gold-mid, #d4a017)' }} />
                Habit Completion — {timeRange}
              </h2>
              {habitTrend.length > 0 ? (
                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                  {habitTrend.map((d, i) => {
                    const pct = d.total > 0 ? (d.completed / d.total) * 100 : 0
                    return (
                      <div key={i}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-semibold" style={labelStyle}>{d.day}</span>
                          <span className="text-xs" style={{ color: 'var(--text-on-glass)', opacity: 0.7 }}>
                            {d.completed}/{d.total}
                          </span>
                        </div>
                        <div className="w-full rounded-full h-2.5" style={progressTrack}>
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
                <p className="text-sm text-center py-8" style={emptyText}>
                  No habit data for this range yet.
                </p>
              )}
            </div>
          </div>

          {/* ── Prayer Streaks + Active Challenges ─────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
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
                          <span className="text-xs" style={{ color: 'var(--text-on-glass)', opacity: 0.7 }}>
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
                <p className="text-sm text-center py-8" style={emptyText}>
                  No prayer streak data yet. Start tracking your prayers!
                </p>
              )}
            </div>

            {/* Active Challenges */}
            <div style={{ ...cardStyle, padding: '1.5rem' }}>
              <div style={goldBar} />
              <h2 className="text-lg font-semibold mb-5 flex items-center gap-2" style={sectionTitle}>
                <Award className="w-5 h-5" style={{ color: 'var(--gold-mid, #d4a017)' }} />
                Active Challenges
              </h2>
              {activeChallenges.length > 0 ? (
                <div className="space-y-4">
                  {activeChallenges.map((uc) => {
                    const target = uc.challenge.streak_target || uc.challenge.duration_days || 1
                    const pct = Math.min((uc.progress.current_streak / target) * 100, 100)
                    return (
                      <div key={uc.challenge.id}>
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-semibold flex items-center gap-2" style={{ color: 'var(--text-on-glass)' }}>
                            <span className="text-lg">{uc.challenge.icon || '\uD83C\uDFAF'}</span>
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
                <p className="text-sm text-center py-8" style={emptyText}>
                  No active challenges. Join one from the Challenges page!
                </p>
              )}
            </div>
          </div>

          {/* ── New data-source cards: Fasting, Quran, Qada, Challenge stats ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Fasting summary */}
            <div style={{ ...cardStyle, padding: '1.5rem' }}>
              <div style={goldBar} />
              <h2 className="text-lg font-semibold mb-5 flex items-center gap-2" style={sectionTitle}>
                <Moon className="w-5 h-5" style={{ color: 'var(--gold-mid, #d4a017)' }} />
                Fasting — {fastingSummary?.hijri_month_name ?? 'Current Hijri Month'} {fastingSummary?.hijri_year ?? hijriYear}
              </h2>
              {fastingSummary ? (
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Fasted Days', value: `${fastingSummary.fasted_days}/${fastingSummary.total_days}` },
                    { label: 'Ramadan Days', value: fastingSummary.ramadan_days },
                    { label: 'Sunnah Days', value: fastingSummary.sunnah_days },
                    { label: 'White Days', value: fastingSummary.white_days },
                    { label: 'Good Deeds', value: fastingSummary.good_deeds_done },
                    { label: 'Donations', value: fastingSummary.total_donations },
                  ].map((s) => (
                    <div key={s.label}>
                      <div style={tileHeader} className="mb-1">{s.label}</div>
                      <div style={{ ...tileValue, fontSize: '1.25rem' }}>{s.value}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-center py-8" style={emptyText}>
                  No fasting data for this Hijri month yet.
                </p>
              )}
            </div>

            {/* Quran progress */}
            <div style={{ ...cardStyle, padding: '1.5rem' }}>
              <div style={goldBar} />
              <h2 className="text-lg font-semibold mb-5 flex items-center gap-2" style={sectionTitle}>
                <BookOpen className="w-5 h-5" style={{ color: 'var(--gold-mid, #d4a017)' }} />
                Quran Reading Progress
              </h2>
              {quranProgress ? (
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Surahs Read', value: quranProgress.totalSurahsRead },
                    { label: 'Ayahs Read', value: quranProgress.totalAyahsRead },
                    { label: 'Current Surah', value: quranProgress.currentSurah },
                    { label: 'Current Ayah', value: quranProgress.currentAyah },
                    { label: 'Reading Streak', value: `${quranProgress.readingStreak}d` },
                    {
                      label: 'Last Read',
                      value: quranProgress.lastReadDate
                        ? new Date(quranProgress.lastReadDate).toLocaleDateString()
                        : '\u2014',
                    },
                  ].map((s) => (
                    <div key={s.label}>
                      <div style={tileHeader} className="mb-1">{s.label}</div>
                      <div style={{ ...tileValue, fontSize: '1.25rem' }}>{s.value}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-center py-8" style={emptyText}>
                  No Quran reading data yet.
                </p>
              )}
            </div>

            {/* Missed Prayers */}
            <div style={{ ...cardStyle, padding: '1.5rem' }}>
              <div style={goldBar} />
              <h2 className="text-lg font-semibold mb-5 flex items-center gap-2" style={sectionTitle}>
                <AlertCircle className="w-5 h-5" style={{ color: 'var(--gold-mid, #d4a017)' }} />
                Missed Prayers — {timeRange}
              </h2>
              {prayerSummary && prayerSummary.per_prayer.length > 0 ? (
                <>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <div style={tileHeader} className="mb-1">Missed</div>
                      <div style={{ ...tileValue, fontSize: '1.25rem', color: '#f0c75e' }}>
                        {prayerSummary.missed}
                      </div>
                    </div>
                    <div>
                      <div style={tileHeader} className="mb-1">Prayed</div>
                      <div style={{ ...tileValue, fontSize: '1.25rem', color: '#22c55e' }}>
                        {prayerSummary.prayed}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {prayerSummary.per_prayer.map((p) => (
                      <div key={p.prayer_name} className="flex justify-between text-xs" style={labelStyle}>
                        <span style={{ textTransform: 'capitalize' }}>{p.prayer_name}</span>
                        <span style={{ color: 'var(--text-on-glass)', opacity: 0.8 }}>
                          {p.prayed} prayed • {p.missed} missed
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-center py-8" style={emptyText}>
                  No prayer data for this range.
                </p>
              )}
            </div>

            {/* Challenge statistics */}
            <div style={{ ...cardStyle, padding: '1.5rem' }}>
              <div style={goldBar} />
              <h2 className="text-lg font-semibold mb-5 flex items-center gap-2" style={sectionTitle}>
                <Award className="w-5 h-5" style={{ color: 'var(--gold-mid, #d4a017)' }} />
                Challenge Statistics
              </h2>
              {challengeStats ? (
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Joined', value: (challengeStats as Record<string, unknown>).total_challenges_joined ?? 0 },
                    { label: 'Completed', value: (challengeStats as Record<string, unknown>).total_challenges_completed ?? 0 },
                    {
                      label: 'Completion Rate',
                      value: `${(challengeStats as Record<string, unknown>).completion_rate ?? 0}%`,
                    },
                    { label: 'Best Streak', value: `${(challengeStats as Record<string, unknown>).best_streak ?? 0}d` },
                  ].map((s) => (
                    <div key={s.label}>
                      <div style={tileHeader} className="mb-1">{s.label}</div>
                      <div style={{ ...tileValue, fontSize: '1.25rem' }}>{String(s.value)}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-center py-8" style={emptyText}>
                  No challenge statistics yet.
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
                      color: 'var(--text-on-glass)',
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
              onClick={downloadCsv}
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

/** Escape a value for CSV (quote if it contains commas/quotes/newlines). */
function csv(v: string | number): string {
  const s = String(v)
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}