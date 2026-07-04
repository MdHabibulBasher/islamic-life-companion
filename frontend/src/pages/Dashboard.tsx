import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Flame,
  Heart,
  Plus,
  Quote as QuoteIcon,
  Sparkles,
  Sunrise,
  Sun,
  Sunset,
  Target,
  Timer,
  Trophy,
  X,
  Zap,
} from 'lucide-react'
import { LoadingSpinner } from '../components/Loading'
import { dashboardService, type DashboardData } from '../services/dashboardService'
import { api } from '../services/api'
import { habitService, TrackingType, type CreateHabitData, type UserHabit } from '../services/habitService'
import { OrnateCard } from '../components/IslamicOrnamentBG'

/* ============================================================================
 *  Dashboard — Prayer-Tracker color edition
 * ----------------------------------------------------------------------------
 *  Visual language intentionally matches PrayerTracker.tsx:
 *   • Deep emerald background (--surface-deep → --surface-deep-2 → --surface-deep-edge)
 *   • Dark translucent cards (rgba 255/255/255/0.04) with gold borders
 *   • Gold leaf accents (--gold-mid → --gold-light → --gold-glow)
 *   • Manuscript cream text (--manuscript-cream)
 *   • No decorative 8-point stars, hex rosettes, or crescent ornaments
 * ========================================================================= */

interface HijriToday {
  gregorianDate: string
  hijriDate: string
  hijriDay: number
  hijriMonth: string
  hijriMonthNumber: number
  hijriYear: number
  hijriBasis: string
  hijriOffset: number
}

const AYAH_POOL: Array<{ arabic: string; en: string; ref: string }> = [
  {
    arabic: 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ',
    en: 'In the name of Allah, the Entirely Merciful, the Especially Merciful.',
    ref: 'Al-Fatihah 1:1',
  },
  {
    arabic: 'إِنَّ مَعَ ٱلْعُسْرِ يُسْرًا',
    en: 'Indeed, with hardship comes ease.',
    ref: 'Ash-Sharh 94:6',
  },
  {
    arabic: 'وَمَن يَتَوَكَّلْ عَلَى ٱللَّهِ فَهُوَ حَسْبُهُۥٓ',
    en: 'And whoever relies upon Allah — then He is sufficient for him.',
    ref: 'At-Talaq 65:3',
  },
  {
    arabic: 'فَٱذْكُرُونِىٓ أَذْكُرْكُمْ',
    en: 'Remember Me; I will remember you.',
    ref: 'Al-Baqarah 2:152',
  },
  {
    arabic: 'وَقُل رَّبِّ زِدْنِى عِلْمًا',
    en: 'And say, "My Lord, increase me in knowledge."',
    ref: 'Ta-Ha 20:114',
  },
  {
    arabic: 'ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ',
    en: 'All praise is for Allah, Lord of all worlds.',
    ref: 'Al-Fatihah 1:2',
  },
  {
    arabic: 'إِنَّ ٱللَّهَ مَعَ ٱلصَّٰبِرِينَ',
    en: 'Indeed, Allah is with the patient.',
    ref: 'Al-Baqarah 2:153',
  },
]

const todayAyah = (): typeof AYAH_POOL[number] => {
  const d = new Date()
  const dayKey = d.getFullYear() * 1000 + d.getMonth() * 31 + d.getDate()
  return AYAH_POOL[dayKey % AYAH_POOL.length]
}

/* ============================================================================
 *  Smart Habit Suggestions
 * ----------------------------------------------------------------------------
 *  Curated starter habits shown to brand-new users (total_habits === 0).
 *  Auto-disappears once the user adds at least one habit.
 * ========================================================================= */
interface SuggestedHabit {
  id: string
  name: string
  description: string
  category: 'Worship' | 'Character' | 'Knowledge' | 'Health'
  categoryColor: string
  icon: typeof BookOpen
  data: Omit<CreateHabitData, 'category_id'> & { categoryName: string }
}

const SUGGESTED_HABITS: SuggestedHabit[] = [
  {
    id: 'quran-page',
    name: 'Read 1 page of Quran',
    description: 'Daily recitation from the Mushaf to maintain a steady connection.',
    category: 'Knowledge',
    categoryColor: '#7C3AED',
    icon: BookOpen,
    data: {
      categoryName: 'Knowledge',
      name: 'Read 1 page of Quran',
      description: 'Daily recitation from the Mushaf to maintain a steady connection with the Quran.',
      tracking_type: TrackingType.COUNTER,
      target_value: 1,
      unit: 'pages',
    },
  },
  {
    id: 'fajr',
    name: 'Pray Fajr on time',
    description: 'Wake for Fajr at the mosque or at its earliest time.',
    category: 'Worship',
    categoryColor: '#2C5F2D',
    icon: Sunrise,
    data: {
      categoryName: 'Worship',
      name: 'Pray Fajr on time',
      description: 'Wake for Fajr at the mosque or at its earliest time.',
      tracking_type: TrackingType.CHECKBOX,
    },
  },
  {
    id: 'morning-adhkar',
    name: 'Morning Adhkar',
    description: 'Recite morning remembrance after Fajr.',
    category: 'Worship',
    categoryColor: '#2C5F2D',
    icon: Sun,
    data: {
      categoryName: 'Worship',
      name: 'Morning Adhkar',
      description: 'Recite morning remembrance after Fajr.',
      tracking_type: TrackingType.CHECKBOX,
    },
  },
  {
    id: 'evening-adhkar',
    name: 'Evening Adhkar',
    description: 'Recite evening remembrance before Maghrib.',
    category: 'Worship',
    categoryColor: '#2C5F2D',
    icon: Sunset,
    data: {
      categoryName: 'Worship',
      name: 'Evening Adhkar',
      description: 'Recite evening remembrance before Maghrib.',
      tracking_type: TrackingType.CHECKBOX,
    },
  },
  {
    id: 'sadaqah',
    name: 'Give Sadaqah',
    description: 'Daily charity, even if small — a coin, a kind word, a smile.',
    category: 'Character',
    categoryColor: '#D97706',
    icon: Heart,
    data: {
      categoryName: 'Character',
      name: 'Give Sadaqah',
      description: 'Daily charity, even if small — a coin, a kind word, a smile.',
      tracking_type: TrackingType.CHECKBOX,
    },
  },
  {
    id: 'last-10-ayahs',
    name: 'Read last 10 ayahs of Quran',
    description: "Recite the protection verses (Amma's last 10 ayahs).",
    category: 'Knowledge',
    categoryColor: '#7C3AED',
    icon: BookOpen,
    data: {
      categoryName: 'Knowledge',
      name: 'Read last 10 ayahs of Quran',
      description: "Recite Surah Al-Asr or Amma's last 10 ayahs daily.",
      tracking_type: TrackingType.COUNTER,
      target_value: 10,
      unit: 'ayahs',
    },
  },
]

export const Dashboard = () => {
  const { data, isLoading, isError } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: () => dashboardService.get(),
    refetchInterval: 1000 * 60 * 10,
  })

  const todayQuery = useQuery<HijriToday>({
    queryKey: ['hijri-today-dashboard'],
    queryFn: async () => {
      const r = await api.get('/prayer-times/islamic-date')
      return {
        gregorianDate: r.data.gregorian_date,
        hijriDate: r.data.hijri_date,
        hijriDay: r.data.hijri_day,
        hijriMonth: r.data.hijri_month,
        hijriMonthNumber: r.data.hijri_month_number,
        hijriYear: r.data.hijri_year,
        hijriBasis: r.data.hijri_basis,
        hijriOffset: r.data.hijri_offset_applied,
      }
    },
    retry: 0,
  })

  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  if (isLoading) return <LoadingSpinner fullScreen text="Loading dashboard…" />

  if (isError || !data) {
    return (
      <div className="flex items-center justify-center min-h-[70vh] px-4">
        <ErrorCard />
      </div>
    )
  }

  const { habits, challenges, quran, user } = data
  const completionPct = Math.min(100, habits.completion_rate_today)
  const ayah = todayAyah()
  const firstName = user.full_name ? user.full_name.split(' ')[0] : 'Friend'

  return (
    <div className="max-w-[1400px] mx-auto px-4 pb-12 pt-4">
      <DashboardHero
        firstName={firstName}
        hijri={todayQuery.data ?? null}
        completionPct={completionPct}
        completedToday={habits.completed_today}
        activeHabits={habits.active_habits}
        bestStreak={habits.best_streak}
        currentStreak={habits.current_streak}
        now={now}
      />

      <div className="mt-10 mb-2">
        <HabitSuggestions totalHabits={habits.total_habits} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12 mt-10 px-1">
        <OrnateCard variant="dark" corners="all" topBar className="!p-6">
          <CardTitle icon={<Flame size={18} />}>Streak ladder</CardTitle>
          <StreakLadder
            current={habits.current_streak}
            best={habits.best_streak}
          />
        </OrnateCard>

        <OrnateCard variant="dark" corners="all" topBar className="!p-6">
          <CardTitle icon={<BookOpen size={18} />}>Quran journey</CardTitle>
          <QuranJourney sessions={quran.total_sessions} />
        </OrnateCard>

        <OrnateCard variant="dark" corners="all" topBar className="!p-6">
          <CardTitle icon={<Trophy size={18} />}>Challenges</CardTitle>
          <ChallengesMini
            active={challenges.active}
            completed={challenges.completed}
            today={challenges.completions_today}
          />
        </OrnateCard>
      </div>

      <div className="mt-10 mb-12">
        <AyahOfTheDay ayah={ayah} />
      </div>

      <div className="mt-12 mb-12">
        <AchievementsGrid
          bestStreak={habits.best_streak}
          completionPct={completionPct}
          completedWeek={habits.completed_this_week}
          completedMonth={habits.completed_this_month}
          totalSessions={quran.total_sessions}
        />
      </div>

      <div className="mt-12">
        <QuickActions />
      </div>
    </div>
  )
}

/* ============================================================================
 *  Card primitives — dark emerald + gold (PrayerTracker style)
 * ========================================================================= */

/* ============================================================================
 *  CardTitle — manuscript section header inside a card
 * ========================================================================= */

const CardTitle: React.FC<{
  icon?: React.ReactNode
  children: React.ReactNode
}> = ({ icon, children }) => (
  <div className="flex items-center gap-2 mb-3">
    <span style={{ color: 'var(--gold-mid)' }}>{icon}</span>
    <h3
      className="text-base font-bold uppercase tracking-wide"
      style={{
        color: 'var(--gold-mid)',
        fontFamily: 'Georgia, "Times New Roman", serif',
        letterSpacing: '0.12em',
      }}
    >
      {children}
    </h3>
  </div>
)

/* ============================================================================
 *  ErrorCard
 * ========================================================================= */

const ErrorCard: React.FC = () => (
  <OrnateCard variant="dark" corners="all" topBar className="!p-8 max-w-md text-center">
    <AlertCircle
      className="mx-auto mb-3"
      size={36}
      style={{ color: 'var(--gold-mid)' }}
    />
    <p
      className="text-lg font-semibold"
      style={{
        color: 'var(--text-on-glass)',
        fontFamily: 'Georgia, serif',
      }}
    >
      Unable to load dashboard
    </p>
    <p
      className="text-sm mt-2"
      style={{ color: 'var(--text-on-glass)', opacity: 0.7 }}
    >
      Please refresh and try again.
    </p>
  </OrnateCard>
)

/* ============================================================================
 *  Hero — matches PrayerTracker look (deep emerald + gold)
 * ========================================================================= */

interface HeroProps {
  firstName: string
  hijri: HijriToday | null
  completionPct: number
  completedToday: number
  activeHabits: number
  bestStreak: number
  currentStreak: number
  now: Date
}

const DashboardHero: React.FC<HeroProps> = ({
  firstName,
  hijri,
  completionPct,
  completedToday: _completedToday,
  activeHabits: _activeHabits,
  bestStreak: _bestStreak,
  currentStreak: _currentStreak,
  now,
}) => {
  const dateStr = now.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  const h = now.getHours()
  const greetingCore =
    h < 5
      ? 'Late night'
      : h < 12
        ? 'Good morning'
        : h < 17
          ? 'Good afternoon'
          : h < 21
            ? 'Good evening'
            : 'Good night'

  return (
    <OrnateCard
      variant="dark"
      corners="all"
      topBar
      className="overflow-hidden relative !p-0 mb-8"
    >
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-8 items-center px-6 sm:px-10 py-8">
        <div>
          <p
            className="text-[10px] uppercase font-bold mb-2"
            style={{
              color: 'var(--gold-mid, #d4a017)',
              letterSpacing: '0.22em',
            }}
          >
            {greetingCore}
          </p>
          <h1
            className="text-3xl sm:text-4xl md:text-5xl font-bold leading-tight mb-2"
            style={{
              color: 'var(--text-on-glass)',
              fontFamily: 'Georgia, "Times New Roman", serif',
              letterSpacing: '0.01em',
              textShadow: '0 2px 0 rgba(0,0,0,0.45)',
            }}
          >
            Assalamu Alaikum, {firstName}
          </h1>
          <p
            className="text-sm sm:text-base mb-5 max-w-xl"
            style={{ color: 'var(--text-on-glass)', opacity: 0.78 }}
          >
            {completionPct >= 80
              ? "SubhanAllah — you're on fire. Your streaks are alive and the angels are taking note."
              : completionPct >= 50
                ? 'A beautiful day of worship is taking shape. A few more habits and the day is sealed.'
                : 'A fresh page is before you. Even one deed today is light upon light.'}
          </p>

          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <Calendar size={16} style={{ color: 'var(--gold-mid)' }} />
            <p
              className="text-sm"
              style={{ color: 'var(--text-on-glass)', opacity: 0.85 }}
            >
              {dateStr}
            </p>
            <span style={{ color: 'var(--gold-mid)' }}>·</span>
            <p
              className="text-sm font-semibold"
              style={{ color: 'var(--gold-light, #f0c75e)' }}
            >
              {hijri ? hijri.hijriDate : 'Loading Hijri date…'}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-center">
          <LiveClock now={now} />
        </div>
      </div>
    </OrnateCard>
  )
}

/* ============================================================================
 *  LiveClock — modern HH:MM:SS clock with AM/PM badge + gold ring
 * ========================================================================= */

const LiveClock: React.FC<{ now: Date }> = ({ now }) => {
  const rawH = now.getHours()
  const isPm = rawH >= 12
  const h12 = ((rawH + 11) % 12) + 1
  const hh = String(h12).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const ss = String(now.getSeconds()).padStart(2, '0')
  const ampm = isPm ? 'PM' : 'AM'
  const timeStr = `${hh}:${mm}:${ss}`

  return (
    <div className="text-center">
      <div
        className="rounded-2xl flex flex-col items-center justify-center"
        style={{
          width: 180,
          height: 180,
          background:
            'linear-gradient(135deg, rgba(212, 160, 23, 0.10) 0%, rgba(212, 160, 23, 0.02) 100%)',
          border: '2px solid var(--gold-mid, #d4a017)',
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,0.04), 0 0 0 4px rgba(212, 160, 23, 0.10)',
        }}
      >
        <span
          className="text-3xl font-bold tabular-nums leading-none"
          style={{
            color: 'var(--gold-light)',
            fontFamily: 'Georgia, "Times New Roman", serif',
            letterSpacing: '0.04em',
            textShadow: '0 1px 0 rgba(0,0,0,0.45)',
          }}
        >
          {timeStr}
        </span>
        <span
          className="text-[11px] font-bold uppercase mt-1 px-2 py-0.5 rounded-full"
          style={{
            color: 'var(--emerald-deep, #064e3b)',
            background:
              'linear-gradient(135deg, var(--gold-mid) 0%, var(--gold-light) 100%)',
            border: '1px solid var(--gold-deep, #9a6b0e)',
            letterSpacing: '0.22em',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45)',
          }}
        >
          {ampm}
        </span>
      </div>
      <p
        className="text-[10px] uppercase font-bold mt-3"
        style={{
          color: 'var(--gold-mid)',
          letterSpacing: '0.22em',
        }}
      >
        Local time
      </p>
    </div>
  )
}

/* ============================================================================
 *  StreakLadder
 * ========================================================================= */

const StreakLadder: React.FC<{ current: number; best: number }> = ({
  current,
  best,
}) => {
  const max = Math.max(best, current, 7)
  const pct = max > 0 ? Math.min(100, (current / max) * 100) : 0

  return (
    <div>
      <div className="flex items-end justify-between mb-3">
        <div>
          <p
            className="text-3xl font-bold tabular-nums"
            style={{
              color: 'var(--gold-light)',
              fontFamily: 'Georgia, "Times New Roman", serif',
            }}
          >
            {current}
            <span
              className="text-base"
              style={{ color: 'var(--text-on-glass)', opacity: 0.7 }}
            >
              {' '}
              days
            </span>
          </p>
          <p
            className="text-[11px]"
            style={{ color: 'var(--text-on-glass)', opacity: 0.6 }}
          >
            personal best: {best}d
          </p>
        </div>
        <Flame
          size={36}
          strokeWidth={1.6}
          style={{ color: 'var(--accent, #f59e0b)', opacity: current > 0 ? 1 : 0.4 }}
        />
      </div>

      <div
        className="relative w-full h-32 rounded-lg overflow-hidden"
        style={{
          background:
            'linear-gradient(180deg, rgba(212, 160, 23, 0.06) 0%, rgba(212, 160, 23, 0.18) 100%)',
          border: '1px solid var(--gold-mid, #d4a017)',
        }}
      >
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="absolute left-0 right-0 border-t"
            style={{
              top: `${(i / 6) * 100}%`,
              borderColor: 'rgba(212, 160, 23, 0.18)',
              borderStyle: 'dashed',
            }}
          />
        ))}
        <div
          className="absolute bottom-0 left-0 right-0 transition-all duration-700"
          style={{
            height: `${pct}%`,
            background:
              'linear-gradient(180deg, var(--accent, #f59e0b) 0%, var(--gold-light) 100%)',
            opacity: 0.85,
          }}
        />
        <div
          className="absolute left-0 right-0 h-px"
          style={{
            bottom: `${pct}%`,
            background: 'var(--manuscript-cream)',
            opacity: 0.6,
          }}
        />
      </div>

      <div className="flex justify-between mt-1">
        <span
          className="text-[10px]"
          style={{ color: 'var(--text-on-glass)', opacity: 0.55 }}
        >
          0
        </span>
        <span
          className="text-[10px]"
          style={{ color: 'var(--text-on-glass)', opacity: 0.55 }}
        >
          {max}
        </span>
      </div>
    </div>
  )
}

/* ============================================================================
 *  QuranJourney
 * ========================================================================= */

const QuranJourney: React.FC<{ sessions: number }> = ({ sessions }) => {
  const pct = Math.min(100, (sessions / 6236) * 100)

  return (
    <div>
      <div className="flex items-end gap-2 mb-3">
        <BookOpen size={32} strokeWidth={1.6} style={{ color: 'var(--gold-mid)' }} />
        <div>
          <p
            className="text-3xl font-bold tabular-nums leading-none"
            style={{
              color: 'var(--gold-light)',
              fontFamily: 'Georgia, "Times New Roman", serif',
            }}
          >
            {sessions}
          </p>
          <p
            className="text-[11px]"
            style={{ color: 'var(--text-on-glass)', opacity: 0.65 }}
          >
            reading sessions logged
          </p>
        </div>
      </div>

      <div
        className="rounded-lg p-3 mb-3"
        style={{
          background:
            'linear-gradient(180deg, rgba(212, 160, 23, 0.10) 0%, rgba(212, 160, 23, 0.02) 100%)',
          border: '1px solid var(--gold-mid, #d4a017)',
        }}
      >
        <div
          className="flex justify-between text-[10px] uppercase font-bold mb-1.5"
          style={{ color: 'var(--gold-mid)', letterSpacing: '0.18em' }}
        >
          <span>Quran coverage</span>
          <span>{pct.toFixed(2)}%</span>
        </div>
        <div
          className="w-full h-2 rounded-full overflow-hidden"
          style={{ background: 'rgba(212, 160, 23, 0.18)' }}
        >
          <div
            className="h-2 rounded-full transition-all duration-700"
            style={{
              width: `${pct}%`,
              background:
                'linear-gradient(90deg, var(--gold-mid) 0%, var(--gold-light) 100%)',
            }}
          />
        </div>
        <p
          className="text-[10px] mt-1.5"
          style={{ color: 'var(--text-on-glass)', opacity: 0.55 }}
        >
          of 6,236 ayahs in the noble Quran
        </p>
      </div>

      <Link
        to="/quran"
        className="inline-flex items-center gap-1 text-xs font-bold uppercase"
        style={{
          color: 'var(--gold-light)',
          letterSpacing: '0.16em',
          textDecoration: 'none',
        }}
      >
        Continue reading <ArrowRight size={12} />
      </Link>
    </div>
  )
}

/* ============================================================================
 *  ChallengesMini
 * ========================================================================= */

const ChallengesMini: React.FC<{
  active: number
  completed: number
  today: number
}> = ({ active, completed, today }) => {
  const total = active + completed
  const pct = total > 0 ? (completed / total) * 100 : 0

  return (
    <div>
      <div className="grid grid-cols-3 gap-2 mb-3">
        {[
          { label: 'Active', value: active, tint: 'rgba(212, 160, 23, 0.08)' },
          { label: 'Done', value: completed, tint: 'rgba(22, 163, 74, 0.10)' },
          { label: 'Today', value: today, tint: 'rgba(245, 158, 11, 0.10)' },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-lg px-2 py-2 text-center"
            style={{
              background: s.tint,
              border: '1px solid var(--gold-mid, #d4a017)',
            }}
          >
            <p
              className="text-2xl font-bold tabular-nums"
              style={{
                color: 'var(--gold-light)',
                fontFamily: 'Georgia, "Times New Roman", serif',
              }}
            >
              {s.value}
            </p>
            <p
              className="text-[9px] uppercase font-bold"
              style={{
                color: 'var(--text-on-glass)',
                opacity: 0.6,
                letterSpacing: '0.18em',
              }}
            >
              {s.label}
            </p>
          </div>
        ))}
      </div>

      <div
        className="rounded-lg p-3 mb-3"
        style={{
          background:
            'linear-gradient(180deg, rgba(212, 160, 23, 0.10) 0%, rgba(212, 160, 23, 0.02) 100%)',
          border: '1px solid var(--gold-mid, #d4a017)',
        }}
      >
        <div
          className="flex justify-between text-[10px] uppercase font-bold mb-1.5"
          style={{ color: 'var(--gold-mid)', letterSpacing: '0.18em' }}
        >
          <span>Completion</span>
          <span>{pct.toFixed(0)}%</span>
        </div>
        <div
          className="w-full h-2 rounded-full overflow-hidden"
          style={{ background: 'rgba(212, 160, 23, 0.18)' }}
        >
          <div
            className="h-2 rounded-full transition-all duration-700"
            style={{
              width: `${pct}%`,
              background:
                'linear-gradient(90deg, var(--emerald, #16a34a) 0%, var(--gold-mid) 100%)',
            }}
          />
        </div>
      </div>

      <Link
        to="/challenges"
        className="inline-flex items-center gap-1 text-xs font-bold uppercase"
        style={{
          color: 'var(--gold-light)',
          letterSpacing: '0.16em',
          textDecoration: 'none',
        }}
      >
        View challenges <ArrowRight size={12} />
      </Link>
    </div>
  )
}

/* ============================================================================
 *  AyahOfTheDay
 * ========================================================================= */

const AyahOfTheDay: React.FC<{ ayah: typeof AYAH_POOL[number] }> = ({ ayah }) => (
  <OrnateCard variant="dark" corners="all" topBar className="!p-6">
    <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-6 items-center">
      <div className="flex flex-col items-center">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center"
          style={{
            background:
              'linear-gradient(135deg, var(--gold-mid) 0%, var(--gold-light) 100%)',
            border: '1px solid var(--gold-deep)',
            boxShadow:
              'inset 0 1px 0 rgba(255,255,255,0.5), 0 4px 12px -4px rgba(154,107,14,0.55)',
            color: 'var(--emerald-deep, #064e3b)',
          }}
        >
          <QuoteIcon size={32} strokeWidth={1.6} />
        </div>
      </div>

      <div className="text-center md:text-left">
        <p
          className="text-[10px] uppercase font-bold mb-3"
          style={{ color: 'var(--gold-mid)', letterSpacing: '0.22em' }}
        >
          Ayah of the day
        </p>
        <p
          dir="rtl"
          className="text-2xl sm:text-3xl leading-loose mb-4"
          style={{
            color: 'var(--text-on-glass)',
            fontFamily:
              '"Amiri", "Scheherazade", "Traditional Arabic", Georgia, serif',
            textShadow: '0 1px 0 rgba(0,0,0,0.45)',
          }}
        >
          {ayah.arabic}
        </p>
        <p
          className="text-base sm:text-lg italic mb-3 max-w-2xl"
          style={{
            color: 'var(--text-on-glass)',
            opacity: 0.92,
            fontFamily: 'Georgia, "Times New Roman", serif',
          }}
        >
          &ldquo;{ayah.en}&rdquo;
        </p>
        <p
          className="text-xs font-bold"
          style={{
            color: 'var(--gold-light)',
            letterSpacing: '0.18em',
          }}
        >
          — {ayah.ref}
        </p>
      </div>
    </div>
  </OrnateCard>
)

/* ============================================================================
 *  AchievementsGrid
 * ========================================================================= */

const AchievementsGrid: React.FC<{
  bestStreak: number
  completionPct: number
  completedWeek: number
  completedMonth: number
  totalSessions: number
}> = ({
  bestStreak,
  completionPct,
  completedWeek,
  completedMonth,
  totalSessions,
}) => {
  const badges = [
    { id: 'streak-7', name: 'Week Warrior', desc: '7-day streak', icon: <Flame size={28} />, earned: bestStreak >= 7 },
    { id: 'streak-30', name: 'Steadfast', desc: '30-day streak', icon: <Zap size={28} />, earned: bestStreak >= 30 },
    { id: 'completion', name: 'Early Bird', desc: 'Today ≥ 80%', icon: <Sunrise size={28} />, earned: completionPct >= 80 },
    { id: 'consistency', name: 'Consistent', desc: 'Best streak ≥ 7d', icon: <Heart size={28} />, earned: bestStreak >= 7 },
    { id: 'marathon', name: 'Marathon', desc: '20 in a month', icon: <Trophy size={28} />, earned: completedMonth >= 20 },
    { id: 'week-21', name: 'Three-a-Day', desc: '21 in a week', icon: <CheckCircle2 size={28} />, earned: completedWeek >= 21 },
    { id: 'quran-1', name: 'Quran Reader', desc: '1st session', icon: <BookOpen size={28} />, earned: totalSessions >= 1 },
    { id: 'quran-10', name: 'Light Seeker', desc: '10 sessions', icon: <Sunset size={28} />, earned: totalSessions >= 10 },
  ]

  const earned = badges.filter((b) => b.earned).length

  return (
    <OrnateCard variant="dark" corners="all" topBar className="!p-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {badges.map((b) => (
          <Medallion
            key={b.id}
            name={b.name}
            desc={b.desc}
            icon={b.icon}
            earned={b.earned}
          />
        ))}
      </div>
      <p
        className="text-xs uppercase font-bold mt-3 text-center"
        style={{ color: 'var(--gold-mid)', letterSpacing: '0.22em' }}
      >
        {earned} / {badges.length} earned
      </p>
    </OrnateCard>
  )
}

/* ============================================================================
 *  Medallion
 * ========================================================================= */

const Medallion: React.FC<{
  name: string
  desc: string
  icon: React.ReactNode
  earned: boolean
}> = ({ name, desc, icon, earned }) => (
  <div
    className="rounded-2xl p-4 text-center relative overflow-hidden transition-transform"
    style={{
      background: earned
        ? 'linear-gradient(135deg, rgba(212, 160, 23, 0.22) 0%, rgba(212, 160, 23, 0.10) 100%)'
        : 'rgba(0, 0, 0, 0.18)',
      border: earned
        ? '1px solid var(--gold-light, #f0c75e)'
        : '1px dashed var(--gold-mid, #d4a017)',
      boxShadow: earned
        ? '0 4px 12px -4px rgba(154,107,14,0.45), inset 0 1px 0 rgba(255,255,255,0.12)'
        : 'none',
      opacity: earned ? 1 : 0.65,
    }}
  >
    <div
      className="w-14 h-14 rounded-full mx-auto mb-2 flex items-center justify-center"
      style={{
        background: earned
          ? 'linear-gradient(135deg, var(--gold-mid) 0%, var(--gold-light) 100%)'
          : 'rgba(212, 160, 23, 0.10)',
        border: '1px solid var(--gold-deep)',
        color: earned ? 'var(--emerald-deep, #064e3b)' : 'var(--gold-mid)',
      }}
    >
      {icon}
    </div>
    <p
      className="text-sm font-bold"
      style={{
        color: earned ? 'var(--gold-light)' : 'var(--manuscript-cream)',
        fontFamily: 'Georgia, serif',
      }}
    >
      {name}
    </p>
    <p
      className="text-[10px] mt-0.5"
      style={{ color: 'var(--text-on-glass)', opacity: 0.6 }}
    >
      {desc}
    </p>
    <span
      className="inline-block mt-2 text-[9px] uppercase font-bold px-2 py-0.5 rounded-full"
      style={{
        background: earned ? 'var(--emerald-deep, #064e3b)' : 'transparent',
        color: earned ? 'var(--gold-light, #f0c75e)' : 'var(--gold-mid)',
        border: earned ? '1px solid var(--gold-deep)' : '1px solid var(--gold-mid)',
        letterSpacing: '0.18em',
      }}
    >
      {earned ? '✓ Earned' : 'Locked'}
    </span>
  </div>
)

/* ============================================================================
 *  QuickActions
 * ========================================================================= */

const QuickActions: React.FC = () => {
  const actions = [
    { to: '/habits', label: 'Habits', desc: 'Track daily deeds', icon: <Target size={20} /> },
    { to: '/prayer-times', label: 'Prayer Times', desc: "Today's salah", icon: <Sun size={20} /> },
    { to: '/quran', label: 'Quran', desc: 'Read & reflect', icon: <BookOpen size={20} /> },
    { to: '/calendar', label: 'Calendar', desc: 'Hijri events', icon: <Calendar size={20} /> },
    { to: '/challenges', label: 'Challenges', desc: 'Long-term goals', icon: <Trophy size={20} /> },
    { to: '/analytics', label: 'Analytics', desc: 'Your trends', icon: <Timer size={20} /> },
  ]

  return (
    <OrnateCard variant="dark" corners="all" topBar className="!p-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {actions.map((a) => (
          <Link
            key={a.to}
            to={a.to}
            className="rounded-xl !p-4 flex flex-col items-center text-center transition-all hover:-translate-y-0.5"
            style={{
              background:
                'linear-gradient(180deg, rgba(212, 160, 23, 0.10) 0%, rgba(212, 160, 23, 0.02) 100%)',
              border: '1px solid var(--gold-mid, #d4a017)',
              color: 'var(--text-on-glass)',
              textDecoration: 'none',
            }}
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center mb-2"
              style={{
                background:
                  'linear-gradient(135deg, var(--gold-mid) 0%, var(--gold-light) 100%)',
                color: 'var(--emerald-deep, #064e3b)',
                border: '1px solid var(--gold-deep)',
              }}
            >
              {a.icon}
            </div>
            <p
              className="text-sm font-bold"
              style={{
                fontFamily: 'Georgia, "Times New Roman", serif',
                color: 'var(--gold-light)',
              }}
            >
              {a.label}
            </p>
            <p
              className="text-[10px] mt-0.5"
              style={{ color: 'var(--text-on-glass)', opacity: 0.7 }}
            >
              {a.desc}
            </p>
            <ChevronRight size={14} className="mt-1" style={{ color: 'var(--gold-mid)' }} />
          </Link>
        ))}
      </div>
    </OrnateCard>
  )
}

/* ============================================================================
 *  HabitSuggestions — first-run onboarding
 * ----------------------------------------------------------------------------
 *  Visible when total_habits === 0 (fresh user). After a successful add,
 *  switches to a "success" view with a clear CTA pointing to the Habit Tracker
 *  so the user can see & track their new habit. Users who dismiss the panel
 *  have their choice remembered in localStorage.
 * ========================================================================= */

const HABIT_SUGGESTIONS_DISMISSED_KEY = 'ilc:habit-suggestions-dismissed'

const HabitSuggestions: React.FC<{ totalHabits: number }> = ({ totalHabits }) => {
  const queryClient = useQueryClient()
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(HABIT_SUGGESTIONS_DISMISSED_KEY) === '1'
  })
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Hide only when user explicitly dismissed (and saved) AND they have habits now
  if (dismissed && totalHabits > 0) return null

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    queryClient.invalidateQueries({ queryKey: ['habits'] })
  }

  const createOne = useMutation<UserHabit, Error, SuggestedHabit>({
    mutationFn: async (suggestion) => {
      const cats = await habitService.getCategories()
      const match = cats.find(
        (c) => c.name_en.toLowerCase() === suggestion.data.categoryName.toLowerCase(),
      )
      if (!match) {
        throw new Error(
          `Category "${suggestion.data.categoryName}" not found. Please contact support.`,
        )
      }
      const payload: CreateHabitData = {
        category_id: match.id,
        name: suggestion.data.name,
        description: suggestion.data.description,
        tracking_type: suggestion.data.tracking_type,
        target_value: suggestion.data.target_value,
        unit: suggestion.data.unit,
      }
      return habitService.createHabit(payload)
    },
    onSuccess: (_habit, suggestion) => {
      setAddedIds((prev) => {
        const next = new Set(prev)
        next.add(suggestion.id)
        return next
      })
      setErrorMsg(null)
      invalidate()
    },
    onError: (err, suggestion) => {
      setErrorMsg(`Could not add "${suggestion.name}": ${err.message}`)
    },
  })

  const addAll = async () => {
    setErrorMsg(null)
    const pending = SUGGESTED_HABITS.filter((s) => !addedIds.has(s.id))
    await Promise.allSettled(
      pending.map((s) => createOne.mutateAsync(s)),
    )
  }

  const handleDismiss = () => {
    setDismissed(true)
    try {
      localStorage.setItem(HABIT_SUGGESTIONS_DISMISSED_KEY, '1')
    } catch {
      /* localStorage unavailable — silently ignore */
    }
  }

  const addedCount = addedIds.size
  const remaining = SUGGESTED_HABITS.filter((s) => !addedIds.has(s.id))
  const justAdded = addedCount > 0

  // ===== Success state: shown after the user adds at least one habit =====
  if (justAdded) {
    return (
      <OrnateCard variant="dark" corners="all" topBar className="!p-6 sm:!p-8">
        <div className="flex items-start gap-4 flex-wrap">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
            style={{
              background: 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)',
              border: '1px solid #15803d',
              color: '#fff',
              boxShadow:
                'inset 0 1px 0 rgba(255,255,255,0.45), 0 4px 10px -4px rgba(21,128,61,0.55)',
            }}
          >
            <CheckCircle2 size={24} strokeWidth={2.5} />
          </div>

          <div className="flex-1 min-w-[220px]">
            <h2
              className="text-xl sm:text-2xl font-bold"
              style={{
                color: 'var(--gold-light)',
                fontFamily: 'Georgia, "Times New Roman", serif',
              }}
            >
              {addedCount === 1
                ? 'Habit added — barakAllahu fiik!'
                : `${addedCount} habits added — barakAllahu fiikum!`}
            </h2>
            <p
              className="text-sm mt-1"
              style={{ color: 'var(--text-on-glass)', opacity: 0.85 }}
            >
              Your new habits are saved and live. Open the Habit Tracker to mark
              them complete and start building your streak.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Link
              to="/prayer-tracker"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs sm:text-sm font-bold uppercase transition-all"
              style={{
                background:
                  'linear-gradient(135deg, var(--gold-mid) 0%, var(--gold-light) 100%)',
                color: 'var(--emerald-deep, #064e3b)',
                border: '1px solid var(--gold-deep)',
                letterSpacing: '0.18em',
                boxShadow:
                  'inset 0 1px 0 rgba(255,255,255,0.5), 0 3px 8px -3px rgba(154,107,14,0.55)',
                textDecoration: 'none',
              }}
            >
              Open Habit Tracker
              <ArrowRight size={14} strokeWidth={2.5} />
            </Link>
            {remaining.length > 0 && (
              <button
                onClick={addAll}
                disabled={createOne.isPending}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-full text-xs font-bold uppercase transition-all disabled:opacity-50"
                style={{
                  background: 'rgba(212, 160, 23, 0.10)',
                  color: 'var(--gold-light)',
                  border: '1px solid var(--gold-mid)',
                  letterSpacing: '0.16em',
                }}
              >
                <Plus size={12} strokeWidth={2.5} />
                Add {remaining.length} more
              </button>
            )}
            <button
              onClick={handleDismiss}
              aria-label="Dismiss suggestions"
              className="inline-flex items-center justify-center w-9 h-9 rounded-full transition-all"
              style={{
                background: 'rgba(255,255,255,0.04)',
                color: 'var(--text-on-glass)',
                border: '1px solid var(--gold-mid)',
              }}
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {remaining.length > 0 && (
          <>
            <div
              className="my-5 h-px"
              style={{
                background:
                  'linear-gradient(90deg, transparent 0%, var(--gold-mid) 50%, transparent 100%)',
                opacity: 0.45,
              }}
            />
            <p
              className="text-[10px] uppercase font-bold mb-3"
              style={{
                color: 'var(--gold-mid)',
                letterSpacing: '0.22em',
              }}
            >
              More suggestions
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {remaining.map((s) => {
                const Icon = s.icon
                const isPending =
                  createOne.isPending && createOne.variables?.id === s.id
                return (
                  <div
                    key={s.id}
                    className="rounded-xl p-4 flex items-start gap-3"
                    style={{
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid var(--gold-mid, #d4a017)',
                    }}
                  >
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                      style={{
                        background: 'rgba(212, 160, 23, 0.12)',
                        border: '1px solid var(--gold-mid)',
                        color: 'var(--gold-light)',
                      }}
                    >
                      <Icon size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p
                          className="text-sm font-bold truncate"
                          style={{
                            color: 'var(--text-on-glass)',
                            fontFamily: 'Georgia, serif',
                          }}
                        >
                          {s.name}
                        </p>
                        <span
                          className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full"
                          style={{
                            background: `${s.categoryColor}33`,
                            color: s.categoryColor,
                            letterSpacing: '0.14em',
                            border: `1px solid ${s.categoryColor}88`,
                          }}
                        >
                          {s.category}
                        </span>
                      </div>
                      <p
                        className="text-[11px] leading-snug"
                        style={{ color: 'var(--text-on-glass)', opacity: 0.7 }}
                      >
                        {s.description}
                      </p>
                    </div>
                    <button
                      onClick={() => createOne.mutate(s)}
                      disabled={isPending}
                      aria-label={`Add ${s.name}`}
                      className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all"
                      style={{
                        background:
                          'linear-gradient(135deg, var(--gold-mid) 0%, var(--gold-light) 100%)',
                        border: '1px solid var(--gold-deep)',
                        color: 'var(--emerald-deep, #064e3b)',
                        boxShadow:
                          'inset 0 1px 0 rgba(255,255,255,0.45), 0 3px 8px -3px rgba(154,107,14,0.55)',
                        opacity: isPending ? 0.65 : 1,
                      }}
                    >
                      {isPending ? (
                        <span
                          className="block w-3 h-3 rounded-full border-2 animate-spin"
                          style={{
                            borderColor: 'var(--emerald-deep)',
                            borderTopColor: 'transparent',
                          }}
                        />
                      ) : (
                        <Plus size={18} strokeWidth={2.5} />
                      )}
                    </button>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </OrnateCard>
    )
  }

  // ===== Initial state: first-run onboarding =====
  return (
    <OrnateCard variant="dark" corners="all" topBar className="!p-6 sm:!p-8">
      <div className="flex items-start justify-between gap-4 mb-2 flex-wrap">
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
            style={{
              background:
                'linear-gradient(135deg, var(--gold-mid) 0%, var(--gold-light) 100%)',
              border: '1px solid var(--gold-deep)',
              color: 'var(--emerald-deep, #064e3b)',
              boxShadow:
                'inset 0 1px 0 rgba(255,255,255,0.45), 0 4px 10px -4px rgba(154,107,14,0.55)',
            }}
          >
            <Sparkles size={20} strokeWidth={2} />
          </div>
          <div>
            <h2
              className="text-xl sm:text-2xl font-bold"
              style={{
                color: 'var(--gold-light)',
                fontFamily: 'Georgia, "Times New Roman", serif',
                letterSpacing: '0.02em',
              }}
            >
              Start your journey
            </h2>
            <p
              className="text-xs sm:text-sm mt-0.5"
              style={{ color: 'var(--text-on-glass)', opacity: 0.78 }}
            >
              Pick a few habits to begin — you can edit, add, or remove these anytime.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={addAll}
            disabled={createOne.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs sm:text-sm font-bold uppercase transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background:
                'linear-gradient(135deg, var(--gold-mid) 0%, var(--gold-light) 100%)',
              color: 'var(--emerald-deep, #064e3b)',
              border: '1px solid var(--gold-deep)',
              letterSpacing: '0.18em',
              boxShadow:
                'inset 0 1px 0 rgba(255,255,255,0.5), 0 3px 8px -3px rgba(154,107,14,0.55)',
            }}
          >
            <Plus size={14} strokeWidth={2.5} />
            {createOne.isPending ? 'Adding…' : 'Add all 6'}
          </button>
          <button
            onClick={handleDismiss}
            aria-label="Dismiss suggestions"
            className="inline-flex items-center justify-center w-9 h-9 rounded-full transition-all"
            style={{
              background: 'rgba(255,255,255,0.04)',
              color: 'var(--text-on-glass)',
              border: '1px solid var(--gold-mid)',
            }}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <div
        className="my-4 h-px"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, var(--gold-mid) 50%, transparent 100%)',
          opacity: 0.45,
        }}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {SUGGESTED_HABITS.map((s) => {
          const Icon = s.icon
          const isPending =
            createOne.isPending && createOne.variables?.id === s.id

          return (
            <div
              key={s.id}
              className="rounded-xl p-4 flex items-start gap-3 transition-all"
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--gold-mid, #d4a017)',
              }}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                style={{
                  background: 'rgba(212, 160, 23, 0.12)',
                  border: '1px solid var(--gold-mid)',
                  color: 'var(--gold-light)',
                }}
              >
                <Icon size={18} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <p
                    className="text-sm font-bold truncate"
                    style={{
                      color: 'var(--text-on-glass)',
                      fontFamily: 'Georgia, serif',
                    }}
                  >
                    {s.name}
                  </p>
                  <span
                    className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full"
                    style={{
                      background: `${s.categoryColor}33`,
                      color: s.categoryColor,
                      letterSpacing: '0.14em',
                      border: `1px solid ${s.categoryColor}88`,
                    }}
                  >
                    {s.category}
                  </span>
                </div>
                <p
                  className="text-[11px] leading-snug"
                  style={{ color: 'var(--text-on-glass)', opacity: 0.7 }}
                >
                  {s.description}
                </p>
              </div>

              <button
                onClick={() => createOne.mutate(s)}
                disabled={isPending}
                aria-label={`Add ${s.name}`}
                className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all disabled:cursor-not-allowed"
                style={{
                  background:
                    'linear-gradient(135deg, var(--gold-mid) 0%, var(--gold-light) 100%)',
                  border: '1px solid var(--gold-deep)',
                  color: 'var(--emerald-deep, #064e3b)',
                  boxShadow:
                    'inset 0 1px 0 rgba(255,255,255,0.45), 0 3px 8px -3px rgba(154,107,14,0.55)',
                  opacity: isPending ? 0.65 : 1,
                }}
              >
                {isPending ? (
                  <span
                    className="block w-3 h-3 rounded-full border-2 animate-spin"
                    style={{
                      borderColor: 'var(--emerald-deep)',
                      borderTopColor: 'transparent',
                    }}
                  />
                ) : (
                  <Plus size={18} strokeWidth={2.5} />
                )}
              </button>
            </div>
          )
        })}
      </div>

      {errorMsg && (
        <p className="mt-4 text-xs text-center" style={{ color: '#fca5a5' }}>
          {errorMsg}
        </p>
      )}

      <p
        className="mt-4 text-[10px] uppercase font-bold text-center"
        style={{
          color: 'var(--gold-mid)',
          letterSpacing: '0.22em',
          opacity: 0.75,
        }}
      >
        Small consistent deeds are the most beloved to Allah
      </p>
    </OrnateCard>
  )
}
