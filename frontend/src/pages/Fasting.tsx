// ============================================================================
// Fasting page
// ----------------------------------------------------------------------------
// Hijri-aware fasting tracker. Three views: Month grid, Year grid, Events list.
//
// The Month grid is click-to-mark: clicking a day cell opens a small popover
// anchored to that cell with the editor fields. Only ONE popover is open at
// a time (clicking another cell swaps, not stacks).
//
// The Events list mirrors the Calendar page's list view: filter chips at the
// top, then a list of fasting entries grouped by Hijri month, each row
// showing the day number, fasted status, donation, and good deed as a pill.
//
// Sadaqah default currency is TK (Bangladeshi Taka).
// ============================================================================
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import ReactDOM from 'react-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  CheckCircle2,
  Circle,
  CircleDollarSign,
  Gift,
  Trash2,
  Save,
  Loader2,
  X,
  CalendarDays,
  Moon,
  Filter,
  Info,
  Clock,
  Plus,
  BookOpen,
} from 'lucide-react'
import { api } from '../services/api'
import {
  fastingService,
  type FastingEntry,
  type FastingMonthSummary,
} from '../services/fastingService'
import { useToast } from '../components/Toast'
import {
  PageHeader,
  GoldDivider,
  OrnateCard,
} from '../components/IslamicOrnamentBG'

// ----------------------------------------------------------------------------
// Hijri calendar constants — same approximation the existing Calendar page uses
// ----------------------------------------------------------------------------
const HIJRI_MONTHS_EN = [
  'Muharram',
  "Safar",
  "Rabi' al-awwal",
  "Rabi' al-thani",
  'Jumada al-awwal',
  'Jumada al-thani',
  'Rajab',
  "Sha'ban",
  'Ramadan',
  'Shawwal',
  "Dhu al-Qi'dah",
  'Dhu al-Hijjah',
]
const HIJRI_MONTH_LENGTHS = [30, 29, 30, 29, 30, 29, 30, 29, 30, 29, 30, 29]
const WEEKDAY_LABELS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Categories for the Events list (mirrors Calendar's CATEGORY_META pattern).
const FASTING_CATEGORIES = {
  fasted: {
    label: 'Fasted',
    color: '#047857', // emerald
  },
  ramadan: {
    label: 'Ramadan',
    color: '#d4a017', // gold
  },
  sunnah: {
    label: 'Sunnah',
    color: '#a855f7', // purple
  },
  donation: {
    label: 'Donation',
    color: '#f0c75e', // gold-light
  },
  good_deed: {
    label: 'Good deed',
    color: '#10b981', // emerald-light
  },
} as const

function firstDayOfHijriMonth(hijriYear: number, hijriMonth: number): number {
  const REF_HIJRI_YEAR = 1446
  const REF_WEEKDAY = 0 // Sunday
  const yearDelta = hijriYear - REF_HIJRI_YEAR
  const monthDelta = hijriMonth - 1
  const totalDays = yearDelta * 354.37 + monthDelta * 29.5
  return ((REF_WEEKDAY + Math.round(totalDays)) % 7 + 7) % 7
}

// Server-calibrated first weekday of a Hijri month.  Uses today's Hijri
// day + Gregorian date from the server to compute the weekday of day 1
// of the given Hijri month.  Falls back to the rough estimate above if
// we don't have server data or the month is different from today's.
function calibratedFirstWeekday(
  hijriYear: number,
  hijriMonth: number,
  todayHijriDay: number | undefined,
  todayGregDate: string | undefined,
  todayHijriYear: number | undefined,
  todayHijriMonth: number | undefined
): number {
  if (
    todayHijriDay != null &&
    todayGregDate &&
    todayHijriYear === hijriYear &&
    todayHijriMonth === hijriMonth
  ) {
    // We're viewing the current month — compute day-1 weekday from today.
    const todayMs = Date.parse(todayGregDate + 'T00:00:00Z')
    const day1Ms = todayMs - (todayHijriDay - 1) * 24 * 60 * 60 * 1000
    const d = new Date(day1Ms)
    return d.getUTCDay()
  }
  return firstDayOfHijriMonth(hijriYear, hijriMonth)
}

// Map a (Hijri year, Hijri month, Hijri day) to an approximate ISO date.
function approximateGregorianDate(
  hijriYear: number,
  hijriMonth: number,
  hijriDay: number
): string {
  const ANCHOR_HIJRI_YEAR = 1447
  const ANCHOR_HIJRI_MONTH = 1
  const ANCHOR_HIJRI_DAY = 1
  const ANCHOR_GREGORIAN_MS = Date.UTC(2025, 6, 7) // month is 0-indexed

  const anchorTotal = daysSinceAnchorHijri(
    ANCHOR_HIJRI_YEAR,
    ANCHOR_HIJRI_MONTH,
    ANCHOR_HIJRI_DAY
  )
  const targetTotal = daysSinceAnchorHijri(hijriYear, hijriMonth, hijriDay)
  const deltaDays = targetTotal - anchorTotal
  const ms = ANCHOR_GREGORIAN_MS + deltaDays * 24 * 60 * 60 * 1000
  const d = new Date(ms)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

// Server-calibrated Gregorian date for a Hijri day in the current month.
// Uses today's Hijri day + Gregorian date (from the /prayer-times/islamic-date
// endpoint) as an anchor, so the offset is always exact for the visible month.
// Falls back to the rough approximateGregorianDate() if we don't have the
// server anchor yet (e.g. still loading).
function calibratedGregorianDate(
  hijriDay: number,
  todayHijriDay: number | undefined,
  todayGregDate: string | undefined,
  hijriYear: number,
  hijriMonth: number
): string {
  if (todayHijriDay != null && todayGregDate) {
    // Compute delta from today's Hijri day, then add/subtract that many
    // Gregorian days from today's Gregorian date.
    const delta = hijriDay - todayHijriDay
    const todayMs = Date.parse(todayGregDate + 'T00:00:00Z')
    const targetMs = todayMs + delta * 24 * 60 * 60 * 1000
    const d = new Date(targetMs)
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
  }
  return approximateGregorianDate(hijriYear, hijriMonth, hijriDay)
}

function daysSinceAnchorHijri(y: number, m: number, d: number): number {
  const yearDays = (y - 1) * 354 + Math.floor((y - 1) / 30) * 11
  const monthDays = HIJRI_MONTH_LENGTHS.slice(0, m - 1).reduce((a, b) => a + b, 0)
  return yearDays + monthDays + (d - 1)
}

const todayIso = (): string => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface HijriToday {
  gregorianDate: string
  hijriDate: string
  hijriDateCompact: string
  hijriDay: number
  hijriMonth: string
  hijriMonthNumber: number
  hijriYear: number
}

// ============================================================================
// Day-cell pill list — matches the Calendar's event-pill style
// (faint `${color}33` background, solid 1px colored border, cream uppercase
// text, truncated title). The user can click any pill to open the editor
// for that day.
// ============================================================================
interface DayPillsProps {
  entry: FastingEntry | undefined
  isToday: boolean
  onPillClick?: () => void
}
const DayPills: React.FC<DayPillsProps> = ({
  entry,
  isToday,
  onPillClick,
}) => {
  const fasted = !!entry?.fasted
  const hasDonation = (entry?.donation_amount ?? 0) > 0
  const hasGoodDeed = !!entry?.good_deed_done

  // Only show pills that reflect what the user has actually recorded
  // (Fasted, Sadaqah, Good deed). The Mon/Thu / White day / Ramadan
  // hint pills were removed because users mistook them for ticks and
  // the approximation drift caused several adjacent Hijri days to all
  // show the same hint. The day-type hint still appears in the editor
  // popover header.
  const pills: { label: string; color: string }[] = []
  if (fasted) {
    pills.push({ label: 'Fasted', color: FASTING_CATEGORIES.fasted.color })
  }
  if (hasDonation) {
    pills.push({
      label: `Sadaqah ${entry?.donation_amount ?? ''} ${entry?.donation_currency ?? 'TK'}`.trim(),
      color: FASTING_CATEGORIES.donation.color,
    })
  }
  if (hasGoodDeed) {
    pills.push({
      label: entry?.good_deed ? `Good deed · ${entry.good_deed}` : 'Good deed',
      color: FASTING_CATEGORIES.good_deed.color,
    })
  }

  return (
    <div className="flex flex-col gap-1 mt-auto">
      {pills.slice(0, 3).map((p, idx) => (
        <div
          key={idx}
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation()
            onPillClick?.()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              e.stopPropagation()
              onPillClick?.()
            }
          }}
          className="text-left text-[10px] px-2 py-1 rounded-md font-bold uppercase truncate transition hover:translate-x-0.5 cursor-pointer"
          style={{
            background: `${p.color}33`,
            color: isToday
              ? 'var(--emerald-deep, #064e3b)'
              : 'var(--manuscript-cream, #fbf3df)',
            border: `1px solid ${p.color}`,
            letterSpacing: '0.10em',
          }}
          title={p.label}
        >
          {p.label}
        </div>
      ))}
      {pills.length > 3 && (
        <span
          className="text-[10px] font-bold"
          style={{
            color: isToday
              ? 'var(--emerald-deep, #064e3b)'
              : 'var(--gold-mid, #d4a017)',
          }}
        >
          +{pills.length - 3} more
        </span>
      )}
    </div>
  )
}

// ============================================================================
// Inline day-editor popover
// ============================================================================
interface DayEditorProps {
  entry: FastingEntry | null
  gregDate: string
  hijriDay: number
  hijriMonthName: string | null
  isRamadan: boolean
  isMonThu: boolean
  isWhiteDay: boolean
  onClose: () => void
}

const DayEditor: React.FC<DayEditorProps> = ({
  entry,
  gregDate,
  hijriDay,
  hijriMonthName,
  isRamadan,
  isMonThu,
  isWhiteDay,
  onClose,
}) => {
  const { success, error: showError } = useToast()
  const queryClient = useQueryClient()

  const [fasted, setFasted] = useState(!!entry?.fasted)
  const [donationAmount, setDonationAmount] = useState<string>(
    entry?.donation_amount?.toString() ?? ''
  )
  const [donationCurrency, setDonationCurrency] = useState<string>(
    entry?.donation_currency ?? 'TK'
  )
  const [goodDeed, setGoodDeed] = useState<string>(entry?.good_deed ?? '')
  const [goodDeedDone, setGoodDeedDone] = useState<boolean>(
    !!entry?.good_deed_done
  )
  const [notes, setNotes] = useState<string>(entry?.notes ?? '')

  // One-click fast toggle (mirrors Calendar's click-to-mark pattern).
  const toggleFast = useMutation({
    mutationFn: async () => {
      const nextFasted = !fasted
      const payload: Record<string, unknown> = {
        tracking_date: gregDate,
        fasted: nextFasted,
        notes: entry?.notes ?? null,
        donation_amount: entry?.donation_amount ?? null,
        donation_currency: entry?.donation_currency ?? 'TK',
        donation_note: entry?.donation_note ?? null,
        good_deed: entry?.good_deed ?? null,
        good_deed_done: entry?.good_deed_done ?? false,
      }
      return fastingService.upsert(payload as any)
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['fasting'] })
      setFasted(!!saved.fasted)
      success(saved.fasted ? 'Marked as fasted ✓' : 'Unmarked')
    },
    onError: (e: any) => {
      showError(e?.response?.data?.detail ?? 'Update failed')
    },
  })

  const upsert = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        tracking_date: gregDate,
        fasted,
        notes: notes || null,
        donation_amount: donationAmount ? Number(donationAmount) : null,
        donation_currency: donationCurrency || 'TK',
        donation_note: null,
        good_deed: goodDeed || null,
        good_deed_done: goodDeedDone,
      }
      return fastingService.upsert(payload as any)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fasting'] })
      success('Saved')
      onClose()
    },
    onError: (e: any) => {
      showError(e?.response?.data?.detail ?? 'Save failed')
    },
  })

  const remove = useMutation({
    mutationFn: async () => {
      if (!entry) return
      await fastingService.remove(entry.id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fasting'] })
      success('Deleted')
      onClose()
    },
    onError: (e: any) => {
      showError(e?.response?.data?.detail ?? 'Delete failed')
    },
  })

  const dayLabel = new Date(gregDate + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  const dayType = isRamadan
    ? 'Ramadan day'
    : isMonThu
      ? 'Sunnah fast (Mon/Thu)'
      : isWhiteDay
        ? 'White day (13/14/15)'
        : 'Voluntary / other'

  // Pick a relevant knowledge-base topic for this day (if any).
  const dayKnowledge = useMemo(() => {
    if (isRamadan) {
      return ALL_TOPICS.find((t) => t.id === 'RM001') ?? null
    }
    if (isMonThu) {
      return ALL_TOPICS.find((t) => t.id === 'WK003') ?? null
    }
    if (isWhiteDay) {
      return ALL_TOPICS.find((t) => t.id === 'WD001') ?? null
    }
    return null
  }, [isRamadan, isMonThu, isWhiteDay])

  return (
    <div
      className="absolute z-20 rounded-xl !p-4 w-[320px] sm:w-[360px]"
      style={{
        top: '100%',
        left: '50%',
        transform: 'translateX(-50%)',
        marginTop: 6,
        background:
          'linear-gradient(180deg, rgba(8, 36, 28, 0.98) 0%, rgba(4, 22, 18, 0.98) 100%)',
        border: '1px solid var(--gold-mid, #d4a017)',
        boxShadow:
          '0 10px 30px -6px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(212, 160, 23, 0.25)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <p
            className="text-[10px] uppercase font-bold"
            style={{
              color: 'var(--gold-mid, #d4a017)',
              letterSpacing: '0.18em',
            }}
          >
            {hijriDay} {hijriMonthName ?? ''}
          </p>
          <h2
            className="text-base font-bold mt-0.5 truncate"
            style={{
              color: 'var(--manuscript-cream, #fbf3df)',
              fontFamily: 'Georgia, "Times New Roman", serif',
            }}
          >
            {dayLabel}
          </h2>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 inline-flex items-center justify-center rounded-full transition shrink-0"
          style={{
            background: 'rgba(0, 0, 0, 0.30)',
            color: 'var(--gold-mid, #d4a017)',
            border: '1px solid var(--gold-mid, #d4a017)',
          }}
          aria-label="Close"
        >
          <X size={14} />
        </button>
      </div>
      <GoldDivider />

      {/* Fasted toggle (one-click) */}
      <button
        type="button"
        onClick={() => toggleFast.mutate()}
        disabled={toggleFast.isPending}
        className="mt-3 w-full flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition disabled:opacity-50"
        style={{
          background: fasted
            ? 'linear-gradient(135deg, var(--gold-mid) 0%, var(--gold-light) 100%)'
            : 'linear-gradient(180deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0.01) 100%)',
          border: '1px solid var(--gold-mid, #d4a017)',
        }}
      >
        <div className="flex items-center gap-2.5">
          {fasted ? (
            <CheckCircle2
              size={20}
              style={{ color: 'var(--emerald-deep, #064e3b)' }}
            />
          ) : (
            <Circle size={20} style={{ color: 'var(--gold-mid, #d4a017)' }} />
          )}
          <div className="text-left">
            <div
              className="text-sm font-bold"
              style={{
                color: fasted
                  ? 'var(--emerald-deep, #064e3b)'
                  : 'var(--manuscript-cream, #fbf3df)',
                fontFamily: 'Georgia, "Times New Roman", serif',
              }}
            >
              {fasted ? 'Fasted ✓' : 'Mark as fasted'}
            </div>
          </div>
        </div>
        {toggleFast.isPending ? (
          <Loader2
            size={14}
            className="animate-spin"
            style={{ color: 'var(--gold-mid, #d4a017)' }}
          />
        ) : (
          <span
            className="text-[9px] font-bold uppercase"
            style={{
              color: fasted
                ? 'var(--emerald-deep, #064e3b)'
                : 'var(--gold-mid, #d4a017)',
              letterSpacing: '0.18em',
            }}
          >
            {fasted ? 'Click to undo' : 'Click to mark'}
          </span>
        )}
      </button>

      {/* Sadaqah */}
      <div className="mt-3">
        <label
          className="block text-[10px] font-bold uppercase tracking-[0.18em] mb-1"
          style={{ color: 'var(--gold-mid, #d4a017)' }}
        >
          Sadaqah / Fitrah
        </label>
        <div className="flex gap-2">
          <div
            className="flex items-center gap-2 flex-1 rounded-lg px-2.5 py-1.5"
            style={{
              background: 'rgba(0, 0, 0, 0.30)',
              border: '1px solid var(--gold-mid, #d4a017)',
            }}
          >
            <CircleDollarSign
              size={14}
              style={{ color: 'var(--gold-mid, #d4a017)' }}
            />
            <input
              type="number"
              min="0"
              step="0.01"
              value={donationAmount}
              onChange={(e) => setDonationAmount(e.target.value)}
              className="bg-transparent outline-none w-full text-xs"
              style={{ color: 'var(--manuscript-cream, #fbf3df)' }}
            />
          </div>
          <input
            type="text"
            value={donationCurrency}
            onChange={(e) => setDonationCurrency(e.target.value.toUpperCase())}
            maxLength={8}
            className="rounded-lg px-2 py-1.5 w-16 text-xs"
            style={{
              background: 'rgba(0, 0, 0, 0.30)',
              border: '1px solid var(--gold-mid, #d4a017)',
              color: 'var(--manuscript-cream, #fbf3df)',
              fontFamily: 'Georgia, "Times New Roman", serif',
            }}
          />
        </div>
      </div>

      {/* Good deed (no mark button — just a text field) */}
      <div className="mt-2.5">
        <label
          className="block text-[10px] font-bold uppercase tracking-[0.18em] mb-1"
          style={{ color: 'var(--gold-mid, #d4a017)' }}
        >
          Good deed
        </label>
        <input
          type="text"
          value={goodDeed}
          onChange={(e) => {
            setGoodDeed(e.target.value)
            // Auto-mark as done when the user types something.
            if (e.target.value && !goodDeedDone) setGoodDeedDone(true)
            if (!e.target.value && goodDeedDone) setGoodDeedDone(false)
          }}
          className="w-full rounded-lg px-2.5 py-1.5 text-xs"
          style={{
            background: 'rgba(0, 0, 0, 0.30)',
            border: '1px solid var(--gold-mid, #d4a017)',
            color: 'var(--manuscript-cream, #fbf3df)',
          }}
        />
      </div>

      {/* Notes */}
      <div className="mt-2.5">
        <label
          className="block text-[10px] font-bold uppercase tracking-[0.18em] mb-1"
          style={{ color: 'var(--gold-mid, #d4a017)' }}
        >
          Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full rounded-lg px-2.5 py-1.5 text-xs"
          style={{
            background: 'rgba(0, 0, 0, 0.30)',
            border: '1px solid var(--gold-mid, #d4a017)',
            color: 'var(--manuscript-cream, #fbf3df)',
          }}
        />
      </div>

      {/* Learn — context-aware knowledge hint */}
      {dayKnowledge && (
        <details className="mt-2.5">
          <summary
            className="cursor-pointer font-bold uppercase text-[10px] flex items-center gap-1.5"
            style={{ color: 'var(--gold-light, #f0c75e)', letterSpacing: '0.18em' }}
          >
            <BookOpen size={10} /> Learn
          </summary>
          <div
            className="mt-1.5 rounded-lg p-2"
            style={{
              background: 'rgba(0, 0, 0, 0.30)',
              border: '1px solid var(--gold-deep, #9a6b0e)',
            }}
          >
            <p
              className="text-[11px] font-bold"
              style={{ color: 'var(--manuscript-cream, #fbf3df)' }}
            >
              {dayKnowledge.title}
            </p>
            {dayKnowledge.virtue && (
              <p
                className="text-[10px] mt-1 leading-relaxed"
                style={{ color: 'var(--manuscript-cream, #fbf3df)', opacity: 0.85 }}
              >
                <span
                  className="font-bold uppercase mr-1"
                  style={{ color: 'var(--gold-mid, #d4a017)' }}
                >
                  Virtue:
                </span>
                {dayKnowledge.virtue}
              </p>
            )}
            <p
              className="text-[10px] mt-1 cursor-pointer inline-block"
              style={{ color: 'var(--gold-light, #f0c75e)' }}
              onClick={() => {
                onClose()
                // Defer to next tick so DayEditor unmounts first
                setTimeout(() => {
                  const ev = new CustomEvent('open-knowledge-topic', { detail: dayKnowledge })
                  window.dispatchEvent(ev)
                }, 0)
              }}
            >
              View full knowledge →
            </p>
          </div>
        </details>
      )}

      {/* Actions */}
      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          onClick={() => upsert.mutate()}
          disabled={upsert.isPending}
          className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition inline-flex items-center gap-1 disabled:opacity-50"
          style={{
            background:
              'linear-gradient(135deg, var(--gold-mid) 0%, var(--gold-light) 100%)',
            color: 'var(--emerald-deep, #064e3b)',
            border: '1px solid var(--gold-deep, #9a6b0e)',
            letterSpacing: '0.18em',
          }}
        >
          {upsert.isPending ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Save size={12} />
          )}
          Save
        </button>
        {entry && (
          <button
            onClick={() => remove.mutate()}
            disabled={remove.isPending}
            className="px-2 py-1.5 rounded-lg text-[10px] font-bold uppercase transition inline-flex items-center gap-1 disabled:opacity-50"
            style={{
              background: 'rgba(0, 0, 0, 0.30)',
              color: 'var(--missed, #b91c1c)',
              border: '1px solid var(--gold-mid, #d4a017)',
              letterSpacing: '0.18em',
            }}
          >
            {remove.isPending ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Trash2 size={12} />
            )}
            Delete
          </button>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// StatTile
// ============================================================================
const StatTile: React.FC<{
  label: string
  value: React.ReactNode
  sub?: string
}> = ({ label, value, sub }) => (
  <div
    className="rounded-xl !p-3"
    style={{
      background:
        'linear-gradient(180deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.02) 100%)',
      border: '1px solid var(--gold-mid, #d4a017)',
      minWidth: 110,
    }}
  >
    <p
      className="text-[10px] uppercase font-bold"
      style={{ color: 'var(--gold-mid, #d4a017)', letterSpacing: '0.18em' }}
    >
      {label}
    </p>
    <p
      className="text-xl font-bold mt-1 truncate"
      style={{
        color: 'var(--manuscript-cream, #fbf3df)',
        fontFamily: 'Georgia, "Times New Roman", serif',
      }}
    >
      {value}
    </p>
    {sub && (
      <p
        className="text-[10px] mt-0.5"
        style={{ color: 'var(--gold-mid, #d4a017)' }}
      >
        {sub}
      </p>
    )}
  </div>
)

// ============================================================================
// Knowledge view + detail modal (mirrors Calendar.tsx ListView + EventDetailModal)
// ============================================================================
import {
  KNOWLEDGE_CATEGORIES,
  TOPICS_BY_CATEGORY,
  ALL_TOPICS,
  RULING_META,
  HADITH_INDEX,
  QURAN_REFS,
  MADHHAB_GROUPS,
  parseRefCodes,
  gradeColor,
  getCategoryMeta,
  getOccasionsForHijriDay,
  type KnowledgeCategoryId,
  type KnowledgeTopic,
} from '../data/fastingKnowledge'

const KN_PAGE_SIZE = 20

const KnowledgeView: React.FC<{
  activeCategory: KnowledgeCategoryId | null
  onCategoryChange: (cat: KnowledgeCategoryId | null) => void
  onTopicClick: (topic: KnowledgeTopic) => void
}> = ({ activeCategory, onCategoryChange, onTopicClick }) => {
  const [page, setPage] = useState(1)

  // Reset to page 1 on filter change
  useEffect(() => {
    setPage(1)
  }, [activeCategory])

  const filtered = activeCategory
    ? TOPICS_BY_CATEGORY[activeCategory]
    : ALL_TOPICS

  const totalPages = Math.max(1, Math.ceil(filtered.length / KN_PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * KN_PAGE_SIZE
  const pageTopics = filtered.slice(start, start + KN_PAGE_SIZE)

  // Group page topics by category (so "All" still shows category headers)
  const grouped = useMemo(() => {
    const map = new Map<KnowledgeCategoryId, KnowledgeTopic[]>()
    for (const t of pageTopics) {
      if (!map.has(t.categoryId)) map.set(t.categoryId, [])
      map.get(t.categoryId)!.push(t)
    }
    return map
  }, [pageTopics])

  return (
    <div>
      {/* ===== Filter chips ===== */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <Filter size={14} style={{ color: 'var(--gold-mid, #d4a017)' }} />
        <span
          className="text-[10px] uppercase font-bold"
          style={{ color: 'var(--gold-mid, #d4a017)', letterSpacing: '0.18em' }}
        >
          Filter
        </span>
        <button
          onClick={() => onCategoryChange(null)}
          className="px-2.5 py-1 rounded-full text-[10px] uppercase font-bold transition"
          style={
            activeCategory === null
              ? {
                  background:
                    'linear-gradient(135deg, var(--gold-mid) 0%, var(--gold-light) 100%)',
                  color: 'var(--emerald-deep, #064e3b)',
                  border: '1px solid var(--gold-deep, #9a6b0e)',
                  letterSpacing: '0.18em',
                }
              : {
                  color: 'var(--gold-mid, #d4a017)',
                  background: 'rgba(0, 0, 0, 0.30)',
                  border: '1px solid var(--gold-mid, #d4a017)',
                  letterSpacing: '0.18em',
                }
          }
        >
          All ({ALL_TOPICS.length})
        </button>
        {KNOWLEDGE_CATEGORIES.map((c) => {
          const count = TOPICS_BY_CATEGORY[c.id].length
          const Icon = c.icon
          const active = activeCategory === c.id
          return (
            <button
              key={c.id}
              onClick={() => onCategoryChange(active ? null : c.id)}
              className="px-2.5 py-1 rounded-full text-[10px] uppercase font-bold transition inline-flex items-center gap-1.5"
              style={
                active
                  ? {
                      background: c.color,
                      color: '#ffffff',
                      border: `1px solid ${c.color}`,
                      letterSpacing: '0.18em',
                    }
                  : {
                      color: 'var(--gold-mid, #d4a017)',
                      background: 'rgba(0, 0, 0, 0.30)',
                      border: '1px solid var(--gold-mid, #d4a017)',
                      letterSpacing: '0.18em',
                    }
              }
            >
              <Icon size={10} />
              {c.shortLabel} ({count})
            </button>
          )
        })}
      </div>

      <div className="mb-4">
        <GoldDivider />
      </div>

      {/* ===== Grouped cards ===== */}
      <div className="space-y-6">
        {Array.from(grouped.entries()).map(([catId, topics]) => {
          const cat = getCategoryMeta(catId)
          const Icon = cat.icon
          return (
            <div key={catId}>
              <h3
                className="text-sm font-bold uppercase mb-3 flex items-center gap-2"
                style={{
                  color: 'var(--manuscript-cream, #fbf3df)',
                  fontFamily: 'Georgia, "Times New Roman", serif',
                  letterSpacing: '0.14em',
                }}
              >
                <Icon size={14} style={{ color: cat.color }} />
                {cat.label}
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{
                    background: 'rgba(212, 160, 23, 0.18)',
                    color: 'var(--gold-light, #f0c75e)',
                    border: '1px solid var(--gold-deep, #9a6b0e)',
                    letterSpacing: '0.18em',
                  }}
                >
                  {topics.length}
                </span>
              </h3>
              <div className="space-y-2">
                {topics.map((t) => {
                  const r = RULING_META[t.ruling]
                  return (
                    <div
                      key={t.id}
                      className="rounded-xl p-4 flex items-center gap-4"
                      style={{
                        background:
                          'linear-gradient(180deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.02) 100%)',
                        border: '1px solid var(--gold-mid, #d4a017)',
                        borderLeftWidth: 4,
                        borderLeftColor: cat.color,
                      }}
                    >
                      <div
                        className="w-10 h-10 rounded-full inline-flex items-center justify-center shrink-0"
                        style={{
                          background: 'rgba(0, 0, 0, 0.30)',
                          color: cat.color,
                          border: `1px solid ${cat.color}`,
                        }}
                      >
                        <Icon size={16} />
                      </div>
                      <button
                        onClick={() => onTopicClick(t)}
                        className="flex-1 min-w-0 text-left"
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <p
                            className="font-bold"
                            style={{
                              color: 'var(--manuscript-cream, #fbf3df)',
                              fontFamily: 'Georgia, "Times New Roman", serif',
                            }}
                          >
                            {t.title}
                          </p>
                          <span
                            className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full"
                            style={{
                              background: `${r.color}33`,
                              color: r.color,
                              border: `1px solid ${r.color}`,
                              letterSpacing: '0.18em',
                            }}
                          >
                            {r.label}
                          </span>
                        </div>
                        {t.arabic && (
                          <p
                            className="text-sm mt-0.5"
                            dir="rtl"
                            style={{ color: 'var(--gold-mid, #d4a017)' }}
                          >
                            {t.arabic}
                          </p>
                        )}
                        {t.meta && (
                          <p
                            className="text-[11px] mt-0.5"
                            style={{ color: 'var(--gold-mid, #d4a017)', opacity: 0.85 }}
                          >
                            {t.meta}
                          </p>
                        )}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        {filtered.length === 0 && (
          <p
            className="text-sm uppercase font-bold text-center py-8"
            style={{ color: 'var(--gold-mid, #d4a017)', letterSpacing: '0.18em' }}
          >
            No knowledge topics in this category.
          </p>
        )}
      </div>

      {/* ===== Pagination ===== */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2 flex-wrap">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage === 1}
            className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: 'rgba(0, 0, 0, 0.30)',
              color: 'var(--gold-mid, #d4a017)',
              border: '1px solid var(--gold-mid, #d4a017)',
              letterSpacing: '0.18em',
            }}
          >
            <ChevronLeft size={14} /> Prev
          </button>
          <span
            className="px-3 py-1.5 rounded-lg text-xs font-bold"
            style={{
              color: 'var(--manuscript-cream, #fbf3df)',
              fontFamily: 'Georgia, "Times New Roman", serif',
              letterSpacing: '0.14em',
            }}
          >
            Page {safePage} / {totalPages}
            <span
              className="ml-2 text-[10px] uppercase"
              style={{ color: 'var(--gold-mid, #d4a017)' }}
            >
              ({start + 1}–{Math.min(start + KN_PAGE_SIZE, filtered.length)} of {filtered.length})
            </span>
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage === totalPages}
            className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: 'rgba(0, 0, 0, 0.30)',
              color: 'var(--gold-mid, #d4a017)',
              border: '1px solid var(--gold-mid, #d4a017)',
              letterSpacing: '0.18em',
            }}
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Knowledge detail modal — expandable Hadith / Quran / Madhhab sections
// ============================================================================
const KnowledgeDetailModal: React.FC<{
  topic: KnowledgeTopic
  onClose: () => void
}> = ({ topic, onClose }) => {
  const cat = getCategoryMeta(topic.categoryId)
  const r = RULING_META[topic.ruling]
  const hadithCodes = parseRefCodes(topic.hadithRef, 'H')
  const quranCodes = parseRefCodes(topic.quranRef, 'Q')
  const madhCodes = parseRefCodes(topic.madhhabNote, 'MAD')
  // For madhhab-sheet rows, the question group is already on the topic
  const directGroup = topic.questionGroup

  // Build ordered list of madhhab group keys to display
  const madhhabGroupKeys = Array.from(
    new Set([...madhCodes.map((c) => c.replace('MAD', '')), ...(directGroup ? [directGroup] : [])])
  )

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4"
      style={{ background: 'rgba(8, 24, 18, 0.65)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl p-6 sm:p-8 max-w-3xl w-full"
        style={{
          background:
            'linear-gradient(180deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.02) 100%)',
          border: '1px solid var(--gold-mid, #d4a017)',
          borderTop: `4px solid ${cat.color}`,
          boxShadow: '0 24px 48px -16px rgba(0, 0, 0, 0.6)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-start mb-4 gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: cat.color }}
              />
              <span
                className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full"
                style={{
                  background: `${r.color}33`,
                  color: r.color,
                  border: `1px solid ${r.color}`,
                  letterSpacing: '0.18em',
                }}
              >
                {r.label}
              </span>
              <span
                className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full"
                style={{
                  background: `${cat.color}33`,
                  color: cat.color,
                  border: `1px solid ${cat.color}`,
                  letterSpacing: '0.18em',
                }}
              >
                {cat.label}
              </span>
            </div>
            <h2
              className="text-2xl font-bold"
              style={{
                color: 'var(--manuscript-cream, #fbf3df)',
                fontFamily: 'Georgia, "Times New Roman", serif',
              }}
            >
              {topic.title}
            </h2>
            {topic.arabic && (
              <p
                className="text-base mt-1"
                dir="rtl"
                style={{
                  color: 'var(--gold-mid, #d4a017)',
                  fontFamily: 'Georgia, "Times New Roman", serif',
                }}
              >
                {topic.arabic}
              </p>
            )}
            {topic.meta && (
              <p
                className="text-xs mt-1"
                style={{ color: 'var(--gold-mid, #d4a017)', opacity: 0.8 }}
              >
                {topic.meta}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg transition shrink-0"
            style={{
              background: 'transparent',
              color: 'var(--gold-mid, #d4a017)',
              border: '1px solid var(--gold-mid, #d4a017)',
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div
          className="text-sm mb-4 pb-4"
          style={{
            color: 'var(--gold-mid, #d4a017)',
            borderBottom: '1px solid var(--gold-deep, #9a6b0e)',
          }}
        >
          {topic.meta && <span>{topic.meta}</span>}
        </div>

        <div className="space-y-3">
          {/* "Why / Reason" (primary description) */}
          {topic.why && (
            <div>
              <p
                className="text-[10px] uppercase font-bold mb-1"
                style={{ color: 'var(--gold-light, #f0c75e)', letterSpacing: '0.18em' }}
              >
                Why / Background
              </p>
              <p
                className="text-sm leading-relaxed"
                style={{ color: 'var(--manuscript-cream, #fbf3df)' }}
              >
                {topic.why}
              </p>
            </div>
          )}

          {/* Virtue */}
          {topic.virtue && (
            <details open className="mt-2">
              <summary
                className="cursor-pointer font-bold uppercase text-[10px]"
                style={{ color: 'var(--gold-light, #f0c75e)', letterSpacing: '0.18em' }}
              >
                Virtue
              </summary>
              <p
                className="mt-2 text-sm leading-relaxed"
                style={{ color: 'var(--manuscript-cream, #fbf3df)', opacity: 0.92 }}
              >
                {topic.virtue}
              </p>
            </details>
          )}

          {/* Ruling detail (the meat of the topic) */}
          {topic.rulingDetail && (
            <details open className="mt-2">
              <summary
                className="cursor-pointer font-bold uppercase text-[10px]"
                style={{ color: 'var(--gold-light, #f0c75e)', letterSpacing: '0.18em' }}
              >
                Ruling detail
              </summary>
              <p
                className="mt-2 text-sm leading-relaxed"
                style={{ color: 'var(--manuscript-cream, #fbf3df)', opacity: 0.92 }}
              >
                {topic.rulingDetail}
              </p>
            </details>
          )}

          {/* Variant / narrator note */}
          {topic.variantNote && (
            <details className="mt-2">
              <summary
                className="cursor-pointer font-bold uppercase text-[10px]"
                style={{ color: 'var(--gold-light, #f0c75e)', letterSpacing: '0.18em' }}
              >
                Variant / narrator note
              </summary>
              <p
                className="mt-2 text-sm leading-relaxed"
                style={{ color: 'var(--manuscript-cream, #fbf3df)', opacity: 0.92 }}
              >
                {topic.variantNote}
              </p>
            </details>
          )}

          {/* Hadith references */}
          {hadithCodes.length > 0 && (
            <details className="mt-2">
              <summary
                className="cursor-pointer font-bold uppercase text-[10px]"
                style={{ color: 'var(--gold-light, #f0c75e)', letterSpacing: '0.18em' }}
              >
                Hadith references ({hadithCodes.length})
              </summary>
              <div className="mt-2 space-y-2">
                {hadithCodes.map((code) => {
                  const h = HADITH_INDEX[code]
                  if (!h) return null
                  return (
                    <div
                      key={code}
                      className="rounded-lg p-3"
                      style={{
                        background: 'rgba(0, 0, 0, 0.30)',
                        border: '1px solid var(--gold-deep, #9a6b0e)',
                        borderTop: `3px solid ${gradeColor(h.grade)}`,
                      }}
                    >
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span
                          className="text-[10px] font-bold uppercase"
                          style={{ color: 'var(--gold-mid, #d4a017)', letterSpacing: '0.18em' }}
                        >
                          {h.id}
                        </span>
                        <span
                          className="font-bold text-sm"
                          style={{ color: 'var(--manuscript-cream, #fbf3df)' }}
                        >
                          {h.narrator}
                        </span>
                        <span
                          className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full"
                          style={{
                            background: `${gradeColor(h.grade)}33`,
                            color: gradeColor(h.grade),
                            border: `1px solid ${gradeColor(h.grade)}`,
                            letterSpacing: '0.18em',
                          }}
                        >
                          {h.grade}
                        </span>
                      </div>
                      <p
                        className="text-[11px]"
                        style={{ color: 'var(--gold-mid, #d4a017)' }}
                      >
                        {h.collection} — {h.referenceNumber}
                      </p>
                      <p
                        className="text-sm mt-1 leading-relaxed"
                        style={{ color: 'var(--manuscript-cream, #fbf3df)', opacity: 0.92 }}
                      >
                        {h.summary}
                      </p>
                    </div>
                  )
                })}
              </div>
            </details>
          )}

          {/* Quran references */}
          {quranCodes.length > 0 && (
            <details className="mt-2">
              <summary
                className="cursor-pointer font-bold uppercase text-[10px]"
                style={{ color: 'var(--gold-light, #f0c75e)', letterSpacing: '0.18em' }}
              >
                Qur'an references ({quranCodes.length})
              </summary>
              <div className="mt-2 space-y-2">
                {quranCodes.map((code) => {
                  const q = QURAN_REFS[code]
                  if (!q) return null
                  return (
                    <div
                      key={code}
                      className="rounded-lg p-3"
                      style={{
                        background: 'rgba(0, 0, 0, 0.30)',
                        border: '1px solid var(--gold-deep, #9a6b0e)',
                        borderTop: `3px solid #fbbf24`,
                      }}
                    >
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span
                          className="text-[10px] font-bold uppercase"
                          style={{ color: 'var(--gold-mid, #d4a017)', letterSpacing: '0.18em' }}
                        >
                          {q.id}
                        </span>
                        <span
                          className="font-bold text-sm"
                          style={{ color: 'var(--manuscript-cream, #fbf3df)' }}
                        >
                          {q.surah} {q.ayah}
                        </span>
                        <span
                          className="text-[10px] uppercase"
                          style={{ color: 'var(--gold-mid, #d4a017)' }}
                        >
                          · {q.topic}
                        </span>
                      </div>
                      <p
                        className="text-sm leading-relaxed"
                        style={{ color: 'var(--manuscript-cream, #fbf3df)', opacity: 0.92 }}
                      >
                        {q.summary}
                      </p>
                    </div>
                  )
                })}
              </div>
            </details>
          )}

          {/* Madhhab opinions */}
          {madhhabGroupKeys.length > 0 && (
            <details className="mt-2">
              <summary
                className="cursor-pointer font-bold uppercase text-[10px]"
                style={{ color: 'var(--gold-light, #f0c75e)', letterSpacing: '0.18em' }}
              >
                Scholarly opinions ({madhhabGroupKeys.length} question group{madhhabGroupKeys.length > 1 ? 's' : ''})
              </summary>
              <div className="mt-2 space-y-3">
                {madhhabGroupKeys.map((groupKey) => {
                  const rows = MADHHAB_GROUPS[groupKey]
                  if (!rows || rows.length === 0) return null
                  const question = rows[0].question
                  return (
                    <div
                      key={groupKey}
                      className="rounded-lg p-3"
                      style={{
                        background: 'rgba(0, 0, 0, 0.25)',
                        border: '1px solid var(--gold-deep, #9a6b0e)',
                      }}
                    >
                      <p
                        className="text-[10px] font-bold uppercase mb-2"
                        style={{ color: 'var(--gold-mid, #d4a017)', letterSpacing: '0.18em' }}
                      >
                        {groupKey} · {question}
                      </p>
                      <div className="space-y-2">
                        {rows.map((row) => (
                          <div
                            key={row.id}
                            className="rounded-md p-2"
                            style={{
                              background: 'rgba(0, 0, 0, 0.30)',
                              borderLeft: `3px solid ${gradeColor('Contested')}`,
                            }}
                          >
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span
                                className="text-[10px] font-bold uppercase"
                                style={{ color: 'var(--manuscript-cream, #fbf3df)', letterSpacing: '0.18em' }}
                              >
                                {row.madhhab}
                              </span>
                              <span
                                className="text-[10px]"
                                style={{ color: 'var(--gold-mid, #d4a017)' }}
                              >
                                {row.id}
                              </span>
                            </div>
                            <p
                              className="text-sm leading-relaxed"
                              style={{ color: 'var(--manuscript-cream, #fbf3df)', opacity: 0.92 }}
                            >
                              {row.position}
                            </p>
                            <p
                              className="text-[10px] mt-1"
                              style={{ color: 'var(--gold-mid, #d4a017)', opacity: 0.7 }}
                            >
                              {row.sourceRef}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </details>
          )}

          {/* Hadith sheet row — show collection/grade inline */}
          {topic.categoryId === 'hadiths' && topic.summary && (
            <div>
              <p
                className="text-[10px] uppercase font-bold mb-1"
                style={{ color: 'var(--gold-light, #f0c75e)', letterSpacing: '0.18em' }}
              >
                Paraphrased summary
              </p>
              <p
                className="text-sm leading-relaxed"
                style={{ color: 'var(--manuscript-cream, #fbf3df)' }}
              >
                {topic.summary}
              </p>
            </div>
          )}

          {/* Quran sheet row — show summary inline */}
          {topic.categoryId === 'quran' && topic.summary && (
            <div>
              <p
                className="text-[10px] uppercase font-bold mb-1"
                style={{ color: 'var(--gold-light, #f0c75e)', letterSpacing: '0.18em' }}
              >
                Paraphrased summary
              </p>
              <p
                className="text-sm leading-relaxed"
                style={{ color: 'var(--manuscript-cream, #fbf3df)' }}
              >
                {topic.summary}
              </p>
            </div>
          )}

          {/* Madhhab sheet row — show position inline (in case no group rendered) */}
          {topic.categoryId === 'madhhabs' && topic.position && (
            <div>
              <p
                className="text-[10px] uppercase font-bold mb-1"
                style={{ color: 'var(--gold-light, #f0c75e)', letterSpacing: '0.18em' }}
              >
                {topic.madhhab} position
              </p>
              <p
                className="text-sm leading-relaxed"
                style={{ color: 'var(--manuscript-cream, #fbf3df)' }}
              >
                {topic.position}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// MorePopover — fixed-position popover for "+N more" occasion overflow
// ----------------------------------------------------------------------------
// Renders at the viewport level (position: fixed) so it never gets clipped
// or overlapped by sibling grid cells.  Computes the best position (above vs
// below the trigger) based on available viewport space.
// ============================================================================
const MorePopover: React.FC<{
  triggerRef: React.RefObject<HTMLElement>
  occasions: KnowledgeTopic[]
  onPick: (occ: KnowledgeTopic) => void
  onClose: () => void
}> = ({ triggerRef, occasions, onPick, onClose }) => {
  const popoverRef = useRef<HTMLDivElement>(null)
  const [coords, setCoords] = useState<{
    top: number
    left: number
    width: number
    maxHeight: number
  } | null>(null)

  useLayoutEffect(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top
    const popoverHeight = Math.min(
      220,
      occasions.length * 30 + 16 // ~30px per item + padding
    )
    // Place below if there's room; otherwise flip up.
    const placeBelow = spaceBelow >= popoverHeight + 8 || spaceBelow >= spaceAbove
    const top = placeBelow
      ? rect.bottom + 4
      : Math.max(8, rect.top - popoverHeight - 4)
    const maxHeight = placeBelow
      ? Math.min(220, spaceBelow - 8)
      : Math.min(220, spaceAbove - 8)
    setCoords({
      top,
      left: rect.left,
      width: Math.max(rect.width, 180),
      maxHeight: Math.max(100, maxHeight),
    })
  }, [triggerRef, occasions.length])

  // Close on outside click / Escape
  useEffect(() => {
    if (!coords) return
    const onMouseDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (popoverRef.current?.contains(t)) return
      if (triggerRef.current?.contains(t)) return
      onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [coords, onClose, triggerRef])

  if (!coords) return null

  return ReactDOM.createPortal(
    <div
      ref={popoverRef}
      className="fixed z-50 rounded-md p-1.5 space-y-1"
      style={{
        top: coords.top,
        left: coords.left,
        width: coords.width,
        maxHeight: coords.maxHeight,
        overflowY: 'auto',
        background:
          'linear-gradient(180deg, rgba(8, 36, 28, 0.98) 0%, rgba(4, 22, 18, 0.98) 100%)',
        border: '1px solid var(--gold-mid, #d4a017)',
        boxShadow:
          '0 8px 20px -4px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(212, 160, 23, 0.25)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {occasions.map((occ) => {
        const r = RULING_META[occ.ruling]
        return (
          <button
            key={occ.id}
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onPick(occ)
            }}
            className="w-full text-left text-[10px] px-2 py-1 rounded-md font-bold uppercase truncate transition hover:translate-x-0.5"
            style={{
              background: `${r.color}33`,
              color: 'var(--manuscript-cream, #fbf3df)',
              border: `1px solid ${r.color}`,
              letterSpacing: '0.10em',
            }}
            title={occ.title}
          >
            {occ.title}
          </button>
        )
      })}
    </div>,
    document.body
  )
}

// ============================================================================
// Main page
// ============================================================================
type ViewMode = 'month' | 'knowledge'

export const Fasting: React.FC = () => {
  const { error: showError } = useToast()
  const todayStr = todayIso()

  // ----- View / nav state -----
  const [viewMode, setViewMode] = useState<ViewMode>('month')
  const [activeYear, setActiveYear] = useState<number | null>(null)
  const [activeMonth, setActiveMonth] = useState<number | null>(null)

  // "On This Day" browse state.
  const [onThisDayMonth, setOnThisDayMonth] = useState<number | null>(null)
  const [onThisDayDay, setOnThisDayDay] = useState<number | null>(null)

  // Inline popover: which cell is open. Stored as (gregDate, hijriDay).
  // Only one is open at a time — clicking another cell replaces this.
  const [openEditor, setOpenEditor] = useState<{
    gregDate: string
    hijriDay: number
  } | null>(null)

  // Knowledge view state (4th tab in segmented control)
  const [knowledgeCategory, setKnowledgeCategory] = useState<KnowledgeCategoryId | null>(null)
  const [selectedKnowledgeTopic, setSelectedKnowledgeTopic] = useState<KnowledgeTopic | null>(null)

  // "more" popover state — tracks which day's overflow popover is open
  const [morePopover, setMorePopover] = useState<{ gregDate: string; hijriDay: number } | null>(null)
  // Ref to the trigger button element (set on click) for fixed positioning
  const moreTriggerRef = useRef<HTMLElement | null>(null)

  // Close the "more" popover on month change
  useEffect(() => {
    setMorePopover(null)
  }, [activeYear, activeMonth])

  // Listen for "open knowledge topic" events from the DayEditor "Learn" link
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<KnowledgeTopic>
      if (ce.detail) {
        setViewMode('knowledge')
        setSelectedKnowledgeTopic(ce.detail)
      }
    }
    window.addEventListener('open-knowledge-topic', handler as EventListener)
    return () => window.removeEventListener('open-knowledge-topic', handler as EventListener)
  }, [])

  // ----- "Today" query (Hijri + Gregorian) -----
  const todayQuery = useQuery<HijriToday>({
    queryKey: ['hijri-today'],
    queryFn: async () => {
      const r = await api.get('/prayer-times/islamic-date', {
        params: { target_date: todayStr },
      })
      return {
        gregorianDate: r.data.gregorian_date,
        hijriDate: r.data.hijri_date,
        hijriDateCompact: r.data.hijri_date_compact,
        hijriDay: r.data.hijri_day,
        hijriMonth: r.data.hijri_month,
        hijriMonthNumber: r.data.hijri_month_number,
        hijriYear: r.data.hijri_year,
      }
    },
  })

  // Default the active month to today's Hijri month on first load.
  useEffect(() => {
    if (activeYear !== null) return
    if (todayQuery.data?.hijriYear) setActiveYear(todayQuery.data.hijriYear)
  }, [todayQuery.data, activeYear])
  useEffect(() => {
    if (activeMonth !== null) return
    if (todayQuery.data?.hijriMonthNumber) {
      setActiveMonth(todayQuery.data.hijriMonthNumber)
    }
  }, [todayQuery.data, activeMonth])
  useEffect(() => {
    if (onThisDayMonth == null && todayQuery.data) {
      setOnThisDayMonth(todayQuery.data.hijriMonthNumber)
    }
    if (onThisDayDay == null && todayQuery.data) {
      setOnThisDayDay(todayQuery.data.hijriDay)
    }
  }, [todayQuery.data, onThisDayMonth, onThisDayDay])

  const year = activeYear ?? todayQuery.data?.hijriYear ?? 1447
  const month = activeMonth ?? todayQuery.data?.hijriMonthNumber ?? 1

  // ----- Data -----
  const entriesQuery = useQuery<FastingEntry[]>({
    queryKey: ['fasting', 'month', year, month],
    queryFn: () => fastingService.listByHijriMonth(year, month),
  })
  const summaryQuery = useQuery<FastingMonthSummary>({
    queryKey: ['fasting', 'summary', year, month],
    queryFn: () => fastingService.monthSummary(year, month),
  })
  const entries = entriesQuery.data ?? []

  // Look up entries by Gregorian date (for the Events list / popover that
  // already has a real ISO date).
  const entryByDate = useMemo(() => {
    const m = new Map<string, FastingEntry>()
    for (const e of entries) m.set(e.date, e)
    return m
  }, [entries])

  // Look up entries by Hijri coordinates (for the month grid, which has
  // to display the entry on the cell the user actually marked, even when
  // the frontend's approximateGregorianDate() drifts by ±1 day from the
  // server-stored Gregorian date). Key format: `${y}|${m}|${d}`.
  const entryByHijri = useMemo(() => {
    const m = new Map<string, FastingEntry>()
    for (const e of entries) {
      if (
        e.hijri_year == null ||
        e.hijri_month == null ||
        e.hijri_day == null
      ) {
        continue
      }
      m.set(`${e.hijri_year}|${e.hijri_month}|${e.hijri_day}`, e)
    }
    return m
  }, [entries])

  // ----- Derived state -----
  const monthLength = HIJRI_MONTH_LENGTHS[month - 1] ?? 30
  const firstWeekday = calibratedFirstWeekday(
    year,
    month,
    todayQuery.data?.hijriDay,
    todayQuery.data?.gregorianDate,
    todayQuery.data?.hijriYear,
    todayQuery.data?.hijriMonthNumber
  )
  const isCurrentMonth =
    todayQuery.data != null &&
    todayQuery.data.hijriYear === year &&
    todayQuery.data.hijriMonthNumber === month

  // Map of Hijri day -> notable fasting occasions (for cell badges)
  const occasionsByDay = useMemo(() => {
    const m = new Map<number, KnowledgeTopic[]>()
    for (let d = 1; d <= monthLength; d++) {
      const occ = getOccasionsForHijriDay(month, d)
      if (occ.length > 0) m.set(d, occ)
    }
    return m
  }, [month, monthLength])

  // ----- Handlers -----
  const goToPrevMonth = () => {
    if (month === 1) {
      setActiveMonth(12)
      setActiveYear((y) => (y ?? 1447) - 1)
    } else {
      setActiveMonth(month - 1)
    }
    setOpenEditor(null)
  }
  const goToNextMonth = () => {
    if (month === 12) {
      setActiveMonth(1)
      setActiveYear((y) => (y ?? 1447) + 1)
    } else {
      setActiveMonth(month + 1)
    }
    setOpenEditor(null)
  }


  if (entriesQuery.isError) showError('Failed to load fasting entries')
  if (summaryQuery.isError) showError('Failed to load month summary')

  // ----- "On This Day" preview -----
  const onThisDayEntry = useMemo(() => {
    if (onThisDayMonth == null || onThisDayDay == null) return null
    // Prefer the Hijri-keyed lookup; fall back to the approximate
    // Gregorian date for legacy rows.
    const hijriKey = `${year}|${onThisDayMonth}|${onThisDayDay}`
    const byHijri = entryByHijri.get(hijriKey)
    if (byHijri) return byHijri
    const targetGreg = calibratedGregorianDate(
      onThisDayDay,
      todayQuery.data?.hijriDay,
      todayQuery.data?.gregorianDate,
      year,
      onThisDayMonth
    )
    return entryByDate.get(targetGreg) ?? null
  }, [entryByDate, entryByHijri, onThisDayMonth, onThisDayDay, year])

  // Inline day-editor data for the currently open popover. Prefer the
  // Hijri-keyed lookup so the popover reflects the entry the user
  // actually marked (the approximate Gregorian date may be off by a day).
  const openEditorEntry = openEditor
    ? (() => {
        const hijriKey = `${year}|${month}|${openEditor.hijriDay}`
        return (
          entryByHijri.get(hijriKey) ??
          entryByDate.get(openEditor.gregDate) ??
          null
        )
      })()
    : null
  const openEditorHijriMonthName = openEditor
    ? openEditorEntry?.hijri_month_name ?? HIJRI_MONTHS_EN[month - 1]
    : null
  const openEditorIsRamadan = month === 9
  const openEditorIsMonThu = openEditor
    ? [0, 3].includes(new Date(openEditor.gregDate + 'T00:00:00').getDay())
    : false
  const openEditorIsWhiteDay = openEditor
    ? openEditor.hijriDay >= 13 && openEditor.hijriDay <= 15
    : false

  const s = summaryQuery.data

  // Quick label for the hero stat-tile (matches the Prayer Tracker style
  // of "5 prayers today" — here we say "X fasts this month").
  const monthFastedLabel = s ? `${s.fasted_days} / ${s.total_days}` : '—'
  const streakLabel = s
    ? `${s.fasted_days}-day streak`
    : '0-day streak'

  return (
    <div
      className="max-w-[1400px] mx-auto px-4 py-8 md:pt-6"
      onClick={() => setOpenEditor(null)}
    >
      {/* ===== Hero / page header (Prayer Tracker style) ===== */}
      <OrnateCard
        variant="dark"
        topBar
        corners="all"
        className="!p-6 sm:!p-8 relative overflow-hidden mb-6"
      >
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div
            className="absolute -top-24 -right-24 w-72 h-72 rounded-full blur-3xl"
            style={{
              background:
                'radial-gradient(circle, rgba(240,199,94,0.18) 0%, transparent 70%)',
            }}
          />
          <div
            className="absolute -bottom-20 -left-20 w-60 h-60 rounded-full blur-3xl"
            style={{
              background:
                'radial-gradient(circle, rgba(212,160,23,0.12) 0%, transparent 70%)',
            }}
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

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="min-w-0">
            <div
              className="flex items-center gap-2 text-[11px] uppercase font-bold"
              style={{
                color: 'var(--gold-glow)',
                letterSpacing: '0.2em',
              }}
            >
              <Sparkles size={12} />
              {todayQuery.data?.gregorianDate ?? 'Today'}
            </div>
            <h1
              className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight"
              style={{
                color: 'var(--manuscript-cream)',
                fontFamily: 'Georgia, "Times New Roman", serif',
              }}
            >
              Fasting Tracker
            </h1>
            <p
              className="mt-1 text-sm max-w-md"
              style={{
                color: 'var(--manuscript-cream)',
                opacity: 0.82,
              }}
            >
              Build a steady rhythm of Ramadan, Sunnah fasts, sadaqah and
              good deeds on the Hijri calendar.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition border"
                style={{
                  background:
                    'linear-gradient(135deg, rgba(240,199,94,0.18) 0%, rgba(212,160,23,0.10) 100%)',
                  color: 'var(--gold-glow)',
                  borderColor: 'var(--gold-mid)',
                  letterSpacing: '0.16em',
                }}
              >
                <Moon size={12} /> {HIJRI_MONTHS_EN[(month ?? 1) - 1]}{' '}
                {year} AH
              </span>
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition border"
                style={{
                  background: 'rgba(251,243,223,0.10)',
                  color: 'var(--manuscript-cream)',
                  borderColor: 'var(--gold-mid)',
                  letterSpacing: '0.16em',
                }}
              >
                <CheckCircle2 size={12} /> {streakLabel}
              </span>
            </div>
          </div>
        </div>
      </OrnateCard>

      {/* ===== View-mode tabs (Prayer Tracker style segmented control) ===== */}
      <OrnateCard
        variant="dark"
        topBar={false}
        corners="all"
        className="!p-3 flex items-center justify-between flex-wrap gap-3 mb-6"
      >
        <div
          className="inline-flex p-1 rounded-xl gap-1"
          style={{
            background: 'rgba(0,0,0,0.25)',
            border: '1px solid var(--gold-mid)',
          }}
        >
          {([
            { id: 'month' as const, label: 'Month', icon: <CalendarDays size={12} /> },
            { id: 'knowledge' as const, label: 'Knowledge', icon: <BookOpen size={12} /> },
          ]).map((t) => {
            const isActive = viewMode === t.id
            return (
              <button
                key={t.id}
                onClick={() => setViewMode(t.id)}
                className="px-4 py-1.5 text-xs font-bold uppercase rounded-lg transition inline-flex items-center gap-1.5"
                style={
                  isActive
                    ? {
                        background:
                          'linear-gradient(135deg, var(--gold-mid) 0%, var(--gold-light) 100%)',
                        color: 'var(--emerald-deep)',
                        border: '1px solid var(--gold-deep)',
                        letterSpacing: '0.16em',
                      }
                    : {
                        background: 'transparent',
                        color: 'var(--manuscript-cream)',
                        border: '1px solid transparent',
                        opacity: 0.85,
                        letterSpacing: '0.16em',
                      }
                }
              >
                {t.icon}
                {t.label}
              </button>
            )
          })}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-[10px] uppercase font-semibold"
            style={{
              color: 'var(--gold-mid)',
              letterSpacing: '0.18em',
            }}
          >
            {HIJRI_MONTHS_EN[(month ?? 1) - 1]} {year} AH · {monthLength} days
          </span>
        </div>
      </OrnateCard>

      {/* ===== Month view ===== */}
      {viewMode === 'month' && (
        <OrnateCard
          variant="dark"
          topBar
          corners="all"
          className="!p-6 relative overflow-visible mb-6"
        >
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={goToPrevMonth}
              aria-label="Previous Hijri month"
              className="w-9 h-9 inline-flex items-center justify-center rounded-full transition"
              style={{
                background:
                  'linear-gradient(135deg, var(--gold-mid) 0%, var(--gold-light) 100%)',
                color: 'var(--emerald-deep, #064e3b)',
                border: '1px solid var(--gold-deep, #9a6b0e)',
              }}
            >
              <ChevronLeft size={18} />
            </button>
            <div className="text-center">
              <h2
                className="text-2xl font-bold"
                style={{
                  color: 'var(--manuscript-cream, #fbf3df)',
                  fontFamily: 'Georgia, "Times New Roman", serif',
                }}
              >
                {HIJRI_MONTHS_EN[month - 1]}
              </h2>
              <p
                className="text-xs uppercase font-bold mt-0.5"
                style={{
                  color: 'var(--gold-mid, #d4a017)',
                  letterSpacing: '0.18em',
                }}
              >
                {year} AH · {monthLength} days
              </p>
            </div>
            <button
              onClick={goToNextMonth}
              aria-label="Next Hijri month"
              className="w-9 h-9 inline-flex items-center justify-center rounded-full transition"
              style={{
                background:
                  'linear-gradient(135deg, var(--gold-mid) 0%, var(--gold-light) 100%)',
                color: 'var(--emerald-deep, #064e3b)',
                border: '1px solid var(--gold-deep, #9a6b0e)',
              }}
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="mb-4">
            <GoldDivider />
          </div>

          <div className="grid grid-cols-7 gap-2 mb-3">
            {WEEKDAY_LABELS_EN.map((d) => (
              <div
                key={d}
                className="text-center font-bold p-2 text-[10px] uppercase"
                style={{
                  color: 'var(--gold-mid, #d4a017)',
                  letterSpacing: '0.18em',
                }}
              >
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: firstWeekday }).map((_, i) => (
              <div key={`b${i}`} className="p-2" />
            ))}
            {Array.from({ length: monthLength }).map((_, idx) => {
              const day = idx + 1
              const gregDate = calibratedGregorianDate(
                day,
                todayQuery.data?.hijriDay,
                todayQuery.data?.gregorianDate,
                year,
                month
              )
              // Prefer the entry stored under this Hijri coordinate —
              // the server-calibrated Gregorian date should match the
              // server's Hijri conversion, so both lookups should agree.
              const hijriKey = `${year}|${month}|${day}`
              const entry =
                entryByHijri.get(hijriKey) ?? entryByDate.get(gregDate)
              const isOpen =
                openEditor?.gregDate === gregDate && openEditor?.hijriDay === day
              const todayMatched =
                isCurrentMonth && day === (todayQuery.data?.hijriDay ?? -1)
              // Notable fasting occasions on this Hijri date
              const dayOccasions = occasionsByDay.get(day) ?? []
              const visibleOccasions = dayOccasions.slice(0, 2)
              const moreCount = dayOccasions.length - visibleOccasions.length
              const isMoreOpen =
                morePopover?.gregDate === gregDate && morePopover?.hijriDay === day
              return (
                <div key={day} className="relative">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation()
                      setOpenEditor(isOpen ? null : { gregDate, hijriDay: day })
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        e.stopPropagation()
                        setOpenEditor(isOpen ? null : { gregDate, hijriDay: day })
                      }
                    }}
                    className="w-full rounded-xl p-2 min-h-[88px] flex flex-col gap-1 text-left transition hover:translate-y-[-1px] hover:shadow-md cursor-pointer"
                    style={
                      todayMatched
                        ? {
                            background:
                              'linear-gradient(135deg, var(--gold-mid) 0%, var(--gold-light) 100%)',
                            border: '1px solid var(--gold-deep, #9a6b0e)',
                            boxShadow:
                              '0 0 0 2px rgba(212, 160, 23, 0.35), 0 4px 16px -2px rgba(154, 107, 14, 0.45)',
                          }
                        : {
                            background:
                              'linear-gradient(180deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0.01) 100%)',
                            border: `1px solid ${isOpen ? 'var(--gold-deep, #9a6b0e)' : 'var(--gold-mid, #d4a017)'}`,
                            boxShadow: isOpen
                              ? '0 0 0 2px rgba(212, 160, 23, 0.25)'
                              : undefined,
                          }
                    }
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className="text-sm font-bold tabular-nums"
                        style={{
                          color: todayMatched
                            ? 'var(--emerald-deep, #064e3b)'
                            : 'var(--manuscript-cream, #fbf3df)',
                          fontFamily: 'Georgia, "Times New Roman", serif',
                        }}
                      >
                        {day}
                      </span>
                      <div className="flex items-center gap-1">
                        {todayMatched && (
                          <span
                            className="text-[8px] uppercase font-bold px-1.5 py-0.5 rounded-full"
                            style={{
                              background: 'var(--emerald-deep, #064e3b)',
                              color: 'var(--gold-light, #f0c75e)',
                              letterSpacing: '0.18em',
                            }}
                          >
                            Today
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Stacked occasion pills (Calendar-style: full title, color-coded) */}
                    {visibleOccasions.length > 0 && (
                      <div className="flex flex-col gap-1 mt-auto">
                        {visibleOccasions.map((occ) => {
                          const r = RULING_META[occ.ruling]
                          return (
                            <button
                              key={occ.id}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedKnowledgeTopic(occ)
                              }}
                              className="text-left text-[10px] px-2 py-1 rounded-md font-bold uppercase truncate transition hover:translate-x-0.5"
                              style={{
                                background: `${r.color}33`,
                                color: todayMatched
                                  ? 'var(--emerald-deep, #064e3b)'
                                  : 'var(--manuscript-cream, #fbf3df)',
                                border: `1px solid ${r.color}`,
                                letterSpacing: '0.10em',
                              }}
                              title={occ.title}
                            >
                              {occ.title}
                            </button>
                          )
                        })}
                        {moreCount > 0 && (
                          <button
                            type="button"
                            ref={(el) => {
                              if (isMoreOpen) moreTriggerRef.current = el
                            }}
                            onClick={(e) => {
                              e.stopPropagation()
                              moreTriggerRef.current = e.currentTarget
                              setMorePopover(
                                isMoreOpen
                                  ? null
                                  : { gregDate, hijriDay: day }
                              )
                            }}
                            className="text-[10px] font-bold text-left cursor-pointer transition hover:translate-x-0.5"
                            style={{
                              color: todayMatched
                                ? 'var(--emerald-deep, #064e3b)'
                                : 'var(--gold-mid, #d4a017)',
                              background: 'transparent',
                              border: 'none',
                              padding: 0,
                            }}
                            title={`${moreCount} more occasion${moreCount > 1 ? 's' : ''} — click to expand`}
                          >
                            +{moreCount} more
                          </button>
                        )}
                      </div>
                    )}
                    <DayPills
                      entry={entry}
                      isToday={todayMatched}
                      onPillClick={() =>
                        setOpenEditor({ gregDate, hijriDay: day })
                      }
                    />
                  </div>
                  {isOpen && (
                    <DayEditor
                      entry={openEditorEntry}
                      gregDate={openEditor!.gregDate}
                      hijriDay={openEditor!.hijriDay}
                      hijriMonthName={openEditorHijriMonthName}
                      isRamadan={openEditorIsRamadan}
                      isMonThu={openEditorIsMonThu}
                      isWhiteDay={openEditorIsWhiteDay}
                      onClose={() => setOpenEditor(null)}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </OrnateCard>
      )}

      {/* ===== Knowledge view ===== */}
      {viewMode === 'knowledge' && (
        <OrnateCard
          variant="dark"
          topBar
          corners="all"
          className="!p-6 mb-6"
        >
          <div className="flex items-center gap-2 mb-3">
            <BookOpen size={16} style={{ color: 'var(--gold-mid, #d4a017)' }} />
            <h2
              className="text-lg font-bold uppercase"
              style={{
                color: 'var(--manuscript-cream, #fbf3df)',
                fontFamily: 'Georgia, "Times New Roman", serif',
                letterSpacing: '0.14em',
              }}
            >
              Islamic Fasting Knowledge Base
            </h2>
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{
                background: 'rgba(212, 160, 23, 0.18)',
                color: 'var(--gold-light, #f0c75e)',
                border: '1px solid var(--gold-deep, #9a6b0e)',
                letterSpacing: '0.18em',
              }}
            >
              {ALL_TOPICS.length} topics
            </span>
          </div>
          <GoldDivider />
          <div className="mt-4">
            <KnowledgeView
              activeCategory={knowledgeCategory}
              onCategoryChange={setKnowledgeCategory}
              onTopicClick={setSelectedKnowledgeTopic}
            />
          </div>
        </OrnateCard>
      )}

      {/* ===== Knowledge detail modal ===== */}
      {selectedKnowledgeTopic && (
        <KnowledgeDetailModal
          topic={selectedKnowledgeTopic}
          onClose={() => setSelectedKnowledgeTopic(null)}
        />
      )}

      {/* ===== "+N more" popover (fixed-position portal) ===== */}
      {morePopover && (() => {
        const all = occasionsByDay.get(morePopover.hijriDay) ?? []
        const hidden = all.slice(2)
        return (
          <MorePopover
            triggerRef={moreTriggerRef as React.RefObject<HTMLElement>}
            occasions={hidden}
            onPick={(occ) => {
              setSelectedKnowledgeTopic(occ)
              setMorePopover(null)
            }}
            onClose={() => setMorePopover(null)}
          />
        )
      })()}
    </div>
  )
}

export default Fasting
