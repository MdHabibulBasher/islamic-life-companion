import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  Flame,
  Heart,
  Quote as QuoteIcon,
  Sunrise,
  Sunset,
  Trophy,
  Zap,
} from 'lucide-react'
import { LoadingSpinner } from '../components/Loading'
import { dashboardService, type DashboardData } from '../services/dashboardService'
import { api } from '../services/api'
import { quranService, type Surah, type Ayah } from '../services/quranService'
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
interface DashboardAyah {
  arabic: string
  en: string
  ref: string
}
/* ============================================================================
 *  Ayah of the Day — fetched from the Quran API, rotates every 10 minutes
 * ========================================================================= */
// Pool of (surah, ayah) pairs to cycle through — all short, well-known verses
const AYAH_ROTATION: Array<{ surah: number; ayah: number; fallback: DashboardAyah }> = [
  { surah: 1, ayah: 1, fallback: { arabic: 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ', en: 'In the name of Allah, the Entirely Merciful, the Especially Merciful.', ref: 'Al-Fatihah 1:1' } },
  { surah: 94, ayah: 6, fallback: { arabic: 'إِنَّ مَعَ ٱلْعُسْرِ يُسْرًا', en: 'Indeed, with hardship comes ease.', ref: 'Ash-Sharh 94:6' } },
  { surah: 65, ayah: 3, fallback: { arabic: 'وَمَن يَتَوَكَّلْ عَلَى ٱللَّهِ فَهُوَ حَسْبُهُۥٓ', en: 'And whoever relies upon Allah — then He is sufficient for him.', ref: 'At-Talaq 65:3' } },
  { surah: 2, ayah: 152, fallback: { arabic: 'فَٱذْكُرُونِىٓ أَذْكُرْكُمْ', en: 'Remember Me; I will remember you.', ref: 'Al-Baqarah 2:152' } },
  { surah: 20, ayah: 114, fallback: { arabic: 'وَقُل رَّبِّ زِدْنِى عِلْمًا', en: 'And say, "My Lord, increase me in knowledge."', ref: 'Ta-Ha 20:114' } },
  { surah: 1, ayah: 2, fallback: { arabic: 'ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ', en: 'All praise is for Allah, Lord of all worlds.', ref: 'Al-Fatihah 1:2' } },
  { surah: 2, ayah: 153, fallback: { arabic: 'إِنَّ ٱللَّهَ مَعَ ٱلصَّٰبِرِينَ', en: 'Indeed, Allah is with the patient.', ref: 'Al-Baqarah 2:153' } },
  { surah: 3, ayah: 139, fallback: { arabic: 'وَلَا تَهِنُوا۟ وَلَا تَحْزَنُوا۟ وَأَنتُمُ ٱلْأَعْلَوْنَ إِن كُنتُم مُّؤْمِنِينَ', en: 'So do not weaken and do not grieve, and you will be superior if you are believers.', ref: 'Aal-E-Imran 3:139' } },
  { surah: 13, ayah: 28, fallback: { arabic: 'أَلَا بِذِكْرِ ٱللَّهِ تَطْمَئِنُّ ٱلْقُلُوبُ', en: 'Unquestionably, by the remembrance of Allah hearts are assured.', ref: "Ar-Ra'd 13:28" } },
  { surah: 40, ayah: 60, fallback: { arabic: 'ٱدْعُونِىٓ أَسْتَجِبْ لَكُمْ', en: 'Call upon Me; I will respond to you.', ref: 'Ghafir 40:60' } },
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
  // Fetch Surahs list (for ayah of the day)
  const surahsQuery = useQuery<Surah[]>({
    queryKey: ['quran-surahs'],
    queryFn: () => quranService.getSurahs(),
    staleTime: 1000 * 60 * 30,
  })
  // Rotate ayah index every 10 minutes
  const [ayahIndex, setAyahIndex] = useState(() => {
    const now = new Date()
    const tenMinSlot = Math.floor((now.getHours() * 60 + now.getMinutes()) / 10)
    return tenMinSlot % AYAH_ROTATION.length
  })
  useEffect(() => {
    const interval = setInterval(() => {
      setAyahIndex((prev) => (prev + 1) % AYAH_ROTATION.length)
    }, 1000 * 60 * 10)
    return () => clearInterval(interval)
  }, [])
  // Fetch the current ayah from the Quran API
  const currentAyahRef = AYAH_ROTATION[ayahIndex]
  const ayahQuery = useQuery<Ayah>({
    queryKey: ['quran-ayah-dashboard', currentAyahRef.surah, currentAyahRef.ayah],
    queryFn: () => quranService.getAyah(currentAyahRef.surah, currentAyahRef.ayah),
    staleTime: 1000 * 60 * 10,
    retry: 1,
  })
  // Build the ayah object for display
  const ayah: DashboardAyah = (() => {
    const fallback = currentAyahRef.fallback
    if (ayahQuery.data) {
      const surah = surahsQuery.data?.find((s) => s.number === currentAyahRef.surah)
      return {
        arabic: ayahQuery.data.text,
        en: ayahQuery.data.translation || fallback.en,
        ref: `${surah?.englishName ?? 'Quran'} ${currentAyahRef.surah}:${currentAyahRef.ayah}`,
      }
    }
    return fallback
  })()
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
  const firstName = user.full_name ? user.full_name.split(' ')[0] : 'Friend'
  return (
    <div className="max-w-[1400px] mx-auto px-4 pb-12 pt-4">
      <DashboardHero
        firstName={firstName}
        hijri={todayQuery.data ?? null}
        ayah={ayah}
        completionPct={completionPct}
        now={new Date()}
      />
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-8 mb-6 sm:mb-12 mt-4 sm:mt-10 px-1">
        <OrnateCard variant="dark" corners="all" topBar className="!p-3 sm:!p-6">
          <CardTitle icon={<Flame size={18} />}>Streak ladder</CardTitle>
          <StreakLadder
            current={habits.current_streak}
            best={habits.best_streak}
          />
        </OrnateCard>
        <OrnateCard variant="dark" corners="all" topBar className="!p-3 sm:!p-6">
          <CardTitle icon={<BookOpen size={18} />}>Quran journey</CardTitle>
          <QuranJourney sessions={quran.total_sessions} />
        </OrnateCard>
        <OrnateCard variant="dark" corners="all" topBar className="!p-3 sm:!p-6">
          <CardTitle icon={<Trophy size={18} />}>Challenges</CardTitle>
          <ChallengesMini
            active={challenges.active}
            completed={challenges.completed}
            today={challenges.completions_today}
          />
        </OrnateCard>
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
  <div className="flex items-center gap-1.5 sm:gap-2 mb-2 sm:mb-3">
    <span style={{ color: 'var(--gold-mid)' }}>{icon}</span>
    <h3
      className="text-xs sm:text-base font-bold uppercase tracking-wide"
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
 *  Hero — compact top section with greeting + ayah of the day
 * ========================================================================= */
interface HeroProps {
  firstName: string
  hijri: HijriToday | null
  ayah: DashboardAyah
  completionPct: number
  now: Date
}
const DashboardHero: React.FC<HeroProps> = ({
  firstName,
  hijri,
  ayah,
  completionPct: _completionPct,
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
      className="overflow-hidden relative !p-0 mb-6 sm:mb-8"
    >
      <div className="px-4 sm:px-8 py-4 sm:py-6">
        {/* Greeting row */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
          <div className="min-w-0 flex-1">
            <p
              className="text-[9px] sm:text-[10px] uppercase font-bold mb-1 sm:mb-2"
              style={{
                color: 'var(--gold-mid, #d4a017)',
                letterSpacing: '0.22em',
              }}
            >
              {greetingCore}
            </p>
            <h1
              className="text-lg sm:text-3xl md:text-4xl font-bold leading-tight mb-1 sm:mb-2 whitespace-nowrap truncate"
              style={{
                color: 'var(--text-on-glass)',
                fontFamily: 'Georgia, "Times New Roman", serif',
                letterSpacing: '0.01em',
                textShadow: '0 2px 0 rgba(0,0,0,0.45)',
              }}
            >
              Assalamu Alaikum, {firstName}
            </h1>
          </div>
          {/* Date + Hijri */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap text-xs sm:text-sm">
            <Calendar size={14} style={{ color: 'var(--gold-mid)' }} />
            <span style={{ color: 'var(--text-on-glass)', opacity: 0.85 }}>
              {dateStr}
            </span>
            <span style={{ color: 'var(--gold-mid)' }}>·</span>
            <span
              className="font-semibold"
              style={{ color: 'var(--gold-light, #f0c75e)' }}
            >
              {hijri ? hijri.hijriDate : 'Loading…'}
            </span>
          </div>
        </div>
        {/* Ayah of the day — compact, right under the greeting */}
        <div
          className="mt-3 sm:mt-4 rounded-xl p-3 sm:p-4"
          style={{
            background: 'rgba(212, 160, 23, 0.06)',
            border: '1px solid var(--gold-mid, #d4a017)',
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <QuoteIcon size={14} style={{ color: 'var(--gold-mid)' }} />
            <p
              className="text-[9px] sm:text-[10px] uppercase font-bold"
              style={{ color: 'var(--gold-mid)', letterSpacing: '0.22em' }}
            >
              Ayah of the day
            </p>
          </div>
          <p
            dir="rtl"
            className="text-base sm:text-2xl leading-loose mb-2 sm:mb-3"
            style={{
              color: 'var(--text-on-glass)',
              fontFamily: '"Amiri", "Scheherazade", "Traditional Arabic", Georgia, serif',
              textShadow: '0 1px 0 rgba(0,0,0,0.45)',
            }}
          >
            {ayah.arabic}
          </p>
          <p
            className="text-xs sm:text-base italic mb-1.5 sm:mb-2"
            style={{
              color: 'var(--text-on-glass)',
              opacity: 0.92,
              fontFamily: 'Georgia, "Times New Roman", serif',
            }}
          >
            &ldquo;{ayah.en}&rdquo;
          </p>
          <p
            className="text-[10px] sm:text-xs font-bold"
            style={{ color: 'var(--gold-light)', letterSpacing: '0.18em' }}
          >
            — {ayah.ref}
          </p>
        </div>
      </div>
    </OrnateCard>
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
      <div className="flex items-end justify-between mb-1 sm:mb-3">
        <div>
          <p
            className="text-sm sm:text-3xl font-bold tabular-nums"
            style={{
              color: 'var(--gold-light)',
              fontFamily: 'Georgia, "Times New Roman", serif',
            }}
          >
            {current}
            <span
              className="text-[10px] sm:text-base"
              style={{ color: 'var(--text-on-glass)', opacity: 0.7 }}
            >
              {' '}
              days
            </span>
          </p>
          <p
            className="text-[9px] sm:text-[11px]"
            style={{ color: 'var(--text-on-glass)', opacity: 0.6 }}
          >
            personal best: {best}d
          </p>
        </div>
        <Flame
          size={18}
          strokeWidth={1.6}
          style={{ color: 'var(--accent, #f59e0b)', opacity: current > 0 ? 1 : 0.4 }}
        />
      </div>
      <div
        className="relative w-full h-16 sm:h-32 rounded-lg overflow-hidden"
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
      <div className="flex items-end gap-1 sm:gap-2 mb-1 sm:mb-3">
        <BookOpen size={12} strokeWidth={1.6} style={{ color: 'var(--gold-mid)' }} />
        <div>
          <p
            className="text-xs sm:text-3xl font-bold tabular-nums leading-none"
            style={{
              color: 'var(--gold-light)',
              fontFamily: 'Georgia, "Times New Roman", serif',
            }}
          >
            {sessions}
          </p>
          <p
            className="text-[8px] sm:text-[11px]"
            style={{ color: 'var(--text-on-glass)', opacity: 0.65 }}
          >
            reading sessions logged
          </p>
        </div>
      </div>
      <div
        className="rounded-lg p-1 sm:p-3 mb-1 sm:mb-3"
        style={{
          background:
            'linear-gradient(180deg, rgba(212, 160, 23, 0.10) 0%, rgba(212, 160, 23, 0.02) 100%)',
          border: '1px solid var(--gold-mid, #d4a017)',
        }}
      >
        <div
          className="flex justify-between text-[8px] sm:text-[10px] uppercase font-bold mb-0.5 sm:mb-1.5"
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
          className="text-[8px] sm:text-[10px] mt-0.5 sm:mt-1.5"
          style={{ color: 'var(--text-on-glass)', opacity: 0.55 }}
        >
          of 6,236 ayahs
        </p>
      </div>
      <Link
        to="/quran"
        className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-bold uppercase"
        style={{
          color: 'var(--gold-light)',
          letterSpacing: '0.16em',
          textDecoration: 'none',
        }}
      >
        Continue reading <ArrowRight size={10} />
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
      <div className="grid grid-cols-3 gap-1 sm:gap-2 mb-1.5 sm:mb-3">
        {[
          { label: 'Active', value: active, tint: 'rgba(212, 160, 23, 0.08)' },
          { label: 'Done', value: completed, tint: 'rgba(22, 163, 74, 0.10)' },
          { label: 'Today', value: today, tint: 'rgba(245, 158, 11, 0.10)' },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-lg px-1 sm:px-2 py-1 sm:py-2 text-center"
            style={{
              background: s.tint,
              border: '1px solid var(--gold-mid, #d4a017)',
            }}
          >
            <p
              className="text-sm sm:text-2xl font-bold tabular-nums"
              style={{
                color: 'var(--gold-light)',
                fontFamily: 'Georgia, "Times New Roman", serif',
              }}
            >
              {s.value}
            </p>
            <p
              className="text-[7px] sm:text-[9px] uppercase font-bold"
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
        className="rounded-lg p-1 sm:p-3 mb-1.5 sm:mb-3"
        style={{
          background:
            'linear-gradient(180deg, rgba(212, 160, 23, 0.10) 0%, rgba(212, 160, 23, 0.02) 100%)',
          border: '1px solid var(--gold-mid, #d4a017)',
        }}
      >
        <div
          className="flex justify-between text-[8px] sm:text-[10px] uppercase font-bold mb-0.5 sm:mb-1.5"
          style={{ color: 'var(--gold-mid)', letterSpacing: '0.18em' }}
        >
          <span>Completion</span>
          <span>{pct.toFixed(0)}%</span>
        </div>
        <div
          className="w-full h-1.5 sm:h-2 rounded-full overflow-hidden"
          style={{ background: 'rgba(212, 160, 23, 0.18)' }}
        >
          <div
            className="h-1.5 sm:h-2 rounded-full transition-all duration-700"
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
        className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-bold uppercase"
        style={{
          color: 'var(--gold-light)',
          letterSpacing: '0.16em',
          textDecoration: 'none',
        }}
      >
        View challenges <ArrowRight size={10} />
      </Link>
    </div>
  )
}
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
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
    className="rounded-2xl p-3 sm:p-4 text-center relative overflow-hidden transition-transform"
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
      className="w-12 h-12 sm:w-14 sm:h-14 rounded-full mx-auto mb-2 flex items-center justify-center"
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
      className="text-xs sm:text-sm font-bold"
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
