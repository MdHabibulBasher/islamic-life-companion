// PrayerTracker.tsx
// ============================================================================
// Page-level prayer tracker. Two layers of truth, with the Prayer Row
// driving the Qada section as a mirror.
//
//   1. Prayer Row toggle (per day) — "Prayed on time"
//      ── Lives in `prayer_tracking` table (one row per prayer per date)
//      ── Flipping the row writes /prayer-tracking/track
//      ── THIS is the canonical source of truth for "did the user pray
//         this prayer on this day?". Toggling a row from unchecked →
//         checked writes a `track_check` qada event (delta = -1);
//         toggling it from checked → unchecked writes a `track_uncheck`
//         event (delta = +1). The lifetime `prayer_qada` counters stay
//         in sync.
//
//   2. Qada Section (per single day) — mirror of the Prayer Row
//      ── The Qada card on the daily view ALWAYS shows all 5 prayers.
//      ── "Owed" for a given prayer = the corresponding Prayer Row is
//         unchecked (or absent) for the visible day. "Caught up" = the
//         row is checked. The card is fully derived from the same
//         `prayer_tracking` rows the Prayer Row uses, so both surfaces
//         stay in lockstep automatically.
//      ── "Mark complete" on a Qada tile does the same thing as tapping
//         the Prayer Row checkbox for that prayer: it sets
//         `is_completed = true` (with `completed_at = now`) so the
//         Stats / streak layer records the makeup. The Qada tile then
//         flips to "Caught up".
//      ── Un-ticking a Prayer Row makes the prayer reappear in Qada
//         (since it's now marked missed). The user can then mark it
//         caught up again via the Qada tile.
//
//   3. Lifetime snapshot
//      ── `prayer_qada` table holds `owed_count` and `made_up_count`
//         rolled up from the audit log for performance.
//      ── Used in the Stats view's hero strip and per-prayer breakdown.
//      ── NOT shown on the daily view (per the user spec).
// ============================================================================
import React, { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle2,
  Circle,
  Flame,
  Trophy,
  BarChart3,
  Sun,
  Sunset,
  Moon,
  Sunrise,
  CloudMoon,
  Info,
  Users,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Clock,
  TrendingUp,
  Check,
  Calendar as CalendarIcon,
  RotateCcw,
} from 'lucide-react'
import { Modal } from '../components/Modal'
import { useToast } from '../components/Toast'
import { OrnateCard } from '../components/IslamicOrnamentBG'
import { useTheme } from '../contexts/ThemeContext'
import {
  prayerTrackingService,
  PrayerName,
  PRAYER_ORDER,
  CalculationMethod,
  JuristicMethod,
  type DayTrackingResponse,
  type DayPrayerStatus,
  type PrayerSettings,
} from '../services/prayerTrackingService'
import { prayerTimesService } from '../services/prayerTimesService'
import { format12Hour } from '../utils'

// ============================================================================
// Per-prayer tint — driven by the active theme so each theme gets its own
// subtle palette variation. Uses inline `style` gradients (not Tailwind
// arbitrary classes) because the values are runtime-constructed and Tailwind
// JIT cannot see `from-[${light}]` at build time.
// ============================================================================
function usePrayerTints(): Record<PrayerName, { tint: string; ink: string; icon: React.ReactNode }> {
  const { meta } = useTheme()
  const accent = meta.swatches.accent
  const light = meta.swatches.light
  // Returns a CSS `linear-gradient` string for the left edge accent strip.
  return {
    [PrayerName.FAJR]: {
      tint: `linear-gradient(180deg, ${light} 0%, ${accent} 50%, ${light} 100%)`,
      ink: 'text-brand-primary',
      icon: <Sunrise size={20} />,
    },
    [PrayerName.DHUHR]: {
      tint: `linear-gradient(180deg, ${light} 0%, ${accent} 50%, ${accent}33 100%)`,
      ink: 'text-brand-primary',
      icon: <Sun size={20} />,
    },
    [PrayerName.ASR]: {
      tint: `linear-gradient(180deg, ${accent}26 0%, ${accent} 50%, ${light} 100%)`,
      ink: 'text-brand-primary',
      icon: <Sunset size={20} />,
    },
    [PrayerName.MAGHRIB]: {
      tint: `linear-gradient(180deg, ${accent}40 0%, ${accent} 50%, ${light} 100%)`,
      ink: 'text-brand-primary',
      icon: <CloudMoon size={20} />,
    },
    [PrayerName.ISHA]: {
      tint: `linear-gradient(180deg, rgba(30,36,30,0.10) 0%, ${accent} 50%, ${light} 100%)`,
      ink: 'text-brand-primary',
      icon: <Moon size={20} />,
    },
  }
}

const getLocalDate = (): string => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

const greeting = (): string => {
  const h = new Date().getHours()
  if (h < 5) return 'Late night'
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  if (h < 21) return 'Good evening'
  return 'Good night'
}

const formatDateLabel = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

interface DayTone {
  bg: string
  border: string
  text: string
  sub: string
}
const dayCompletionTone = (count: number): DayTone => {
  if (count === 0) {
    return {
      bg: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)',
      border: 'var(--gold-mid)',
      text: 'var(--manuscript-cream, #fbf3df)',
      sub: 'var(--gold-mid)',
    }
  }
  if (count <= 2) {
    return {
      bg: 'linear-gradient(180deg, rgba(212,160,23,0.14) 0%, rgba(154,107,14,0.05) 100%)',
      border: 'var(--gold-deep)',
      text: 'var(--manuscript-cream, #fbf3df)',
      sub: 'var(--gold-mid)',
    }
  }
  if (count <= 4) {
    return {
      bg: 'linear-gradient(180deg, rgba(240,199,94,0.18) 0%, rgba(212,160,23,0.08) 100%)',
      border: 'var(--gold-mid)',
      text: 'var(--manuscript-cream, #fbf3df)',
      sub: 'var(--gold-mid)',
    }
  }
  return {
    bg: 'linear-gradient(135deg, var(--gold-mid) 0%, var(--gold-light) 100%)',
    border: 'var(--gold-deep)',
    text: 'var(--emerald-deep)',
    sub: 'var(--gold-deep)',
  }
}

const PRAYER_LABEL: Record<PrayerName, string> = {
  [PrayerName.FAJR]: 'Fajr',
  [PrayerName.DHUHR]: 'Dhuhr',
  [PrayerName.ASR]: 'Asr',
  [PrayerName.MAGHRIB]: 'Maghrib',
  [PrayerName.ISHA]: 'Isha',
}

const PRAYER_SUBTITLE: Record<PrayerName, string> = {
  [PrayerName.FAJR]: 'Dawn · Begin with light',
  [PrayerName.DHUHR]: 'Midday · Pause & reconnect',
  [PrayerName.ASR]: 'Afternoon · Stay the course',
  [PrayerName.MAGHRIB]: 'Sunset · Close with gratitude',
  [PrayerName.ISHA]: 'Night · Rest in remembrance',
}

const GlassCard: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div
    className={`rounded-2xl backdrop-blur-md border shadow-[0_2px_24px_-16px_rgba(0,0,0,0.4)] ${className}`}
    style={{
      background: 'rgba(6, 30, 25, 0.78)',
      borderColor: 'var(--gold-mid)',
    }}
  >
    {children}
  </div>
)

// ============================================================================
// PrayerReferenceCard — first row of the dashboard.
// Shows each prayer's time window (start → end). Visually rhymes with
// the Qada tile so the two sections feel like one — circle indicator
// on the left, prayer name + time, with a small "in congregation"
// icon on the right (mirroring the Jamaa'ah button in the Prayer Row).
// ============================================================================
const PrayerReferenceCard: React.FC<{
  prayer: PrayerName
  startTime: string | null | undefined
  endTime: string | null | undefined
  icon: React.ReactNode
}> = ({ prayer, startTime, endTime, icon }) => {
  const ref = PRAYER_REFERENCE[prayer]
  return (
    <div
      className="group relative rounded-xl overflow-hidden transition-all duration-300"
      style={{
        background:
          'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',
        border: '1px solid var(--gold-mid)',
      }}
    >
      <div className="p-2 sm:p-3 flex items-center gap-2 sm:gap-3">
        {/* Circle indicator on the left — echoes the Prayer Row's
            checkbox and the Qada tile's outlined circle. */}
        <div
          className="shrink-0 w-7 h-7 sm:w-9 sm:h-9 inline-flex items-center justify-center rounded-full"
          style={{
            background: 'transparent',
            border: '2px solid var(--gold-mid)',
            color: 'var(--gold-mid)',
            boxShadow: '0 0 0 1px rgba(0,0,0,0.25) inset',
          }}
          aria-hidden="true"
        >
          {icon}
        </div>

        <div className="flex-1 min-w-0">
          <div
            className="text-xs sm:text-sm font-bold leading-tight"
            style={{
              color: 'var(--manuscript-cream, #fbf3df)',
              fontFamily: 'Georgia, "Times New Roman", serif',
            }}
          >
            {PRAYER_LABEL[prayer]}
          </div>
          <div className="mt-0.5 flex items-center gap-1 sm:gap-1.5 whitespace-nowrap">
            <Clock size={9} className="shrink-0 sm:hidden" style={{ color: 'var(--gold-mid)' }} />
            <Clock size={11} className="shrink-0 hidden sm:block" style={{ color: 'var(--gold-mid)' }} />
            <span
              className="text-[9px] sm:text-xs font-semibold tabular-nums"
              style={{ color: 'var(--manuscript-cream, #fbf3df)' }}
            >
              {format12Hour(startTime)}
            </span>
            <span className="text-[8px] sm:text-[10px]" style={{ color: 'var(--gold-mid)' }}>→</span>
            <span
              className="text-[9px] sm:text-xs font-semibold tabular-nums"
              style={{ color: 'var(--manuscript-cream, #fbf3df)' }}
            >
              {format12Hour(endTime)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// Progress ring — uses inline color so it tracks the theme's primary token.
// ============================================================================
// Prayer reference — duas & masail for the first row of the dashboard.
// ============================================================================
interface PrayerReference {
  dua: { arabic: string; transliteration: string; translation: string }
  masala: string
  hint: string
}

const PRAYER_REFERENCE: Record<PrayerName, PrayerReference> = {
  [PrayerName.FAJR]: {
    dua: {
      arabic: 'اللَّهُمَّ بِكَ أَصْبَحْنَا وَبِكَ أَمْسَيْنَا',
      transliteration: "Allahumma bika asbahna wa bika amsayna",
      translation: 'O Allah, by Your leave we have reached the morning and by Your leave we have reached the evening.',
    },
    masala:
      'Fajr is prayed in two rak‘at sunnah mu’akkadah followed by two rak‘at fard. Its time begins at true dawn (Subh Saadiq) and ends at sunrise; missing it is a major sin.',
    hint: 'Dawn — begin the day with light',
  },
  [PrayerName.DHUHR]: {
    dua: {
      arabic: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ بِهِ وَأَسْأَلُكَ بِأَسْمَائِكَ الْحُسْنَى',
      transliteration: 'Allahumma inni as\'aluka bihi wa as\'aluka bi-asma\'ikal husna',
      translation: 'O Allah, I ask You by it and I ask You by Your Most Beautiful Names.',
    },
    masala:
      'Four rak‘at sunnah mu’akkadah precede the four fard of Dhuhr. Its window opens at zawal (when the sun passes the meridian) and closes when Asr begins.',
    hint: 'Midday — pause and reconnect',
  },
  [PrayerName.ASR]: {
    dua: {
      arabic: 'رَبِّ قِنِي عَذَابَكَ يَوْمَ تَبْعَثُ عِبَادَكَ',
      transliteration: "Rabbi qini 'adhabaka yawma tab'athu 'ibadak",
      translation: 'My Lord, protect me from Your punishment on the Day Your servants are raised.',
    },
    masala:
      'Asr is the prayer most often missed — "al-salat al-wusta" (Qur\'an 2:238). Observed from when shadow equals object length until sunset.',
    hint: 'Afternoon — stay the course',
  },
  [PrayerName.MAGHRIB]: {
    dua: {
      arabic: 'اللَّهُمَّ أَعِنِّي عَلَى ذِكْرِكَ وَشُكْرِكَ وَحُسْنِ عِبَادَتِكَ',
      transliteration: "Allahumma a'inni 'ala dhikrika wa shukrika wa husni 'ibadatik",
      translation: 'O Allah, help me to remember You, to thank You, and to worship You well.',
    },
    masala:
      'Maghrib is three fard immediately after the adhan at sunset. Its time is short — traditionally until the red twilight fades — so it should not be delayed.',
    hint: 'Sunset — close with gratitude',
  },
  [PrayerName.ISHA]: {
    dua: {
      arabic: 'اللَّهُمَّ بِكَ أَمْسَيْنَا وَبِكَ أَصْبَحْنَا وَبِكَ نَحْيَا وَبِكَ نَمُوتُ',
      transliteration: "Allahumma bika amsayna wa bika asbahna wa bika nahya wa bika namutu",
      translation: 'O Allah, by Your leave we have reached the evening and the morning; by You we live and by You we die.',
    },
    masala:
      'Isha consists of four fard and is recommended to be prayed before midnight. After it comes Witr (odd-numbered, wajib in the Hanafi school).',
    hint: 'Night — rest in remembrance',
  },
}

// ============================================================================
// PrayerRow — the per-day "Prayed on time" check-off.
// Toggling writes to /prayer-tracking/track for the visible day.
// Completely independent of the Qada flow (see header comment).
// ============================================================================
const PrayerRow: React.FC<{
  status: DayPrayerStatus
  onToggle: () => void
  onToggleJamaaah: () => void
  trackJamaaah: boolean
  disabled: boolean
  tints: Record<PrayerName, { tint: string; ink: string; icon: React.ReactNode }>
}> = ({ status, onToggle, onToggleJamaaah, trackJamaaah, disabled, tints }) => {
  const meta = tints[status.prayer_name]
  const done = status.is_completed
  return (
    <div
      className="group relative overflow-hidden rounded-2xl transition-all duration-300"
      style={
        done
          ? {
              background:
                'linear-gradient(180deg, rgba(6, 30, 25, 0.78) 0%, rgba(6, 30, 25, 0.78) 100%)',
              border: '1px solid var(--gold-mid)',
              boxShadow: '0 4px 24px -12px rgba(0,0,0,0.4)',
              backdropFilter: 'blur(24px) saturate(1.5)',
              WebkitBackdropFilter: 'blur(24px) saturate(1.5)',
            }
          : {
              background: 'rgba(6, 30, 25, 0.78)',
              border: '1px solid var(--gold-mid)',
              backdropFilter: 'blur(24px) saturate(1.5)',
              WebkitBackdropFilter: 'blur(24px) saturate(1.5)',
            }
      }
    >
      <div className="flex items-center gap-2 sm:gap-4 p-2.5 sm:p-4 sm:pl-6">
        <button
          onClick={onToggle}
          disabled={disabled}
          className="relative flex-shrink-0 focus:outline-none disabled:opacity-50"
          aria-label={`Mark ${PRAYER_LABEL[status.prayer_name]} as ${done ? 'not completed' : 'completed'}`}
        >
          {done ? (
            <CheckCircle2 size={28} className="sm:hidden" style={{ color: 'var(--gold-mid)' }} strokeWidth={2} />
          ) : (
            <Circle size={28} className="sm:hidden" style={{ color: 'var(--gold-mid, #d4a017)', opacity: 0.5 }} />
          )}
          {done ? (
            <CheckCircle2 size={40} className="hidden sm:block" style={{ color: 'var(--gold-mid)' }} strokeWidth={2} />
          ) : (
            <Circle size={40} className="hidden sm:block" style={{ color: 'var(--gold-mid, #d4a017)', opacity: 0.5 }} />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
            <span className="hidden sm:inline" style={{ color: 'var(--gold-mid)' }}>{meta.icon}</span>
            <h3
              className="text-sm sm:text-lg font-bold"
              style={{
                color: 'var(--manuscript-cream, #fbf3df)',
                fontFamily: 'Georgia, "Times New Roman", serif',
              }}
            >
              {PRAYER_LABEL[status.prayer_name]}
            </h3>
            {status.scheduled_time && (
              <span
                className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase"
                style={{
                  background: 'rgba(0,0,0,0.25)',
                  color: 'var(--gold-mid)',
                  border: '1px solid var(--gold-mid)',
                  letterSpacing: '0.16em',
                }}
              >
                <Clock size={10} /> {format12Hour(status.scheduled_time)}
              </span>
            )}
            {status.scheduled_time && (
              <span
                className="sm:hidden text-[10px] font-semibold tabular-nums"
                style={{ color: 'var(--gold-mid)' }}
              >
                {format12Hour(status.scheduled_time)}
              </span>
            )}
            {done && (
              <span
                className="inline-flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-semibold uppercase"
                style={{
                  background:
                    'linear-gradient(135deg, var(--gold-mid) 0%, var(--gold-light) 100%)',
                  color: 'var(--emerald-deep)',
                  border: '1px solid var(--gold-deep)',
                  letterSpacing: '0.16em',
                }}
              >
                <Check size={9} className="sm:hidden" />
                <Check size={10} className="hidden sm:inline" />
                <span className="hidden sm:inline">Done</span>
              </span>
            )}
            {status.is_jamaaah && done && (
              <span
                className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase"
                style={{
                  background: 'rgba(212,160,23,0.20)',
                  color: 'var(--manuscript-cream, #fbf3df)',
                  border: '1px solid var(--gold-mid)',
                  letterSpacing: '0.16em',
                }}
              >
                Jamaa&rsquo;ah
              </span>
            )}
          </div>
          <p className="hidden sm:block text-xs mt-0.5" style={{ color: 'var(--gold-mid)' }}>
            {PRAYER_SUBTITLE[status.prayer_name]}
          </p>
        </div>

        {trackJamaaah && (
          <button
            onClick={onToggleJamaaah}
            disabled={disabled || !done}
            className="inline-flex items-center justify-center w-7 h-7 sm:w-auto sm:h-auto sm:gap-1 sm:px-3 sm:py-1.5 rounded-full text-xs font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
            style={
              status.is_jamaaah
                ? {
                    background:
                      'linear-gradient(135deg, var(--gold-mid) 0%, var(--gold-light) 100%)',
                    color: 'var(--emerald-deep)',
                    border: '1px solid var(--gold-deep)',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                  }
                : done
                ? {
                    background: 'rgba(212,160,23,0.10)',
                    color: 'var(--gold-mid)',
                    border: '1px solid var(--gold-mid)',
                  }
                : {
                    background: 'rgba(0,0,0,0.25)',
                    color: 'var(--manuscript-cream, #fbf3df)',
                    border: '1px solid var(--gold-mid)',
                    opacity: 0.5,
                  }
            }
            title="Mark as prayed in congregation"
            aria-label="Mark as prayed in congregation"
          >
            <Users size={12} />
            <span className="hidden sm:inline">Jamaa&rsquo;ah</span>
          </button>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// QadaTile — single prayer's per-day qada control.
//
// Concept (per user spec):
//   • The Qada card is a mirror of the daily Prayer Row. A tile is
//     rendered for a prayer exactly when its Prayer Row is unchecked
//     (or absent) for the visible day; tiles for already-caught-up
//     prayers are filtered out at the grid level (so this component
//     only ever renders tiles for prayers that still owe a makeup).
//   • "Mark complete" routes through `handleToggle` so the Prayer
//     Row and the Qada tile flip in lockstep. The backend writes a
//     `track_check` qada event with `delta = -1`.
//   • Undo (4-second window after marking complete): a quick way to
//     recover from a stray tap. Re-uses the Prayer Row toggle path,
//     which the backend mirrors with a `track_uncheck` qada event.
// ============================================================================
const QadaTile: React.FC<{
  prayer: PrayerName
  count: number // per-day outstanding count for the visible day (0 or 1)
  onCompleted: () => void
  onUndo: () => void
  disabled: boolean
}> = ({ prayer, count, onCompleted, onUndo, disabled }) => {
  const [justTicked, setJustTicked] = useState(false)
  const undoTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  // Clear the undo window if the underlying count changes (e.g. after a
  // refetch) or the component unmounts.
  useEffect(() => {
    return () => {
      if (undoTimer.current) clearTimeout(undoTimer.current)
    }
  }, [])

  useEffect(() => {
    setJustTicked(false)
    if (undoTimer.current) clearTimeout(undoTimer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, prayer])

  const armUndo = () => {
    if (undoTimer.current) clearTimeout(undoTimer.current)
    undoTimer.current = setTimeout(() => setJustTicked(false), 4000)
  }

  // The tile is only rendered for prayers that still owe a makeup
  // (the Qada grid filters out caught-up prayers), so we know the
  // count is always 1 here. The undo window, however, applies
  // briefly after the user taps "Mark complete" — during which
  // the tile stays visible so the user can recover from a stray
  // tap before the refetch re-renders the grid without it.
  const showUndo = justTicked

  const handlePrimary = () => {
    if (disabled) return
    onCompleted()
    setJustTicked(true)
    armUndo()
  }

  const handleUndo = () => {
    if (disabled) return
    onUndo()
    setJustTicked(false)
    if (undoTimer.current) clearTimeout(undoTimer.current)
  }

  return (
    <div
      className="relative rounded-xl overflow-hidden"
      style={{
        background:
          'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',
        border: '1px solid var(--gold-mid)',
      }}
    >
      <div className="p-2 sm:p-4 text-center">
        <div
          className="text-[10px] sm:text-sm font-bold"
          style={{
            color: 'var(--text-on-dark-glass)',
            fontFamily: 'Georgia, "Times New Roman", serif',
          }}
        >
          {PRAYER_LABEL[prayer]}
        </div>
        <div
          className="text-xl sm:text-3xl font-bold mt-1 sm:mt-2 mb-0.5 sm:mb-1 tabular-nums leading-none"
          style={{
            color: 'var(--gold-glow)',
            fontFamily: 'Georgia, "Times New Roman", serif',
          }}
        >
          {count}
        </div>
        <div
          className="text-[8px] sm:text-[10px] uppercase font-semibold mb-1.5 sm:mb-3"
          style={{ color: 'var(--gold-mid)', letterSpacing: '0.18em' }}
        >
          owed
        </div>

        {showUndo ? (
          <button
            type="button"
            onClick={handleUndo}
            disabled={disabled}
            className="w-full inline-flex items-center justify-center gap-0.5 sm:gap-1.5 px-1.5 sm:px-3 py-1 sm:py-2 rounded-full text-[9px] sm:text-xs font-bold transition disabled:opacity-50 border"
            style={{
              background: 'rgba(0,0,0,0.25)',
              color: 'var(--text-on-dark-glass)',
              border: '1px solid var(--gold-deep)',
              letterSpacing: '0.16em',
            }}
            title="Undo — put this prayer back as missed"
          >
            <RotateCcw size={9} className="sm:hidden" />
            <RotateCcw size={12} className="hidden sm:block" /> <span className="sm:hidden">Undo</span><span className="hidden sm:inline">Undo</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handlePrimary}
            disabled={disabled}
            className="w-full inline-flex items-center justify-center gap-0.5 sm:gap-1.5 px-1.5 sm:px-3 py-1 sm:py-2 rounded-full text-[9px] sm:text-xs font-bold transition disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background:
                'linear-gradient(135deg, var(--gold-mid) 0%, var(--gold-light) 100%)',
              color: 'var(--emerald-deep)',
              border: '1px solid var(--gold-deep)',
              boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
              letterSpacing: '0.16em',
            }}
            title="Mark this missed prayer as made up"
          >
            <Check size={9} className="sm:hidden" />
            <Check size={12} className="hidden sm:block" /> <span className="sm:hidden">Mark</span><span className="hidden sm:inline">Mark complete</span>
          </button>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Settings modal
// ============================================================================
const SettingsModal: React.FC<{
  isOpen: boolean
  onClose: () => void
  settings?: PrayerSettings
}> = ({ isOpen, onClose, settings }) => {
  const queryClient = useQueryClient()
  const { success, error } = useToast()
  const [draft, setDraft] = useState<PrayerSettings | null>(settings ?? null)

  useEffect(() => {
    setDraft(settings ?? null)
  }, [settings, isOpen])

  const mutation = useMutation({
    mutationFn: (payload: Partial<PrayerSettings>) => prayerTrackingService.updateSettings(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prayerSettings'] })
      success('Settings updated')
      onClose()
    },
    onError: () => error('Failed to update settings'),
  })

  if (!draft) return null

  const labelCls = 'block text-[10px] font-bold uppercase mb-1.5'
  const inputStyle: React.CSSProperties = {
    background: 'rgba(0, 0, 0, 0.30)',
    color: 'var(--emerald-deep)',
    border: '1px solid var(--gold-mid)',
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Prayer Tracker Settings" size="lg">
      <div className="space-y-3">
        <div>
          <label className={labelCls} style={{ color: 'var(--gold-deep)' }}>
            Calculation Method
          </label>
          <select
            value={draft.calculation_method}
            onChange={(e) =>
              setDraft({ ...draft, calculation_method: e.target.value as CalculationMethod })
            }
            className="w-full px-3 py-1.5 rounded-xl focus:ring-2 focus:outline-none transition"
            style={inputStyle}
          >
            <option value={CalculationMethod.ISNA}>ISNA (North America)</option>
            <option value={CalculationMethod.MWL}>Muslim World League</option>
            <option value={CalculationMethod.EGYPT}>Egyptian General Authority</option>
            <option value={CalculationMethod.KARACHI}>Karachi</option>
            <option value={CalculationMethod.MAKKAH}>Umm al-Qura (Makkah)</option>
            <option value={CalculationMethod.CUSTOM}>Custom (advanced)</option>
          </select>
        </div>
        <div>
          <label className={labelCls} style={{ color: 'var(--gold-deep)' }}>
            Juristic Method (Asr)
          </label>
          <select
            value={draft.juristic_method}
            onChange={(e) =>
              setDraft({ ...draft, juristic_method: e.target.value as JuristicMethod })
            }
            className="w-full px-3 py-1.5 rounded-xl focus:ring-2 focus:outline-none transition"
            style={inputStyle}
          >
            <option value={JuristicMethod.SHAFI}>Shafi (earlier Asr)</option>
            <option value={JuristicMethod.HANAFI}>Hanafi (later Asr)</option>
          </select>
        </div>
        <div>
          <label className={labelCls} style={{ color: 'var(--gold-deep)' }}>
            Reminder minutes before prayer
          </label>
          <input
            type="number"
            min={0}
            max={60}
            value={draft.reminder_minutes_before}
            onChange={(e) =>
              setDraft({ ...draft, reminder_minutes_before: Number(e.target.value) })
            }
            className="w-full px-3 py-1.5 rounded-xl focus:ring-2 focus:outline-none transition"
            style={inputStyle}
          />
        </div>
        <div className="flex flex-col gap-2 pt-1 w-full">
          <ToggleTile
            label="Notifications"
            description="Prayer-time alerts"
            checked={draft.notifications_enabled}
            onChange={(v) => setDraft({ ...draft, notifications_enabled: v })}
          />
          <ToggleTile
            label="Jamaa'ah"
            description="Track congregational"
            checked={draft.track_jamaaah}
            onChange={(v) => setDraft({ ...draft, track_jamaaah: v })}
          />
          <ToggleTile
            label="Qada"
            description="Makeup prayers"
            checked={draft.track_qada}
            onChange={(v) => setDraft({ ...draft, track_qada: v })}
          />
        </div>
        <div
          className="flex justify-end gap-2 pt-3 mt-1"
          style={{ borderTop: '1px solid var(--gold-mid)' }}
        >
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold rounded-xl transition"
            style={{
              background:
                'linear-gradient(180deg, var(--manuscript-cream) 0%, var(--manuscript-cream-2) 100%)',
              color: 'var(--gold-deep)',
              border: '1px solid var(--gold-mid)',
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate(draft)}
            disabled={mutation.isPending}
            className="px-4 py-2 text-sm font-semibold rounded-xl disabled:opacity-50 transition"
            style={{
              background:
                'linear-gradient(135deg, var(--gold-mid) 0%, var(--gold-light) 100%)',
              color: 'var(--emerald-deep)',
              border: '1px solid var(--gold-deep)',
              boxShadow: '0 2px 8px -4px rgba(0,0,0,0.3)',
            }}
          >
            {mutation.isPending ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

const ToggleTile: React.FC<{
  label: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
}> = ({ label, description, checked, onChange }) => (
  <label
    className="cursor-pointer rounded-xl px-4 py-3 transition flex items-center justify-between gap-4 w-full"
    style={
      checked
        ? {
            background:
              'linear-gradient(180deg, rgba(212,160,23,0.20) 0%, rgba(154,107,14,0.08) 100%)',
            border: '1px solid var(--gold-deep)',
          }
        : {
            background:
              'linear-gradient(180deg, var(--manuscript-cream) 0%, var(--manuscript-cream-2) 100%)',
            border: '1px solid var(--gold-mid)',
          }
    }
  >
    <div className="min-w-0 flex-1">
      <div
        className="text-sm font-bold leading-tight"
        style={{
          color: 'var(--emerald-deep)',
          fontFamily: 'Georgia, "Times New Roman", serif',
        }}
      >
        {label}
      </div>
      <div
        className="text-[10px] uppercase font-semibold leading-tight mt-0.5"
        style={{ color: 'var(--gold-deep)', letterSpacing: '0.16em' }}
      >
        {description}
      </div>
    </div>
    <span
      className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition"
      style={{
        background: checked
          ? 'linear-gradient(135deg, var(--gold-mid) 0%, var(--gold-light) 100%)'
          : 'var(--manuscript-cream-2)',
        border: '1px solid var(--gold-mid)',
      }}
      aria-hidden="true"
    >
      <span
        className="inline-block h-5 w-5 transform rounded-full shadow transition"
        style={{
          background: 'var(--manuscript-cream)',
          transform: checked ? 'translateX(20px)' : 'translateX(2px)',
        }}
      />
    </span>
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="sr-only"
    />
  </label>
)

// ============================================================================
// Main page
// ============================================================================
type ViewMode = 'daily' | 'weekly' | 'monthly' | 'statistics'

export const PrayerTracker = () => {
  const queryClient = useQueryClient()
  const { success, error } = useToast()
  const { meta } = useTheme()
  const tints = usePrayerTints()

  const [view, setView] = useState<ViewMode>('daily')
  const [selectedDate, setSelectedDate] = useState<string>(getLocalDate())
  const [monthCursor, setMonthCursor] = useState(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() + 1 }
  })
  const [settingsOpen, setSettingsOpen] = useState(false)

  // -- Queries -------------------------------------------------------------
  // Resolve the user's saved location once on mount. We pass city/country
  // to /prayer-tracking/today so Aladhan can return scheduled times even
  // before the user opens the Prayer Times page to set their city.
  const locationQuery = useQuery({
    queryKey: ['userLocation'],
    queryFn: () => prayerTimesService.getUserLocation(),
    staleTime: 5 * 60 * 1000,
  })
  const userLoc = locationQuery.data

  // Always load the daily checklist. Backend resolves the user's saved
  // location and ages missed prayers into the qada counter automatically.
  const todayQuery = useQuery({
    queryKey: ['prayerTrackerToday', userLoc?.city, userLoc?.country],
    queryFn: () => prayerTrackingService.getToday(userLoc?.city, userLoc?.country),
  })
  const dayQuery = useQuery({
    queryKey: ['prayerTrackerDay', selectedDate, userLoc?.city, userLoc?.country],
    queryFn: () => prayerTrackingService.getDay(selectedDate, userLoc?.city, userLoc?.country),
    enabled: view === 'daily' && selectedDate !== getLocalDate(),
    // Don't retry on 400s — those are deterministic (e.g. a future
    // date slipped through the picker cap) and a retry storm would
    // just spam the server.
    retry: false,
  })
  const weekQuery = useQuery({
    queryKey: ['prayerTrackerWeek'],
    queryFn: () => prayerTrackingService.getWeek(),
    enabled: view === 'weekly',
  })
  const monthQuery = useQuery({
    queryKey: ['prayerTrackerMonth', monthCursor.year, monthCursor.month],
    queryFn: () => prayerTrackingService.getMonth(monthCursor.year, monthCursor.month),
    enabled: view === 'monthly',
  })
  const streaksQuery = useQuery({
    queryKey: ['prayerStreaks'],
    queryFn: () => prayerTrackingService.getStreaks(),
  })
  // Range-scoped data for the Stats view.
  const [statsRangeStart, setStatsRangeStart] = useState<string>(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  })
  const [statsRangeEnd, setStatsRangeEnd] = useState<string>(() => getLocalDate())
  const summaryQuery = useQuery({
    queryKey: ['prayerSummary', statsRangeStart, statsRangeEnd],
    queryFn: () => prayerTrackingService.getSummary(statsRangeStart, statsRangeEnd),
    enabled: view === 'statistics',
  })
  const qadaEntriesQuery = useQuery({
    queryKey: ['prayerQadaEntries', statsRangeStart, statsRangeEnd],
    queryFn: () => prayerTrackingService.getQadaEntries(statsRangeStart, statsRangeEnd),
    enabled: view === 'statistics',
  })
  const settingsQuery = useQuery({
    queryKey: ['prayerSettings'],
    queryFn: () => prayerTrackingService.getSettings(),
  })

  // -- Mutations -----------------------------------------------------------
  const toggleMutation = useMutation({
    mutationFn: (vars: {
      prayer_name: PrayerName
      tracking_date: string
      is_completed: boolean
      is_jamaaah: boolean
    }) =>
      prayerTrackingService.upsertTracking({
        prayer_name: vars.prayer_name,
        tracking_date: vars.tracking_date,
        is_completed: vars.is_completed,
        is_jamaaah: vars.is_jamaaah,
      }),
    onSuccess: () => {
      // The Prayer Row toggle is the canonical "did the user pray
      // this?" signal. It affects:
      //   • the daily checklist (`prayerTrackerToday` / `prayerTrackerDay`)
      //   • the weekly / monthly aggregates
      //   • the streaks + statistics
      //   • the lifetime prayer_qada counters (the backend writes a
      //     matching `track_check` / `track_uncheck` audit-log event)
      //   • the daily Qada card, which mirrors the Prayer Row state
      //     so it flips in lockstep
      //   • the Stats view's range-scoped qada breakdown (kept in
      //     sync via the `prayerQada*` queries below)
      queryClient.invalidateQueries({ queryKey: ['prayerTrackerToday'] })
      queryClient.invalidateQueries({ queryKey: ['prayerTrackerDay'] })
      queryClient.invalidateQueries({ queryKey: ['prayerTrackerWeek'] })
      queryClient.invalidateQueries({ queryKey: ['prayerTrackerMonth'] })
      queryClient.invalidateQueries({ queryKey: ['prayerStreaks'] })
      queryClient.invalidateQueries({ queryKey: ['prayerSummary'] })
      queryClient.invalidateQueries({ queryKey: ['prayerQadaEntries'] })
      queryClient.invalidateQueries({ queryKey: ['prayerStatistics'] })
      queryClient.invalidateQueries({ queryKey: ['prayerQada'] })
      // The backend syncs prayer-related challenges on every toggle —
      // invalidate the challenge caches so the UI reflects it instantly.
      queryClient.invalidateQueries({ queryKey: ['challenges'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: () => error('Failed to save prayer'),
  })

  // Qada tile "Mark complete" / "Undo" both go through `toggleMutation`
  // (see `handleQadaCompleted` / `handleQadaUndo` below), so there is
  // no separate qada mutation here. The Qada card is a pure mirror of
  // the daily checklist — both surfaces flip in lockstep when either
  // is tapped, and the backend writes a single audit-log event
  // (either `track_check` with delta = -1, or `track_uncheck` with
  // delta = +1) so the lifetime `prayer_qada` counters stay in sync.

  // Qada tile "Mark complete" mutation — writes a single
  // ``PrayerQadaEvent`` (delta = -1) AND upserts a
  // ``prayer_tracking`` row with ``is_completed = true`` so the
  // daily checklist mirrors the change and the lifetime
  // ``prayer_qada`` counters stay in sync. The Stats view no
  // longer surfaces qada counters (per user request), but the
  // audit log is still maintained for future use.
  const qadaMutation = useMutation({
    mutationFn: (vars: { prayer_name: PrayerName; delta: number; tracking_date: string }) =>
      prayerTrackingService.adjustQada(vars),
    onSuccess: () => {
      // Invalidate everything that depends on qada state so the
      // daily checklist, the lifetime ``prayer_qada`` counters,
      // streaks and statistics all refresh in lockstep.
      queryClient.invalidateQueries({ queryKey: ['prayerTrackerToday'] })
      queryClient.invalidateQueries({ queryKey: ['prayerTrackerDay'] })
      queryClient.invalidateQueries({ queryKey: ['prayerStreaks'] })
      queryClient.invalidateQueries({ queryKey: ['prayerStatistics'] })
      queryClient.invalidateQueries({ queryKey: ['prayerQada'] })
      queryClient.invalidateQueries({ queryKey: ['prayerSummary'] })
      queryClient.invalidateQueries({ queryKey: ['prayerQadaEntries'] })
      // Challenge progress may have changed (qada mark-complete also
      // flips a prayer_tracking row).
      queryClient.invalidateQueries({ queryKey: ['challenges'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      success('Qada updated')
    },
    onError: () => error('Failed to update qada'),
  })

  // -- Derived -------------------------------------------------------------
  const visibleDay: DayTrackingResponse | undefined =
    view === 'daily' && selectedDate === getLocalDate() ? todayQuery.data : dayQuery.data
  const week = weekQuery.data
  const month = monthQuery.data
  const streaks = streaksQuery.data?.streaks ?? []
  const allStreak = streaks.find((s) => s.prayer_name === 'all')

  // Prayer-row lookup keyed by prayer_name. Drives the Qada card
  // (which is a pure mirror of the daily checklist): a prayer shows
  // up as "owed" in Qada exactly when its Prayer Row is unchecked
  // (or absent) for the visible day. When the user flips the Prayer
  // Row to checked, the Qada tile flips to "Caught up" automatically
  // on the next refetch — no separate Qada event is needed to keep
  // the two surfaces in sync, because they're reading from the same
  // `prayer_tracking` source.
  const prayerRowByName: Record<string, DayPrayerStatus | undefined> = {}
  for (const s of visibleDay?.prayers ?? []) {
    prayerRowByName[s.prayer_name] = s
  }

  // Per-day "owed" check. The Qada card always renders all 5
  // prayers — this helper just answers "does this prayer still need
  // to be made up on the visible day?".
  const qadaOwedForDay = (p: PrayerName): number => {
    const row = prayerRowByName[p]
    // Absent row (never toggled) = owed; row present and unchecked
    // = owed; row present and checked = not owed.
    if (!row) return 1
    return row.is_completed ? 0 : 1
  }

  const settings = settingsQuery.data

  // -- Handlers ------------------------------------------------------------
  // The Prayer Row toggle is the single source of truth. Tapping
  // "Mark complete" on a Qada tile routes through the same
  // `handleToggle` path so both surfaces flip in lockstep and the
  // backend writes a single qada event with `reason="track_check"`.
  const handleToggle = (name: PrayerName, completed: boolean, jamaaah: boolean) =>
    toggleMutation.mutate({
      prayer_name: name,
      tracking_date: selectedDate,
      is_completed: !completed,
      is_jamaaah: jamaaah,
    })

  const handleToggleJamaaah = (name: PrayerName, jamaaah: boolean, completed: boolean) => {
    if (!completed) return
    toggleMutation.mutate({
      prayer_name: name,
      tracking_date: selectedDate,
      is_completed: true,
      is_jamaaah: !jamaaah,
    })
  }

  // Qada tile "Mark complete" — explicit "I made up this missed
  // prayer" action. Routes through `qadaMutation` (POST
  // /qada/adjust) which writes a single ``PrayerQadaEvent``
  // (delta = -1, reason = "qada_tile_mark_complete") AND
  // upserts the corresponding ``prayer_tracking`` row so the
  // daily checklist mirrors the change and the lifetime
  // ``prayer_qada`` counters stay in sync.
  const handleQadaCompleted = (name: PrayerName) =>
    qadaMutation.mutate({
      prayer_name: name,
      delta: -1,
      tracking_date: selectedDate,
    })

  // Qada tile "Undo" — reverses a "Mark complete" tap within the
  // 4-second undo window. Routes through `qadaMutation` with a
  // positive delta, which the backend treats as a compensating
  // event (decrements made_up_count, increments owed_count, and
  // flips the prayer-tracking row back to ``is_completed=false``
  // if it was created via this same qada-tile path).
  const handleQadaUndo = (name: PrayerName) =>
    qadaMutation.mutate({
      prayer_name: name,
      delta: 1,
      tracking_date: selectedDate,
    })

  const tabs: { id: ViewMode; label: string }[] = [
    { id: 'daily', label: 'Today' },
    { id: 'weekly', label: 'Week' },
    { id: 'monthly', label: 'Month' },
    { id: 'statistics', label: 'Stats' },
  ]

  const swatch = meta.swatches

  return (
    <div className="min-h-screen">
      <div
        className="absolute inset-x-0 top-0 h-72 opacity-50 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at top, ${swatch.light} 0%, transparent 70%)` }}
      />
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* ============================ HERO ============================ */}
        <OrnateCard
          variant="dark"
          topBar
          corners="all"
          className="!p-6 sm:!p-8 relative overflow-hidden"
        >
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div
              className="absolute -top-24 -right-24 w-72 h-72 rounded-full blur-3xl"
              style={{ background: 'radial-gradient(circle, rgba(240,199,94,0.18) 0%, transparent 70%)' }}
            />
            <div
              className="absolute -bottom-20 -left-20 w-60 h-60 rounded-full blur-3xl"
              style={{ background: 'radial-gradient(circle, rgba(212,160,23,0.12) 0%, transparent 70%)' }}
            />
            <div
              className="absolute top-6 bottom-6 left-0 w-px"
              style={{
                background:
                  'linear-gradient(180deg, transparent 0%, var(--gold-mid) 50%, transparent 100%)',
                opacity: 0.6,
              }}
            />
          </div>

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 sm:gap-6">
            <div className="min-w-0">
              <div
                className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] font-bold"
                style={{ color: 'var(--gold-glow)' }}
              >
                <Sparkles size={12} />
                {greeting()}
              </div>
              <h1
                className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight"
                style={{
                  color: 'var(--manuscript-cream, #fbf3df)',
                  fontFamily: 'Georgia, "Times New Roman", serif',
                }}
              >
                Prayer Tracker
              </h1>
              <p
                className="mt-1 text-sm max-w-md"
                style={{ color: 'var(--manuscript-cream, #fbf3df)', opacity: 0.82 }}
              >
                Build a steady rhythm of five daily prayers, streaks, and qada — all in one place.
              </p>
              {allStreak && (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span
                    className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1 rounded-full border"
                    style={{
                      background:
                        'linear-gradient(135deg, rgba(240,199,94,0.18) 0%, rgba(212,160,23,0.10) 100%)',
                      color: 'var(--gold-glow)',
                      borderColor: 'var(--gold-mid)',
                    }}
                  >
                    <Flame size={11} /> {allStreak.current_streak}-day streak
                  </span>
                  {allStreak.longest_streak > 0 && (
                    <span
                      className="text-[11px] font-bold px-3 py-1 rounded-full border"
                      style={{
                        background:
                          'linear-gradient(135deg, rgba(240,199,94,0.10) 0%, rgba(212,160,23,0.06) 100%)',
                        color: 'var(--manuscript-cream, #fbf3df)',
                        borderColor: 'var(--gold-mid)',
                      }}
                    >
                      Best · {allStreak.longest_streak}d
                    </span>
                  )}
                  {allStreak.badges.map((b) => (
                    <span
                      key={b}
                      className="text-[10px] px-2.5 py-1 rounded-full font-semibold capitalize border"
                      style={{
                        background: 'rgba(251,243,223,0.08)',
                        color: 'var(--manuscript-cream, #fbf3df)',
                        borderColor: 'rgba(240,199,94,0.35)',
                      }}
                    >
                      {b}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </OrnateCard>

        {/* ============================ TABS + DATE ============================ */}
        <OrnateCard
          variant="dark"
          topBar={false}
          corners="all"
          className="!p-3 flex items-center justify-between flex-wrap gap-3"
        >
          <div
            className="inline-flex p-1 rounded-xl gap-1"
            style={{
              background: 'rgba(0,0,0,0.25)',
              border: '1px solid var(--gold-mid)',
            }}
          >
            {tabs.map((t) => {
              const isActive = view === t.id
              return (
                <button
                  key={t.id}
                  onClick={() => setView(t.id)}
                  className="px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition"
                  style={
                    isActive
                      ? {
                          background:
                            'linear-gradient(135deg, var(--gold-mid) 0%, var(--gold-light) 100%)',
                          color: 'var(--emerald-deep)',
                          border: '1px solid var(--gold-deep)',
                        }
                      : {
                          background: 'transparent',
                          color: 'var(--manuscript-cream, #fbf3df)',
                          border: '1px solid transparent',
                          opacity: 0.85,
                        }
                  }
                >
                  {t.label}
                </button>
              )
            })}
          </div>

          {view === 'daily' && (
            <div className="flex items-center gap-2">
              {/* ``max`` caps the picker at today — users can't navigate
                  to future days, where the prayer rows and Qada tiles
                  would render meaningless "5 owed" placeholders. The
                  ``max`` constraint is enforced natively by the
                  browser, so the date picker greys out future days and
                  rejects future keyboard input. */}
              <DateField
                value={selectedDate}
                onChange={(v) => {
                  if (!v) return
                  const today = getLocalDate()
                  setSelectedDate(v > today ? today : v)
                }}
                max={getLocalDate()}
              />
              {selectedDate !== getLocalDate() && (
                <button
                  onClick={() => setSelectedDate(getLocalDate())}
                  className="text-xs font-semibold"
                  style={{ color: 'var(--gold-mid)' }}
                >
                  Jump to today
                </button>
              )}
            </div>
          )}
        </OrnateCard>

        {/* ============================ SUNRISE & SUNSET ============================ */}
        {view !== 'statistics' && visibleDay && (
          <div className="grid grid-cols-2 gap-3">
            <div
              className="rounded-xl p-2.5 sm:p-3 flex items-center gap-2 sm:gap-3"
              style={{
                background: 'rgba(6, 30, 25, 0.78)',
                border: '1px solid var(--gold-mid)',
                backdropFilter: 'blur(24px) saturate(1.5)',
              }}
            >
              <div
                className="shrink-0 w-7 h-7 inline-flex items-center justify-center rounded-full"
                style={{
                  background: 'linear-gradient(135deg, var(--gold-mid) 0%, var(--gold-light) 100%)',
                  color: 'var(--emerald-deep)',
                  border: '1px solid var(--gold-deep)',
                }}
              >
                <Sunrise size={16} />
              </div>
              <div className="min-w-0">
                <div
                  className="text-sm font-bold"
                  style={{
                    color: 'var(--manuscript-cream, #fbf3df)',
                    fontFamily: 'Georgia, "Times New Roman", serif',
                  }}
                >
                  Sunrise
                </div>
                <div
                  className="text-xs font-semibold tabular-nums"
                  style={{ color: 'var(--manuscript-cream, #fbf3df)' }}
                >
                  {visibleDay.sunrise ? format12Hour(visibleDay.sunrise) : '—'}
                </div>
              </div>
            </div>
            <div
              className="rounded-xl p-2.5 sm:p-3 flex items-center gap-2 sm:gap-3"
              style={{
                background: 'rgba(6, 30, 25, 0.78)',
                border: '1px solid var(--gold-mid)',
                backdropFilter: 'blur(24px) saturate(1.5)',
              }}
            >
              <div
                className="shrink-0 w-7 h-7 inline-flex items-center justify-center rounded-full"
                style={{
                  background: 'linear-gradient(135deg, var(--gold-mid) 0%, var(--gold-light) 100%)',
                  color: 'var(--emerald-deep)',
                  border: '1px solid var(--gold-deep)',
                }}
              >
                <Sunset size={16} />
              </div>
              <div className="min-w-0">
                <div
                  className="text-sm font-bold"
                  style={{
                    color: 'var(--manuscript-cream, #fbf3df)',
                    fontFamily: 'Georgia, "Times New Roman", serif',
                  }}
                >
                  Sunset
                </div>
                <div
                  className="text-xs font-semibold tabular-nums"
                  style={{ color: 'var(--manuscript-cream, #fbf3df)' }}
                >
                  {(() => {
                    const maghribTime = visibleDay?.prayers.find((p) => p.prayer_name === 'maghrib')?.scheduled_time
                    return maghribTime ? format12Hour(maghribTime) : '—'
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================ PRAYER TIMES ROW ============================ */}
        {view === 'daily' && (
          <OrnateCard variant="dark" topBar corners="all" className="!p-4 sm:!p-6">
            <div className="flex items-start sm:items-center justify-between gap-2 mb-3 sm:mb-5">
              <div className="flex items-center gap-2 sm:gap-3">
                <div
                  className="p-1.5 sm:p-2 rounded-xl"
                  style={{
                    background:
                      'linear-gradient(135deg, var(--gold-mid) 0%, var(--gold-light) 100%)',
                    color: 'var(--emerald-deep)',
                    border: '1px solid var(--gold-deep)',
                  }}
                >
                  <Clock size={16} className="sm:hidden" />
                  <Clock size={20} className="hidden sm:block" />
                </div>
                <div>
                  <h2
                    className="text-base sm:text-lg font-bold leading-tight"
                    style={{
                      color: 'var(--text-on-dark-glass)',
                      fontFamily: 'Georgia, "Times New Roman", serif',
                    }}
                  >
                    Prayer Times
                  </h2>
                  <p className="text-[11px] sm:text-xs" style={{ color: 'var(--gold-light)' }}>
                    {selectedDate === getLocalDate()
                      ? "Today's schedule — Fajr through Isha, with each prayer's window."
                      : `Schedule for ${formatDateLabel(selectedDate)}.`}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
              {PRAYER_ORDER.map((prayer, idx) => {
                const status = visibleDay?.prayers.find((p) => p.prayer_name === prayer)
                const startTime = status?.scheduled_time ?? null
                const next = visibleDay?.prayers.find(
                  (p) => p.prayer_name === PRAYER_ORDER[idx + 1],
                )
                let endTime: string | null
                if (prayer === PrayerName.FAJR) {
                  endTime = visibleDay?.sunrise ?? null
                } else if (prayer === PrayerName.ISHA) {
                  endTime = visibleDay?.midnight ?? null
                } else {
                  endTime = next?.scheduled_time ?? null
                }
                return (
                  <PrayerReferenceCard
                    key={prayer}
                    prayer={prayer}
                    startTime={startTime}
                    endTime={endTime}
                    icon={tints[prayer].icon}
                  />
                )
              })}
            </div>
          </OrnateCard>
        )}

        {/* ============================ DAILY VIEW ============================ */}
        {view === 'daily' && (
          <div className="space-y-6">
            {/* ---- Prayer rows (per-day "prayed on time") ---- */}
            {visibleDay ? (
              <>
                {visibleDay.is_full_day && (
                  <OrnateCard
                    variant="dark"
                    topBar={false}
                    corners="all"
                    className="!p-4 flex items-center gap-3"
                  >
                    <div
                      className="p-2 rounded-full shadow"
                      style={{
                        background:
                          'linear-gradient(135deg, var(--gold-mid) 0%, var(--gold-light) 100%)',
                        color: 'var(--emerald-deep)',
                        border: '1px solid var(--gold-deep)',
                      }}
                    >
                      <Trophy size={18} />
                    </div>
                    <div>
                      <div
                        className="text-sm font-bold"
                        style={{
                          color: 'var(--manuscript-cream, #fbf3df)',
                          fontFamily: 'Georgia, "Times New Roman", serif',
                        }}
                      >
                        All 5 prayers complete
                      </div>
                      <div
                        className="text-xs"
                        style={{ color: 'var(--gold-mid)' }}
                      >
                        MashaAllah — keep the streak alive tomorrow.
                      </div>
                    </div>
                  </OrnateCard>
                )}

                <OrnateCard variant="dark" topBar corners="all" className="!p-6">
                  <div className="flex items-start sm:items-center justify-between gap-2 mb-4 sm:mb-5">
                    <div className="flex items-center gap-3">
                      <div
                        className="p-2 rounded-xl"
                        style={{
                          background:
                            'linear-gradient(135deg, var(--gold-mid) 0%, var(--gold-light) 100%)',
                          color: 'var(--emerald-deep)',
                          border: '1px solid var(--gold-deep)',
                        }}
                      >
                        <CheckCircle2 size={20} />
                      </div>
                      <div>
                        <h2
                          className="text-lg font-bold leading-tight"
                          style={{
                            color: 'var(--text-on-dark-glass)',
                            fontFamily: 'Georgia, "Times New Roman", serif',
                          }}
                        >
                          Prayer Tracker
                        </h2>
                        <p className="text-xs" style={{ color: 'var(--gold-light)' }}>
                          {selectedDate === getLocalDate()
                            ? `Check off each prayer you prayed on time today.`
                            : `Mark each prayer you prayed on time for ${formatDateLabel(selectedDate)}.`}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {visibleDay.prayers.map((s) => (
                      <PrayerRow
                        key={s.prayer_name}
                        status={s}
                        onToggle={() =>
                          handleToggle(s.prayer_name, s.is_completed, s.is_jamaaah)
                        }
                        onToggleJamaaah={() =>
                          handleToggleJamaaah(s.prayer_name, s.is_jamaaah, s.is_completed)
                        }
                        trackJamaaah={!!settings?.track_jamaaah}
                        disabled={toggleMutation.isPending}
                        tints={tints}
                      />
                    ))}
                  </div>
                </OrnateCard>
              </>
            ) : (
              <GlassCard className="p-6">
                <p
                  className="text-sm"
                  style={{ color: 'var(--gold-mid)' }}
                >
                  {dayQuery.isError
                    ? 'No data for this day — try a more recent date.'
                    : 'Loading prayer times…'}
                </p>
              </GlassCard>
            )}

            {/* ---- Qada card (per single day) ---- */}
            {/* The Qada card is a mirror of the daily Prayer Row: every
                prayer whose Prayer Row is unchecked (or absent) on the
                visible day shows up here as "owed", with a "Mark
                complete" button. Tapping the button routes through the
                same `toggleMutation` as the Prayer Row checkbox, so the
                two surfaces flip in lockstep. Un-ticking a Prayer Row
                makes the prayer reappear in Qada. No separate qada
                history query is needed here — `visibleDay` (returned
                by GET /today or GET /day/{date}) is enough. */}
            {settings?.track_qada && (
              <QadaCard
                selectedDate={selectedDate}
                isToday={selectedDate === getLocalDate()}
                owedForDay={qadaOwedForDay}
                onCompleted={handleQadaCompleted}
                onUndo={handleQadaUndo}
                disabled={qadaMutation.isPending || toggleMutation.isPending}
              />
            )}
          </div>
        )}

        {/* ============================ WEEKLY VIEW ============================ */}
        {view === 'weekly' && (
          <OrnateCard variant="dark" topBar corners="all" className="!p-4 sm:!p-5">
            <div className="grid grid-cols-3 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
              {week ? (
                week.map((d) => (
                  <WeekDayCard
                    key={d.date}
                    day={d}
                    onClick={() => {
                      setSelectedDate(d.date)
                      setView('daily')
                    }}
                  />
                ))
              ) : (
                <div
                  className="col-span-full text-sm"
                  style={{ color: 'var(--gold-mid)' }}
                >
                  Loading…
                </div>
              )}
            </div>
          </OrnateCard>
        )}

        {/* ============================ MONTHLY VIEW ============================ */}
        {view === 'monthly' && (
          <OrnateCard variant="dark" topBar corners="all" className="!p-5">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() =>
                  setMonthCursor(({ year, month }) =>
                    month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 },
                  )
                }
                className="p-1.5 rounded-lg transition border"
                style={{
                  background: 'rgba(0,0,0,0.25)',
                  color: 'var(--manuscript-cream, #fbf3df)',
                  borderColor: 'var(--gold-mid)',
                }}
                aria-label="Previous month"
              >
                <ChevronLeft size={16} />
              </button>
              <h2
                className="text-lg font-bold"
                style={{
                  color: 'var(--manuscript-cream, #fbf3df)',
                  fontFamily: 'Georgia, "Times New Roman", serif',
                }}
              >
                {new Date(monthCursor.year, monthCursor.month - 1, 1).toLocaleDateString(
                  'en-US',
                  { month: 'long', year: 'numeric' },
                )}
              </h2>
              <button
                onClick={() =>
                  setMonthCursor(({ year, month }) =>
                    month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 },
                  )
                }
                className="p-1.5 rounded-lg transition border"
                style={{
                  background: 'rgba(0,0,0,0.25)',
                  color: 'var(--manuscript-cream, #fbf3df)',
                  borderColor: 'var(--gold-mid)',
                }}
                aria-label="Next month"
              >
                <ChevronRight size={16} />
              </button>
            </div>
            <div
              className="grid grid-cols-7 gap-1 sm:gap-2 text-center text-[9px] sm:text-[10px] font-bold uppercase mb-2"
              style={{ color: 'var(--gold-mid)', letterSpacing: '0.18em' }}
            >
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>
            {month ? (
              <MonthGrid
                days={month}
                year={monthCursor.year}
                month={monthCursor.month}
                onDayClick={(date) => {
                  setSelectedDate(date)
                  setView('daily')
                }}
              />
            ) : (
              <p className="text-sm" style={{ color: 'var(--gold-mid)' }}>
                Loading…
              </p>
            )}
          </OrnateCard>
        )}

        {/* ============================ STATS VIEW ============================ */}
        {view === 'statistics' && (
          <StatsView
            summary={summaryQuery.data}
            summaryLoading={summaryQuery.isLoading}
            qadaEntries={qadaEntriesQuery.data}
            qadaEntriesLoading={qadaEntriesQuery.isLoading}
            rangeStart={statsRangeStart}
            rangeEnd={statsRangeEnd}
            onChangeStart={setStatsRangeStart}
            onChangeEnd={setStatsRangeEnd}
          />
        )}

        <SettingsModal
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          settings={settings}
        />
      </div>
    </div>
  )
}

// ============================================================================
// QadaCard — single-day qada tile grid. Pure mirror of the daily Prayer
// Row: the grid renders ONLY the prayers whose Prayer Row is unchecked
// (or absent) for the visible day. Once the user catches up on a
// prayer (via either the Qada tile or the Prayer Row checkbox), its
// tile disappears from the Qada grid entirely — it only reappears if
// the user un-ticks the Prayer Row.
//
// The card is fully derived from the same `prayer_tracking` rows the
// Prayer Row uses, so the two surfaces stay in lockstep automatically.
//
// There is no "I missed this" button: the user's catch-up decision
// (check vs uncheck the Prayer Row) drives both surfaces. Tapping
// "Mark complete" on a Qada tile flips the Prayer Row to checked and
// removes the tile from this grid; un-ticking the Prayer Row brings
// the tile back as owed.
// ============================================================================
const QadaCard: React.FC<{
  selectedDate: string
  isToday: boolean
  owedForDay: (p: PrayerName) => number
  onCompleted: (p: PrayerName) => void
  onUndo: (p: PrayerName) => void
  disabled: boolean
}> = ({ selectedDate, isToday, owedForDay, onCompleted, onUndo, disabled }) => {
  const totalOwed = PRAYER_ORDER.reduce((s, p) => s + owedForDay(p), 0)
  return (
    <OrnateCard variant="dark" topBar corners="all" className="!p-4 sm:!p-6">
      <div className="flex items-start sm:items-center justify-between gap-2 mb-3 sm:mb-5">
        <div className="flex items-center gap-2 sm:gap-3">
          <div
            className="p-1.5 sm:p-2 rounded-xl"
            style={{
              background:
                'linear-gradient(135deg, var(--gold-mid) 0%, var(--gold-light) 100%)',
              color: 'var(--emerald-deep)',
              border: '1px solid var(--gold-deep)',
            }}
          >
            <Info size={16} className="sm:hidden" />
            <Info size={20} className="hidden sm:block" />
          </div>
          <div>
            <h2
              className="text-base sm:text-lg font-bold leading-tight"
              style={{
                color: 'var(--text-on-dark-glass)',
                fontFamily: 'Georgia, "Times New Roman", serif',
              }}
            >
              Qada
            </h2>
            <p className="text-[11px] sm:text-xs" style={{ color: 'var(--gold-light)' }}>
              {totalOwed === 0
                ? isToday
                  ? 'All caught up for today.'
                  : `No missed prayers for ${formatDateLabel(selectedDate)}.`
                : isToday
                ? `${totalOwed} missed prayer${totalOwed === 1 ? '' : 's'} for today — tap "Mark complete" when you make one up.`
                : `${totalOwed} missed prayer${totalOwed === 1 ? '' : 's'} for ${formatDateLabel(selectedDate)} — tap "Mark complete" when you make one up.`}
            </p>
          </div>
        </div>
        <div className="text-right shrink-0 ml-2">
          <div
            className="text-2xl sm:text-3xl font-bold leading-none tabular-nums"
            style={{
              color: 'var(--text-on-dark-glass)',
              fontFamily: 'Georgia, "Times New Roman", serif',
            }}
          >
            {totalOwed}
          </div>
          <div
            className="text-[9px] sm:text-[10px] uppercase font-semibold mt-1"
            style={{ color: 'var(--gold-mid)', letterSpacing: '0.18em' }}
          >
            {isToday ? 'owed today' : 'owed this day'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 md:grid-cols-5 gap-2 sm:gap-3">
        {PRAYER_ORDER.filter((p) => owedForDay(p) > 0).map((p) => (
          <QadaTile
            key={p}
            prayer={p}
            count={owedForDay(p)}
            disabled={disabled}
            onCompleted={() => onCompleted(p)}
            onUndo={() => onUndo(p)}
          />
        ))}
      </div>
    </OrnateCard>
  )
}

// ============================================================================
// DateField — themed wrapper around a native <input type="date">.
//
// Optional `max` prop (ISO `YYYY-MM-DD` string) caps the pickable
// range — pass today's date to prevent the user from navigating to
// future days (which would render an empty Qada card and meaningless
// prayer rows). The native `<input type="date">` enforces `max`
// directly, so the browser disables / dims out-of-range days in the
// date picker and rejects out-of-range keyboard input.
// ============================================================================
const DateField: React.FC<{
  value: string
  onChange: (v: string) => void
  max?: string
  min?: string
}> = ({ value, onChange, max, min }) => {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const handleIconClick = () => {
    const el = inputRef.current
    if (!el) return
    if (typeof el.showPicker === 'function') {
      el.showPicker()
    } else {
      el.focus()
      el.click()
    }
  }
  const display = (() => {
    if (!value) return ''
    const d = new Date(`${value}T00:00:00`)
    if (Number.isNaN(d.getTime())) return value
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  })()

  return (
    <div
      className="relative inline-flex items-center rounded-xl"
      style={{
        background: 'rgba(0,0,0,0.25)',
        border: '1px solid var(--gold-mid)',
      }}
    >
      <span
        className="pl-2.5 sm:pl-3 pr-1 text-xs sm:text-sm font-semibold whitespace-nowrap"
        style={{
          color: 'var(--manuscript-cream, #fbf3df)',
          fontFamily: 'Georgia, "Times New Roman", serif',
        }}
      >
        {display || '—'}
      </span>
      <button
        type="button"
        onClick={handleIconClick}
        aria-label="Pick a date"
        title="Pick a date"
        className="inline-flex items-center justify-center h-7 w-7 m-1 rounded-lg transition"
        style={{
          background:
            'linear-gradient(135deg, var(--gold-mid) 0%, var(--gold-light) 100%)',
          color: 'var(--emerald-deep)',
          border: '1px solid var(--gold-deep)',
        }}
      >
        <CalendarIcon size={14} />
      </button>
      <input
        ref={inputRef}
        type="date"
        value={value}
        max={max}
        min={min}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 opacity-0 pointer-events-none"
        tabIndex={-1}
        aria-hidden="true"
      />
    </div>
  )
}

// ============================================================================
// StatsView — range-scoped aggregates.
// The Stats view's qada tiles do NOT share data with the daily QadaCard.
// Each surface shows what's appropriate for its scope:
//   • QadaCard (daily): per-day tally only
//   • StatsView (range): lifetime + range aggregates + per-prayer breakdown
// ============================================================================
const formatRangeLabel = (start: string, end: string): string => {
  const s = new Date(`${start}T00:00:00`)
  const e = new Date(`${end}T00:00:00`)
  const sameYear = s.getFullYear() === e.getFullYear()
  const sameMonth = sameYear && s.getMonth() === e.getMonth()
  const fmt = (d: Date, withYear: boolean) =>
    d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      ...(withYear ? { year: 'numeric' } : {}),
    })
  if (sameMonth) return `${fmt(s, false)} – ${e.getDate()}, ${s.getFullYear()}`
  if (sameYear) return `${fmt(s, false)} – ${fmt(e, true)}`
  return `${fmt(s, true)} – ${fmt(e, true)}`
}

const StatsView: React.FC<{
  summary: {
    start: string
    end: string
    days_in_range: number
    days_tracked: number
    prayed: number
    missed: number
    full_days: number
    per_prayer: Array<{ prayer_name: PrayerName; prayed: number; missed: number }>
  } | undefined
  summaryLoading: boolean
  qadaEntries: {
    entries: Array<{
      id: number
      prayer_name: PrayerName
      made_up_date: string
      missed_date: string | null
      is_jamaaah: boolean
      notes: string | null
      created_at: string
    }>
    total: number
    per_prayer: Record<string, number>
  } | undefined
  qadaEntriesLoading: boolean
  rangeStart: string
  rangeEnd: string
  onChangeStart: (s: string) => void
  onChangeEnd: (s: string) => void
}> = ({
  summary,
  summaryLoading,
  qadaEntries,
  qadaEntriesLoading,
  rangeStart,
  rangeEnd,
  onChangeStart,
  onChangeEnd,
}) => {
  const todayIso = getLocalDate()

  const handleStartChange = (v: string) => {
    if (!v) return
    // Hard cap at today — no future dates anywhere in the Stats range.
    if (v > todayIso) return
    onChangeStart(v)
    if (rangeEnd && v > rangeEnd) onChangeEnd(v)
  }
  const handleEndChange = (v: string) => {
    if (!v) return
    if (v > todayIso) return
    if (rangeStart && v < rangeStart) onChangeStart(v)
    onChangeEnd(v)
  }

  const totalLogged = (summary?.prayed ?? 0) + (summary?.missed ?? 0)
  const completionPct =
    totalLogged > 0 ? Math.round(((summary?.prayed ?? 0) / totalLogged) * 100) : 0
  const perPrayer = summary?.per_prayer ?? []
  const sortedByPrayed = [...perPrayer].sort((a, b) => b.prayed - a.prayed)
  const strongestPrayer = sortedByPrayed[0]
  const weakestPrayer = sortedByPrayed[sortedByPrayed.length - 1]

  const encouragement = pickEncouragement({
    prayed: summary?.prayed ?? 0,
    missed: summary?.missed ?? 0,
    fullDays: summary?.full_days ?? 0,
    daysInRange: summary?.days_in_range ?? 0,
    daysTracked: summary?.days_tracked ?? 0,
    completionPct,
    strongestPrayer,
    weakestPrayer,
  })

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* ---- Range picker -------------------------------------------- */}
      <OrnateCard variant="dark" topBar={false} corners="all" className="!p-3 sm:!p-4">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <div
              className="text-[9px] sm:text-[10px] font-bold uppercase"
              style={{ color: 'var(--gold-mid)', letterSpacing: '0.18em' }}
            >
              Your range
            </div>
            <div
              className="text-base sm:text-lg font-bold mt-0.5"
              style={{
                color: 'var(--manuscript-cream, #fbf3df)',
                fontFamily: 'Georgia, "Times New Roman", serif',
              }}
            >
              {formatRangeLabel(rangeStart, rangeEnd)}
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1">
              <span
                className="text-[9px] sm:text-[10px] font-bold uppercase"
                style={{ color: 'var(--gold-mid)', letterSpacing: '0.18em' }}
              >
                From
              </span>
              <DateField
                value={rangeStart}
                onChange={handleStartChange}
                max={todayIso}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span
                className="text-[9px] sm:text-[10px] font-bold uppercase"
                style={{ color: 'var(--gold-mid)', letterSpacing: '0.18em' }}
              >
                To
              </span>
              <DateField
                value={rangeEnd}
                onChange={handleEndChange}
                max={todayIso}
              />
            </label>
            <button
              type="button"
              onClick={() => {
                const today = getLocalDate()
                onChangeStart(today.slice(0, 7) + '-01')
                onChangeEnd(today)
              }}
              className="px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl text-[10px] sm:text-xs font-semibold transition border self-end"
              style={{
                background: 'rgba(0,0,0,0.25)',
                color: 'var(--manuscript-cream, #fbf3df)',
                borderColor: 'var(--gold-mid)',
              }}
            >
              This month
            </button>
            <button
              type="button"
              onClick={() => {
                const today = new Date()
                const sevenDaysAgo = new Date(today)
                sevenDaysAgo.setDate(today.getDate() - 6)
                const toIso = (d: Date) =>
                  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
                onChangeStart(toIso(sevenDaysAgo))
                onChangeEnd(toIso(today))
              }}
              className="px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl text-[10px] sm:text-xs font-semibold transition border self-end"
              style={{
                background: 'rgba(0,0,0,0.25)',
                color: 'var(--manuscript-cream, #fbf3df)',
                borderColor: 'var(--gold-mid)',
              }}
            >
              Last 7 days
            </button>
          </div>
        </div>
      </OrnateCard>

      {/* ---- Hero strip: 3 big tiles --------------------------------- */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <StatTile
          title="Prayed"
          value={summary ? `${summary.prayed}` : '—'}
          subtitle={
            summary
              ? `${completionPct}% of ${totalLogged} logged prayers`
              : summaryLoading
              ? 'Loading…'
              : 'No data'
          }
          tone="sage"
          icon={<CheckCircle2 />}
        />
        <StatTile
          title="Missed"
          value={summary ? `${summary.missed}` : '—'}
          subtitle={
            summary
              ? summary.missed === 0
                ? 'None missed — MashaAllah'
                : summary.full_days > 0
                ? `${summary.full_days} full day${summary.full_days === 1 ? '' : 's'} complete`
                : 'Days with unchecked prayers'
              : summaryLoading
              ? 'Loading…'
              : 'No data'
          }
          tone="cream"
          icon={<TrendingUp />}
        />
        <StatTile
          title="Qada Made Up"
          value={qadaEntries ? `${qadaEntries.total}` : '—'}
          subtitle={
            qadaEntries
              ? qadaEntries.total === 0
                ? 'No makeups yet'
                : `${qadaEntries.total} qada made up in range`
              : qadaEntriesLoading
              ? 'Loading…'
              : 'No data'
          }
          tone="sage"
          icon={<Info />}
        />
      </div>

      {/* ---- Per-prayer breakdown ------------------------------------ */}
      <OrnateCard variant="dark" topBar={false} corners="all" className="!p-4 sm:!p-6">
        <div className="flex items-center gap-2 mb-3 sm:mb-4">
          <BarChart3 size={16} className="sm:hidden" style={{ color: 'var(--gold-mid)' }} />
          <BarChart3 size={18} className="hidden sm:block" style={{ color: 'var(--gold-mid)' }} />
          <h3
            className="text-sm sm:text-base font-bold"
            style={{
              color: 'var(--manuscript-cream, #fbf3df)',
              fontFamily: 'Georgia, "Times New Roman", serif',
            }}
          >
            Per-prayer breakdown
          </h3>
        </div>
        <div className="space-y-2 sm:space-y-3">
          {perPrayer.map((p) => {
            const total = p.prayed + p.missed
            const pct = total > 0 ? Math.round((p.prayed / total) * 100) : 0
            return (
              <div key={p.prayer_name} className="space-y-1">
                <div className="flex items-center justify-between text-[11px] sm:text-xs">
                  <span
                    className="font-bold"
                    style={{
                      color: 'var(--manuscript-cream, #fbf3df)',
                      fontFamily: 'Georgia, "Times New Roman", serif',
                    }}
                  >
                    {PRAYER_LABEL[p.prayer_name]}
                  </span>
                  <span style={{ color: 'var(--gold-mid)' }}>
                    {p.prayed} prayed · {p.missed} missed
                  </span>
                </div>
                <div
                  className="h-1.5 sm:h-2 rounded-full overflow-hidden"
                  style={{ background: 'rgba(240,199,94,0.18)' }}
                >
                  <div
                    className="h-full"
                    style={{
                      width: `${pct}%`,
                      background:
                        'linear-gradient(90deg, var(--gold-deep) 0%, var(--gold-mid) 100%)',
                      transition: 'width 600ms ease',
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </OrnateCard>

      {/* ---- Encouragement card -------------------------------------- */}
      <OrnateCard variant="dark" topBar={false} corners="all" className="!p-4 sm:!p-5">
        <p
          className="text-xs sm:text-sm"
          style={{
            color: 'var(--manuscript-cream, #fbf3df)',
            fontFamily: 'Georgia, "Times New Roman", serif',
          }}
        >
          {encouragement}
        </p>
      </OrnateCard>
    </div>
  )
}

const StatTile: React.FC<{
  title: string
  value: string
  subtitle: string
  tone: 'sage' | 'cream' | 'gold'
  icon: React.ReactNode
}> = ({ title, value, subtitle, tone, icon }) => {
  const tones: Record<string, React.CSSProperties> = {
    sage: {
      background:
        'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',
      border: '1px solid var(--gold-mid)',
    },
    cream: {
      background:
        'linear-gradient(135deg, rgba(212,160,23,0.12) 0%, rgba(154,107,14,0.04) 100%)',
      border: '1px solid var(--gold-mid)',
    },
    gold: {
      background:
        'linear-gradient(135deg, var(--gold-mid) 0%, var(--gold-light) 100%)',
      border: '1px solid var(--gold-deep)',
    },
  }
  const isGold = tone === 'gold'
  return (
    <div
      className="rounded-2xl p-3 sm:p-4"
      style={{
        ...tones[tone],
        boxShadow: '0 2px 20px -14px rgba(0,0,0,0.4)',
      }}
    >
      <div className="flex items-center justify-between">
        <span
          className="text-[9px] sm:text-[10px] font-bold uppercase"
          style={{
            color: isGold ? 'var(--emerald-deep)' : 'var(--gold-mid)',
            letterSpacing: '0.18em',
          }}
        >
          {title}
        </span>
        <span style={{ color: isGold ? 'var(--emerald-deep)' : 'var(--gold-mid)' }}>
          {icon}
        </span>
      </div>
      <div
        className="text-xl sm:text-3xl font-bold mt-1 tabular-nums"
        style={{
          color: isGold ? 'var(--emerald-deep)' : 'var(--manuscript-cream, #fbf3df)',
          fontFamily: 'Georgia, "Times New Roman", serif',
        }}
      >
        {value}
      </div>
      <div
        className="text-[11px] sm:text-xs mt-0.5"
        style={{
          color: isGold ? 'var(--emerald-deep)' : 'var(--gold-mid)',
          opacity: isGold ? 0.85 : 1,
        }}
      >
        {subtitle}
      </div>
    </div>
  )
}

const WeekDayCard: React.FC<{ day: DayTrackingResponse; onClick: () => void }> = ({
  day,
  onClick,
}) => {
  const tone = dayCompletionTone(day.completed_count)
  return (
    <button
      onClick={onClick}
      className="group rounded-2xl p-3 sm:p-4 border transition text-left hover:-translate-y-0.5"
      style={{
        background: tone.bg,
        borderColor: tone.border,
        color: tone.text,
        boxShadow: '0 4px 24px -16px rgba(0,0,0,0.4)',
      }}
    >
      <div className="flex items-center justify-between">
        <div>
          <div
            className="text-[10px] uppercase font-bold"
            style={{ color: tone.sub, letterSpacing: '0.18em' }}
          >
            {formatDateLabel(day.date)}
          </div>
          <div
            className="text-2xl sm:text-3xl font-bold mt-1 tabular-nums"
            style={{
              fontFamily: 'Georgia, "Times New Roman", serif',
              color: tone.text,
            }}
          >
            {day.completed_count}/5
          </div>
          <div className="text-[11px] mt-1" style={{ color: tone.sub }}>
            {day.is_full_day
              ? 'MashaAllah — full day'
              : day.completed_count === 0
              ? 'No prayers yet'
              : `${5 - day.completed_count} left`}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          {PRAYER_ORDER.map((p) => {
            const done = day.prayers.find((x) => x.prayer_name === p)?.is_completed
            return (
              <span
                key={p}
                className="w-2 h-2 rounded-full"
                style={{
                  background: tone.text,
                  opacity: done ? 0.95 : 0.2,
                }}
              />
            )
          })}
        </div>
      </div>
    </button>
  )
}

const MonthGrid: React.FC<{ days: DayTrackingResponse[]; year: number; month: number; onDayClick: (date: string) => void }> = ({
  days,
  year,
  month,
  onDayClick,
}) => {
  const firstWeekday = new Date(year, month - 1, 1).getDay()
  const blanks = Array.from({ length: firstWeekday }, (_, i) => i)

  return (
    <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
      {blanks.map((b) => (
        <div key={`blank-${b}`} />
      ))}
      {days.map((d) => {
        const dayNum = Number(d.date.split('-')[2])
        const tone = dayCompletionTone(d.completed_count)
        const isFuture = d.date > getLocalDate()
        return (
          <button
            key={d.date}
            onClick={() => onDayClick(d.date)}
            disabled={isFuture}
            className="aspect-square rounded-xl border flex flex-col items-center justify-center text-xs transition hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            style={{
              background: isFuture ? 'rgba(0,0,0,0.15)' : tone.bg,
              borderColor: isFuture ? 'var(--gold-mid)' : tone.border,
              color: isFuture ? 'var(--gold-mid)' : tone.text,
              boxShadow: '0 2px 16px -12px rgba(0,0,0,0.4)',
            }}
            title={isFuture ? `${d.date} — not yet available` : `${d.date}: ${d.completed_count}/5`}
          >
            <span className="text-[9px] sm:text-[10px] opacity-80">{dayNum}</span>
            <span
              className="text-xs sm:text-sm font-bold tabular-nums leading-none mt-0.5"
              style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
            >
              {isFuture ? '·' : `${d.completed_count}/5`}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ============================================================================
// Encouragement engine — picks a single positive line based on the data.
// Always ends with a closing dua.
// ============================================================================
function pickEncouragement(ctx: {
  prayed: number
  missed: number
  fullDays: number
  daysInRange: number
  daysTracked: number
  completionPct: number
  strongestPrayer?: { prayer_name: PrayerName; prayed: number; missed: number }
  weakestPrayer?: { prayer_name: PrayerName; prayed: number; missed: number }
}): string {
  const dua = 'May Allah make it easy for you.'
  if (ctx.prayed === 0) {
    return `A new range is a fresh start — take it one prayer at a time. ${dua}`
  }
  if (ctx.completionPct >= 90) {
    return `MashaAllah — ${ctx.completionPct}% completion is a beautiful rhythm. ${dua}`
  }
  if (
    ctx.strongestPrayer &&
    ctx.strongestPrayer.prayed > 0
  ) {
    return `${PRAYER_LABEL[ctx.strongestPrayer.prayer_name]} is your strongest this range — keep that rhythm going. ${dua}`
  }
  if (ctx.fullDays > 0) {
    return `${ctx.fullDays} full day${ctx.fullDays === 1 ? '' : 's'} in this range — MashaAllah. ${dua}`
  }
  if (ctx.weakestPrayer && ctx.weakestPrayer.prayed + ctx.weakestPrayer.missed > 0) {
    return `Keep going — ${PRAYER_LABEL[ctx.weakestPrayer.prayer_name]} could use a little extra care. ${dua}`
  }
  return `Steady steps, insha'Allah. ${dua}`
}

export default PrayerTracker
