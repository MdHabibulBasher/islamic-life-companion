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
import React, { useEffect, useMemo, useState } from 'react'
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
  Compass,
  CalendarDays,
  Grid3x3,
  Moon,
  Filter,
  Info,
  Clock,
  Plus,
  ListChecks,
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
import LocationPicker from '../components/LocationPicker'

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
type FastingCategory = keyof typeof FASTING_CATEGORIES

function firstDayOfHijriMonth(hijriYear: number, hijriMonth: number): number {
  const REF_HIJRI_YEAR = 1446
  const REF_WEEKDAY = 0 // Sunday
  const yearDelta = hijriYear - REF_HIJRI_YEAR
  const monthDelta = hijriMonth - 1
  const totalDays = yearDelta * 354.37 + monthDelta * 29.5
  return ((REF_WEEKDAY + Math.round(totalDays)) % 7 + 7) % 7
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
            {hijriDay} {hijriMonthName ?? ''} · {dayType}
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
            <div
              className="text-[10px] uppercase font-bold"
              style={{
                color: fasted
                  ? 'var(--emerald-deep, #064e3b)'
                  : 'var(--gold-mid, #d4a017)',
                letterSpacing: '0.14em',
              }}
            >
              {dayType}
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
// Events list view — mirrors the Calendar page's ListView exactly
// ============================================================================
interface EventsViewProps {
  entries: FastingEntry[]
  activeCategory: FastingCategory | null
  onCategoryChange: (cat: FastingCategory | null) => void
  onEntryClick: (entry: FastingEntry) => void
}

const EventsView: React.FC<EventsViewProps> = ({
  entries,
  activeCategory,
  onCategoryChange,
  onEntryClick,
}) => {
  // Categorise each entry: an entry can have multiple categories; we use the
  // "first matching" rule so an entry appears in exactly one filter chip.
  const categoryForEntry = (e: FastingEntry): FastingCategory[] => {
    const cats: FastingCategory[] = []
    if (e.fasted) cats.push('fasted')
    if (e.is_ramadan) cats.push('ramadan')
    if (e.is_monday_thursday || e.is_white_day) cats.push('sunnah')
    if ((e.donation_amount ?? 0) > 0) cats.push('donation')
    if (e.good_deed_done) cats.push('good_deed')
    return cats
  }

  const counts = useMemo(() => {
    const c: Record<FastingCategory, number> = {
      fasted: 0,
      ramadan: 0,
      sunnah: 0,
      donation: 0,
      good_deed: 0,
    }
    for (const e of entries) {
      for (const cat of categoryForEntry(e)) c[cat]++
    }
    return c
  }, [entries])

  const filtered = useMemo(() => {
    if (!activeCategory) return entries
    return entries.filter((e) => categoryForEntry(e).includes(activeCategory))
  }, [entries, activeCategory])

  // Group filtered entries by Hijri month for display.
  const grouped = useMemo(() => {
    const map = new Map<number, FastingEntry[]>()
    for (const e of filtered) {
      // Skip rows that don't have a usable Hijri month.
      if (e.hijri_month == null) continue
      const m = e.hijri_month
      if (!map.has(m)) map.set(m, [])
      map.get(m)!.push(e)
    }
    for (const [, list] of map) {
      list.sort((a, b) => (a.hijri_day ?? 0) - (b.hijri_day ?? 0))
    }
    return map
  }, [filtered])

  return (
    <div
      className="rounded-xl !p-6"
      style={{
        background:
          'linear-gradient(180deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0.01) 100%)',
        border: '1px solid var(--gold-mid, #d4a017)',
      }}
    >
      {/* Filter chips */}
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
          All ({entries.length})
        </button>
        {(Object.keys(FASTING_CATEGORIES) as FastingCategory[]).map((cat) => {
          const meta = FASTING_CATEGORIES[cat]
          const count = counts[cat]
          const active = activeCategory === cat
          return (
            <button
              key={cat}
              onClick={() => onCategoryChange(active ? null : cat)}
              className="px-2.5 py-1 rounded-full text-[10px] uppercase font-bold transition inline-flex items-center gap-1.5"
              style={
                active
                  ? {
                      background: meta.color,
                      color: '#ffffff',
                      border: `1px solid ${meta.color}`,
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
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: meta.color }}
              />
              {meta.label} ({count})
            </button>
          )
        })}
      </div>

      <div className="mb-4">
        <GoldDivider />
      </div>

      {filtered.length === 0 ? (
        <p
          className="text-sm uppercase font-bold text-center py-12"
          style={{
            color: 'var(--gold-mid, #d4a017)',
            letterSpacing: '0.18em',
          }}
        >
          No fasting events recorded yet.
        </p>
      ) : (
        <div className="space-y-6">
          {Array.from(grouped.entries()).map(([monthNum, monthEntries]) => (
            <div key={monthNum}>
              <h3
                className="text-sm font-bold uppercase mb-3 flex items-center gap-2"
                style={{
                  color: 'var(--manuscript-cream, #fbf3df)',
                  fontFamily: 'Georgia, "Times New Roman", serif',
                  letterSpacing: '0.14em',
                }}
              >
                {HIJRI_MONTHS_EN[monthNum - 1]}
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{
                    background: 'rgba(212, 160, 23, 0.18)',
                    color: 'var(--gold-light, #f0c75e)',
                    border: '1px solid var(--gold-deep, #9a6b0e)',
                    letterSpacing: '0.18em',
                  }}
                >
                  {monthEntries.length}
                </span>
              </h3>
              <div className="space-y-2">
                {monthEntries.map((e) => {
                  const cats = categoryForEntry(e)
                  const primary = cats[0] ?? 'fasted'
                  const meta = FASTING_CATEGORIES[primary]
                  const dateLabel = new Date(
                    e.date + 'T00:00:00'
                  ).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                  // Build a summary line: "Fasted · Sadaqah 100 TK · Good deed"
                  const parts: string[] = []
                  if (e.fasted) parts.push('Fasted')
                  if (e.is_ramadan) parts.push('Ramadan')
                  if (e.is_monday_thursday) parts.push('Sunnah (Mon/Thu)')
                  if (e.is_white_day) parts.push('White day')
                  if ((e.donation_amount ?? 0) > 0) {
                    parts.push(
                      `Sadaqah ${e.donation_amount} ${e.donation_currency ?? 'TK'}`
                    )
                  }
                  if (e.good_deed_done && e.good_deed) parts.push(e.good_deed)
                  const summary = parts.join(' · ')
                  return (
                    <button
                      key={e.id}
                      onClick={() => onEntryClick(e)}
                      className="w-full text-left rounded-xl p-4 flex items-center gap-4 transition hover:translate-x-0.5"
                      style={{
                        background:
                          'linear-gradient(180deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.02) 100%)',
                        border: '1px solid var(--gold-mid, #d4a017)',
                        borderLeftWidth: 4,
                        borderLeftColor: meta.color,
                      }}
                    >
                      <div
                        className="w-10 h-10 rounded-full inline-flex items-center justify-center shrink-0 font-bold"
                        style={{
                          background: 'rgba(0, 0, 0, 0.30)',
                          color: 'var(--manuscript-cream, #fbf3df)',
                          border: '1px solid var(--gold-mid, #d4a017)',
                          fontFamily: 'Georgia, "Times New Roman", serif',
                        }}
                      >
                        {e.hijri_day}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          {cats.map((cat) => (
                            <span
                              key={cat}
                              className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full"
                              style={{
                                background: `${FASTING_CATEGORIES[cat].color}33`,
                                color: FASTING_CATEGORIES[cat].color,
                                border: `1px solid ${FASTING_CATEGORIES[cat].color}`,
                                letterSpacing: '0.18em',
                              }}
                            >
                              {FASTING_CATEGORIES[cat].label}
                            </span>
                          ))}
                          <span
                            className="text-[10px] font-bold"
                            style={{ color: 'var(--gold-mid, #d4a017)' }}
                          >
                            {e.hijri_day} {HIJRI_MONTHS_EN[monthNum - 1]}{' '}
                            {e.hijri_year} AH
                          </span>
                        </div>
                        <p
                          className="font-bold text-base"
                          style={{
                            color: 'var(--manuscript-cream, #fbf3df)',
                            fontFamily: 'Georgia, "Times New Roman", serif',
                          }}
                        >
                          {summary || 'Fasting entry'}
                        </p>
                        <p
                          className="text-xs mt-0.5"
                          style={{ color: 'var(--gold-mid, #d4a017)' }}
                        >
                          {dateLabel}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Main page
// ============================================================================
type ViewMode = 'month' | 'year' | 'list'

export const Fasting: React.FC = () => {
  const queryClient = useQueryClient()
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

  // Events list filter.
  const [eventsCategory, setEventsCategory] = useState<FastingCategory | null>(
    null
  )

  // Year filter for events list (defaults to current year).
  const [eventsYear, setEventsYear] = useState<number | null>(null)

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
  useEffect(() => {
    if (eventsYear == null && todayQuery.data?.hijriYear) {
      setEventsYear(todayQuery.data.hijriYear)
    }
  }, [todayQuery.data, eventsYear])

  const year = activeYear ?? todayQuery.data?.hijriYear ?? 1447
  const month = activeMonth ?? todayQuery.data?.hijriMonthNumber ?? 1
  const evYear = eventsYear ?? todayQuery.data?.hijriYear ?? 1447

  // ----- Data -----
  const entriesQuery = useQuery<FastingEntry[]>({
    queryKey: ['fasting', 'month', year, month],
    queryFn: () => fastingService.listByHijriMonth(year, month),
  })
  const summaryQuery = useQuery<FastingMonthSummary>({
    queryKey: ['fasting', 'summary', year, month],
    queryFn: () => fastingService.monthSummary(year, month),
  })
  // All events across the whole year, for the Events list view.
  const allEventsQuery = useQuery<FastingEntry[]>({
    queryKey: ['fasting', 'year', evYear],
    queryFn: async () => {
      // Pull each month in parallel.
      const promises = Array.from({ length: 12 }, (_, i) =>
        fastingService.listByHijriMonth(evYear, i + 1).catch(() => [])
      )
      const results = await Promise.all(promises)
      return results.flat()
    },
    enabled: viewMode === 'list',
  })
  const entries = entriesQuery.data ?? []
  const allEvents = allEventsQuery.data ?? []

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
  const firstWeekday = firstDayOfHijriMonth(year, month)
  const isCurrentMonth =
    todayQuery.data != null &&
    todayQuery.data.hijriYear === year &&
    todayQuery.data.hijriMonthNumber === month

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
  const goToToday = () => {
    if (todayQuery.data) {
      setActiveYear(todayQuery.data.hijriYear)
      setActiveMonth(todayQuery.data.hijriMonthNumber)
      setOnThisDayMonth(todayQuery.data.hijriMonthNumber)
      setOnThisDayDay(todayQuery.data.hijriDay)
      setViewMode('month')
      setOpenEditor(null)
    }
  }

  if (entriesQuery.isError) showError('Failed to load fasting entries')
  if (summaryQuery.isError) showError('Failed to load month summary')
  if (allEventsQuery.isError) showError('Failed to load events')

  // ----- "On This Day" preview -----
  const onThisDayEntry = useMemo(() => {
    if (onThisDayMonth == null || onThisDayDay == null) return null
    // Prefer the Hijri-keyed lookup; fall back to the approximate
    // Gregorian date for legacy rows.
    const hijriKey = `${year}|${onThisDayMonth}|${onThisDayDay}`
    const byHijri = entryByHijri.get(hijriKey)
    if (byHijri) return byHijri
    const targetGreg = approximateGregorianDate(
      year,
      onThisDayMonth,
      onThisDayDay
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
      className="max-w-[1400px] mx-auto px-4 py-8 md:pt-0"
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

          <div className="flex items-center gap-5 shrink-0">
            <div
              className="flex flex-col items-center justify-center rounded-full shrink-0"
              style={{
                width: 110,
                height: 110,
                background:
                  'radial-gradient(circle, rgba(240,199,94,0.18) 0%, transparent 70%)',
                border: '1px solid var(--gold-mid)',
              }}
            >
              <span
                className="text-2xl font-bold tabular-nums leading-none"
                style={{
                  color: 'var(--manuscript-cream)',
                  fontFamily: 'Georgia, "Times New Roman", serif',
                }}
              >
                {monthFastedLabel}
              </span>
              <span
                className="text-[10px] uppercase font-semibold mt-1"
                style={{
                  color: 'var(--gold-glow)',
                  letterSpacing: '0.18em',
                }}
              >
                fasts / month
              </span>
            </div>
            <div className="flex flex-col gap-2">
              <LocationPicker
                onLocationChange={() => {
                  // Hijri offset may have been auto-seeded — refetch today.
                  queryClient.invalidateQueries({ queryKey: ['hijri-today'] })
                  queryClient.invalidateQueries({ queryKey: ['fasting'] })
                }}
              />
              <button
                onClick={goToToday}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition border"
                style={{
                  background: 'rgba(251,243,223,0.10)',
                  color: 'var(--manuscript-cream)',
                  borderColor: 'var(--gold-mid)',
                }}
              >
                <Compass size={12} /> Jump to today
              </button>
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
            { id: 'year' as const, label: 'Year', icon: <Grid3x3 size={12} /> },
            { id: 'list' as const, label: 'Events', icon: <ListChecks size={12} /> },
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
          className="!p-6 relative overflow-hidden mb-6"
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
              const gregDate = approximateGregorianDate(year, month, day)
              // Prefer the entry stored under this Hijri coordinate —
              // approximateGregorianDate() can drift ±1 day from the
              // server-computed Gregorian date, so a Gregorian lookup
              // misses cells the user has already marked.
              const hijriKey = `${year}|${month}|${day}`
              const entry =
                entryByHijri.get(hijriKey) ?? entryByDate.get(gregDate)
              const isOpen =
                openEditor?.gregDate === gregDate && openEditor?.hijriDay === day
              const todayMatched =
                isCurrentMonth && day === (todayQuery.data?.hijriDay ?? -1)
              return (
                <div key={day} className="relative">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setOpenEditor(
                        isOpen ? null : { gregDate, hijriDay: day }
                      )
                    }}
                    className="w-full rounded-xl p-2 min-h-[88px] flex flex-col gap-1 text-left transition hover:translate-y-[-1px] hover:shadow-md"
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
                    <DayPills
                      entry={entry}
                      isToday={todayMatched}
                      onPillClick={() =>
                        setOpenEditor({ gregDate, hijriDay: day })
                      }
                    />
                  </button>
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

      {/* ===== Year view placeholder ===== */}
      {viewMode === 'year' && (
        <OrnateCard
          variant="dark"
          topBar
          corners="all"
          className="!p-6 mb-6"
        >
          <div className="flex items-center gap-2 mb-3">
            <Grid3x3 size={16} style={{ color: 'var(--gold-mid, #d4a017)' }} />
            <h2
              className="text-lg font-bold uppercase"
              style={{
                color: 'var(--manuscript-cream, #fbf3df)',
                fontFamily: 'Georgia, "Times New Roman", serif',
                letterSpacing: '0.14em',
              }}
            >
              Year view
            </h2>
          </div>
          <GoldDivider />
          <p
            className="text-sm uppercase font-bold text-center py-12"
            style={{
              color: 'var(--gold-mid, #d4a017)',
              letterSpacing: '0.18em',
            }}
          >
            Coming soon — switch to Events for the full list.
          </p>
        </OrnateCard>
      )}

      {/* ===== Events list view ===== */}
      {viewMode === 'list' && (
        <OrnateCard
          variant="dark"
          topBar
          corners="all"
          className="!p-6 mb-6 space-y-4"
        >
          {/* Year selector */}
          <div
            className="flex items-center gap-3 !p-3 rounded-xl flex-wrap"
            style={{
              background:
                'linear-gradient(180deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0.01) 100%)',
              border: '1px solid var(--gold-mid, #d4a017)',
            }}
          >
            <span
              className="text-[10px] uppercase font-bold"
              style={{ color: 'var(--gold-mid, #d4a017)', letterSpacing: '0.18em' }}
            >
              Year
            </span>
            <button
              onClick={() => setEventsYear((y) => (y ?? 1447) - 1)}
              className="w-7 h-7 inline-flex items-center justify-center rounded-full transition"
              style={{
                background:
                  'linear-gradient(135deg, var(--gold-mid) 0%, var(--gold-light) 100%)',
                color: 'var(--emerald-deep, #064e3b)',
                border: '1px solid var(--gold-deep, #9a6b0e)',
              }}
              aria-label="Previous year"
            >
              <ChevronLeft size={14} />
            </button>
            <span
              className="text-base font-bold tabular-nums"
              style={{
                color: 'var(--manuscript-cream, #fbf3df)',
                fontFamily: 'Georgia, "Times New Roman", serif',
              }}
            >
              {evYear} AH
            </span>
            <button
              onClick={() => setEventsYear((y) => (y ?? 1447) + 1)}
              className="w-7 h-7 inline-flex items-center justify-center rounded-full transition"
              style={{
                background:
                  'linear-gradient(135deg, var(--gold-mid) 0%, var(--gold-light) 100%)',
                color: 'var(--emerald-deep, #064e3b)',
                border: '1px solid var(--gold-deep, #9a6b0e)',
              }}
              aria-label="Next year"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          <EventsView
            entries={allEvents}
            activeCategory={eventsCategory}
            onCategoryChange={setEventsCategory}
            onEntryClick={(e) => {
              // Switch to month view and open the editor for that day.
              if (e.hijri_year == null || e.hijri_month == null || e.hijri_day == null) {
                return
              }
              setActiveYear(e.hijri_year)
              setActiveMonth(e.hijri_month)
              setOpenEditor({ gregDate: e.date, hijriDay: e.hijri_day })
              setViewMode('month')
            }}
          />
        </OrnateCard>
      )}
    </div>
  )
}

export default Fasting
