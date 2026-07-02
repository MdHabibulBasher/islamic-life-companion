import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Filter,
  Grid3x3,
  Plus,
  Sparkles,
  Trash2,
  X,
  Compass,
  ListChecks,
} from 'lucide-react'
import {
  CATEGORY_META,
  EventCategory,
  islamicCalendarService,
  type IslamicEvent,
  type IslamicEventCreate,
} from '../services/islamicCalendarService'
import { api } from '../services/api'
import { useToast } from '../components/Toast'
import { useAuthStore } from '../store/authStore'
import {
  GoldDivider,
  OrnateCard,
} from '../components/IslamicOrnamentBG'
import LocationPicker from '../components/LocationPicker'

/* ============================================================================
 * Islamic (Hijri) Calendar page — full catalog edition
 * ----------------------------------------------------------------------------
 * Top-level layout (top-to-bottom on a single scrollable page):
 *
 *   1. Hero strip with today's Hijri date + 3 stat tiles
 *   2. Category color legend (the spec's 4-color reference + the
 *      extended 7-color legend)
 *   3. "On This Day" section - all events for today's Hijri day, plus a
 *      small date picker so the user can browse any Hijri day and see
 *      what happened on it
 *   4. View-mode tabs: Month | Year | Events list + "Jump to today"
 *   5. Month / Year / List views
 *   6. Admin panel (only if user.role === 'ADMIN'): add / edit / delete
 *      any event with a full form including the long full_story_en field
 *   7. Event detail modal with full story + sources
 * ========================================================================= */

// Hijri month names in English.
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

// Approximate weekday for the first day of a given Hijri month.
// See explanation in the previous Calendar version.
function firstDayOfHijriMonth(hijriYear: number, hijriMonth: number): number {
  const REF_HIJRI_YEAR = 1446
  const REF_WEEKDAY = 0 // Sunday
  const yearDelta = hijriYear - REF_HIJRI_YEAR
  const monthDelta = hijriMonth - 1
  const totalDays = yearDelta * 354.37 + monthDelta * 29.5
  return ((REF_WEEKDAY + Math.round(totalDays)) % 7 + 7) % 7
}

type ViewMode = 'month' | 'year' | 'list'

interface HijriToday {
  gregorianDate: string
  hijriDate: string
  hijriDateCompact: string
  hijriDay: number
  hijriMonth: string
  hijriMonthNumber: number
  hijriYear: number
  hijriBasis: string
  hijriOffset: number
}

const todayIso = (): string => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const Calendar = () => {
  const queryClient = useQueryClient()
  const { error: showError, success: showSuccess } = useToast()
  const user = useAuthStore((s) => s.user)
  const isAdmin = (user?.role || 'USER').toUpperCase() === 'ADMIN'

  // ----- View state -----
  const [viewMode, setViewMode] = useState<ViewMode>('month')
  const [activeHijriYear, setActiveHijriYear] = useState<number | null>(null)
  const [activeHijriMonth, setActiveHijriMonth] = useState<number | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<IslamicEvent | null>(null)
  const [editingEvent, setEditingEvent] = useState<IslamicEvent | null>(null)
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<EventCategory | null>(
    null
  )

  // "On This Day" browse state — Hijri day + month to inspect.
  const [onThisDayMonth, setOnThisDayMonth] = useState<number | null>(null)
  const [onThisDayDay, setOnThisDayDay] = useState<number | null>(null)

  // ----- Data -----
  const todayQuery = useQuery<HijriToday>({
    queryKey: ['hijri-today'],
    queryFn: async () => {
      const r = await api.get('/prayer-times/islamic-date', {
        params: { target_date: todayIso() },
      })
      return {
        gregorianDate: r.data.gregorian_date,
        hijriDate: r.data.hijri_date,
        hijriDateCompact: r.data.hijri_date_compact,
        hijriDay: r.data.hijri_day,
        hijriMonth: r.data.hijri_month,
        hijriMonthNumber: r.data.hijri_month_number,
        hijriYear: r.data.hijri_year,
        hijriBasis: r.data.hijri_basis,
        hijriOffset: r.data.hijri_offset_applied,
      }
    },
  })

  const eventsQuery = useQuery<IslamicEvent[]>({
    queryKey: ['islamic-events'],
    queryFn: () => islamicCalendarService.listEvents(),
  })
  const events = eventsQuery.data ?? []

  // ----- Derived state -----
  const eventsByMonth = useMemo(() => {
    const map = new Map<number, IslamicEvent[]>()
    for (const ev of events) {
      const m = ev.hijri_month
      if (!map.has(m)) map.set(m, [])
      map.get(m)!.push(ev)
    }
    for (const [, list] of map) {
      list.sort((a, b) => a.hijri_day - b.hijri_day)
    }
    return map
  }, [events])

  const onThisDayEvents = useMemo(() => {
    if (onThisDayMonth == null || onThisDayDay == null) return []
    return events.filter(
      (e) => e.hijri_month === onThisDayMonth && e.hijri_day === onThisDayDay
    )
  }, [events, onThisDayMonth, onThisDayDay])

  const allCategories = useMemo(() => {
    const set = new Set<EventCategory>()
    for (const ev of events) set.add(ev.category)
    return Array.from(set).sort()
  }, [events])

  const filteredEvents = useMemo(() => {
    return categoryFilter
      ? events.filter((e) => e.category === categoryFilter)
      : events
  }, [events, categoryFilter])

  // ----- Effects -----
  useEffect(() => {
    if (activeHijriYear !== null) return
    if (todayQuery.data?.hijriYear) setActiveHijriYear(todayQuery.data.hijriYear)
  }, [todayQuery.data, activeHijriYear])

  useEffect(() => {
    if (activeHijriMonth !== null) return
    if (todayQuery.data?.hijriMonthNumber) {
      setActiveHijriMonth(todayQuery.data.hijriMonthNumber)
    }
  }, [todayQuery.data, activeHijriMonth])

  // Default "On This Day" to today.
  useEffect(() => {
    if (onThisDayMonth == null && todayQuery.data) {
      setOnThisDayMonth(todayQuery.data.hijriMonthNumber)
    }
    if (onThisDayDay == null && todayQuery.data) {
      setOnThisDayDay(todayQuery.data.hijriDay)
    }
  }, [todayQuery.data, onThisDayMonth, onThisDayDay])

  if (eventsQuery.isError) showError('Failed to load Islamic events')

  // ----- Handlers -----
  const year = activeHijriYear ?? todayQuery.data?.hijriYear ?? 1447
  const month = activeHijriMonth ?? todayQuery.data?.hijriMonthNumber ?? 1

  const goToPrevMonth = () => {
    if (month === 1) {
      setActiveHijriMonth(12)
      setActiveHijriYear((y) => (y ?? 1447) - 1)
    } else {
      setActiveHijriMonth(month - 1)
    }
  }
  const goToNextMonth = () => {
    if (month === 12) {
      setActiveHijriMonth(1)
      setActiveHijriYear((y) => (y ?? 1447) + 1)
    } else {
      setActiveHijriMonth(month + 1)
    }
  }
  const goToToday = () => {
    if (todayQuery.data) {
      setActiveHijriYear(todayQuery.data.hijriYear)
      setActiveHijriMonth(todayQuery.data.hijriMonthNumber)
      setViewMode('month')
    }
  }

  const isCurrentMonth =
    todayQuery.data != null &&
    todayQuery.data.hijriYear === year &&
    todayQuery.data.hijriMonthNumber === month

  const monthEvents = eventsByMonth.get(month) ?? []
  const monthLength = HIJRI_MONTH_LENGTHS[month - 1] ?? 30
  const firstWeekday = firstDayOfHijriMonth(year, month)

  // ----- Mutations (admin only) -----
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['islamic-events'] })
  }

  const createMutation = useMutation({
    mutationFn: (payload: IslamicEventCreate) =>
      islamicCalendarService.createEvent(payload),
    onSuccess: () => {
      invalidate()
      setIsAdminPanelOpen(false)
      showSuccess('Event created')
    },
    onError: (err: any) => {
      const detail =
        err?.response?.data?.detail || 'Failed to create event'
      showError(detail)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number
      payload: Partial<IslamicEventCreate>
    }) => islamicCalendarService.updateEvent(id, payload),
    onSuccess: () => {
      invalidate()
      setEditingEvent(null)
      setIsAdminPanelOpen(false)
      showSuccess('Event updated')
    },
    onError: (err: any) => {
      const detail =
        err?.response?.data?.detail || 'Failed to update event'
      showError(detail)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => islamicCalendarService.deleteEvent(id),
    onSuccess: () => {
      invalidate()
      setEditingEvent(null)
      showSuccess('Event deleted')
    },
    onError: (err: any) => {
      const detail =
        err?.response?.data?.detail || 'Failed to delete event'
      showError(detail)
    },
  })

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-8 md:pt-0">
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
              Islamic Calendar
            </h1>
            <p
              className="mt-1 text-sm max-w-md"
              style={{
                color: 'var(--manuscript-cream)',
                opacity: 0.82,
              }}
            >
              Hijri dates and Islamic history alongside your day.
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
                <CalendarDays size={12} /> {HIJRI_MONTHS_EN[(month ?? 1) - 1]}{' '}
                {year} AH
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
                {todayQuery.data?.hijriDay ?? '—'}
              </span>
              <span
                className="text-[10px] uppercase font-semibold mt-1"
                style={{
                  color: 'var(--gold-glow)',
                  letterSpacing: '0.18em',
                }}
              >
                day of month
              </span>
            </div>
            <div className="flex flex-col gap-2">
              <LocationPicker
                onLocationChange={() => {
                  // Hijri offset may have been auto-seeded — refetch today.
                  queryClient.invalidateQueries({ queryKey: ['hijri-today'] })
                  queryClient.invalidateQueries({ queryKey: ['islamic-events'] })
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
              {isAdmin && (
                <button
                  onClick={() => {
                    setEditingEvent(null)
                    setIsAdminPanelOpen(true)
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition border"
                  style={{
                    background:
                      'linear-gradient(135deg, var(--gold-mid) 0%, var(--gold-light) 100%)',
                    color: 'var(--emerald-deep)',
                    border: '1px solid var(--gold-deep)',
                    letterSpacing: '0.16em',
                  }}
                >
                  <Plus size={12} /> Admin · Add Event
                </button>
              )}
            </div>
          </div>
        </div>
      </OrnateCard>

      {eventsQuery.isError && (
        <OrnateCard
          variant="dark"
          topBar={false}
          corners="all"
          className="!p-4 mb-6 flex items-center gap-3"
        >
          <AlertCircle size={18} style={{ color: 'var(--gold-mid, #d4a017)' }} />
          <span
            className="text-sm"
            style={{
              color: 'var(--manuscript-cream, #fbf3df)',
              fontFamily: 'Georgia, "Times New Roman", serif',
            }}
          >
            We couldn&rsquo;t load Islamic events. Refresh the page to try again.
          </span>
        </OrnateCard>
      )}

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
            {
              id: 'month' as const,
              label: 'Month',
              icon: <CalendarDays size={12} />,
            },
            {
              id: 'year' as const,
              label: 'Year',
              icon: <Grid3x3 size={12} />,
            },
            {
              id: 'list' as const,
              label: 'Events',
              icon: <ListChecks size={12} />,
            },
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

      {/* ===== "On This Day" quick-jump section ===== */}
      <OrnateCard
        variant="dark"
        topBar
        corners="all"
        className="!p-5 mb-6"
      >
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <span
            className="w-8 h-8 inline-flex items-center justify-center rounded-full shrink-0"
            style={{
              background:
                'linear-gradient(135deg, var(--gold-mid) 0%, var(--gold-light) 100%)',
              color: 'var(--emerald-deep, #064e3b)',
              border: '1px solid var(--gold-deep, #9a6b0e)',
            }}
          >
            <Sparkles size={16} />
          </span>
          <h2
            className="text-lg font-bold uppercase"
            style={{
              color: 'var(--manuscript-cream, #fbf3df)',
              fontFamily: 'Georgia, "Times New Roman", serif',
              letterSpacing: '0.14em',
            }}
          >
            On This Day
          </h2>
          <div className="ml-auto flex items-center gap-2 flex-wrap">
            <select
              value={onThisDayMonth ?? 1}
              onChange={(e) => setOnThisDayMonth(Number(e.target.value))}
              className="px-2 py-1 rounded-lg text-xs focus:outline-none"
              style={{
                background: 'rgba(0, 0, 0, 0.30)',
                border: '1px solid var(--gold-mid, #d4a017)',
                color: 'var(--manuscript-cream, #fbf3df)',
                fontFamily: 'Georgia, "Times New Roman", serif',
              }}
            >
              {HIJRI_MONTHS_EN.map((m, idx) => (
                <option key={idx} value={idx + 1}>
                  {m}
                </option>
              ))}
            </select>
            <select
              value={onThisDayDay ?? 1}
              onChange={(e) => setOnThisDayDay(Number(e.target.value))}
              className="px-2 py-1 rounded-lg text-xs focus:outline-none"
              style={{
                background: 'rgba(0, 0, 0, 0.30)',
                border: '1px solid var(--gold-mid, #d4a017)',
                color: 'var(--manuscript-cream, #fbf3df)',
                fontFamily: 'Georgia, "Times New Roman", serif',
              }}
            >
              {Array.from({
                length: HIJRI_MONTH_LENGTHS[(onThisDayMonth ?? 1) - 1],
              }).map((_, idx) => (
                <option key={idx} value={idx + 1}>
                  {idx + 1}
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                if (todayQuery.data) {
                  setOnThisDayMonth(todayQuery.data.hijriMonthNumber)
                  setOnThisDayDay(todayQuery.data.hijriDay)
                }
              }}
              className="px-2 py-1 rounded-lg text-[10px] uppercase font-bold"
              style={{
                background: 'rgba(0, 0, 0, 0.30)',
                color: 'var(--gold-mid, #d4a017)',
                border: '1px solid var(--gold-mid, #d4a017)',
                letterSpacing: '0.18em',
              }}
            >
              Today
            </button>
          </div>
        </div>

        {onThisDayEvents.length === 0 ? (
          <p
            className="text-sm uppercase font-bold text-center py-6"
            style={{ color: 'var(--gold-mid, #d4a017)', letterSpacing: '0.18em' }}
          >
            No events recorded for{' '}
            {onThisDayDay ?? '—'} {HIJRI_MONTHS_EN[(onThisDayMonth ?? 1) - 1]}.
          </p>
        ) : (
          <div className="space-y-3">
            {onThisDayEvents.map((ev) => (
              <OnThisDayCard
                key={ev.id}
                event={ev}
                onClick={() => setSelectedEvent(ev)}
                isAdmin={isAdmin}
                onEdit={() => {
                  setEditingEvent(ev)
                  setIsAdminPanelOpen(true)
                }}
              />
            ))}
          </div>
        )}
      </OrnateCard>

      {/* ===== View bodies ===== */}
      {viewMode === 'month' && (
        <OrnateCard
          variant="dark"
          topBar
          corners="all"
          className="!p-6 mb-6"
        >
          <MonthView
            year={year}
            month={month}
            monthLength={monthLength}
            firstWeekday={firstWeekday}
            monthEvents={monthEvents}
            isCurrentMonth={isCurrentMonth}
            todayHijriDay={todayQuery.data?.hijriDay ?? null}
            onPrev={goToPrevMonth}
            onNext={goToNextMonth}
            onEventClick={setSelectedEvent}
          />
        </OrnateCard>
      )}

      {viewMode === 'year' && (
        <OrnateCard
          variant="dark"
          topBar
          corners="all"
          className="!p-6 mb-6"
        >
          <YearView
            year={year}
            eventsByMonth={eventsByMonth}
            currentMonth={todayQuery.data?.hijriMonthNumber ?? month}
            onSelectMonth={(m) => {
              setActiveHijriMonth(m)
              setViewMode('month')
            }}
          />
        </OrnateCard>
      )}

      {viewMode === 'list' && (
        <OrnateCard
          variant="dark"
          topBar
          corners="all"
          className="!p-6 mb-6"
        >
          <ListView
            events={filteredEvents}
            categories={allCategories}
            activeCategory={categoryFilter}
            onCategoryChange={(c) => setCategoryFilter(c as EventCategory | null)}
            onEventClick={setSelectedEvent}
            isAdmin={isAdmin}
            onEditEvent={(ev) => {
              setEditingEvent(ev)
              setIsAdminPanelOpen(true)
            }}
          />
        </OrnateCard>
      )}

      {/* ===== Event detail modal ===== */}
      {selectedEvent && (
        <EventDetailModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      )}

      {/* ===== Admin panel (modal form) ===== */}
      {isAdmin && isAdminPanelOpen && (
        <AdminEventModal
          editingEvent={editingEvent}
          onClose={() => {
            setIsAdminPanelOpen(false)
            setEditingEvent(null)
          }}
          onSubmit={(payload) => {
            if (editingEvent) {
              updateMutation.mutate({ id: editingEvent.id, payload })
            } else {
              createMutation.mutate(payload as IslamicEventCreate)
            }
          }}
          onDelete={
            editingEvent
              ? () => {
                  if (
                    window.confirm(
                      `Delete "${editingEvent.title_en}"? This cannot be undone.`
                    )
                  ) {
                    deleteMutation.mutate(editingEvent.id)
                  }
                }
              : undefined
          }
          isSubmitting={
            createMutation.isPending || updateMutation.isPending
          }
        />
      )}
    </div>
  )
}

/* ============================================================================
 * OnThisDayCard — expanded card with category badge + admin edit
 * ========================================================================= */
const OnThisDayCard: React.FC<{
  event: IslamicEvent
  onClick: () => void
  isAdmin?: boolean
  onEdit?: () => void
}> = ({ event, onClick, isAdmin, onEdit }) => {
  const meta = CATEGORY_META[event.category]
  return (
    <div
      className="rounded-xl p-4 flex items-start gap-4"
      style={{
        background:
          'linear-gradient(180deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.02) 100%)',
        border: '1px solid var(--gold-mid, #d4a017)',
        borderLeftWidth: 4,
        borderLeftColor: meta.color,
      }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span
            className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full"
            style={{
              background: `${meta.color}33`,
              color: meta.color,
              border: `1px solid ${meta.color}`,
              letterSpacing: '0.18em',
            }}
          >
            {meta.label}
          </span>
          <span
            className="text-[10px] font-bold"
            style={{ color: 'var(--gold-mid, #d4a017)' }}
          >
            {event.hijri_day} {HIJRI_MONTHS_EN[event.hijri_month - 1]}
          </span>
        </div>
        <button
          onClick={onClick}
          className="text-left w-full"
        >
          <p
            className="font-bold text-base"
            style={{
              color: 'var(--manuscript-cream, #fbf3df)',
              fontFamily: 'Georgia, "Times New Roman", serif',
            }}
          >
            {event.title_en}
          </p>
          {event.title_bn && (
            <p
              className="text-xs mt-0.5"
              style={{ color: 'var(--gold-mid, #d4a017)' }}
            >
              {event.title_bn}
            </p>
          )}
          {event.description_en && (
            <p
              className="text-xs mt-2 leading-relaxed"
              style={{ color: 'var(--manuscript-cream, #fbf3df)', opacity: 0.85 }}
            >
              {event.description_en.length > 240
                ? event.description_en.slice(0, 240) + '…'
                : event.description_en}
            </p>
          )}
        </button>
      </div>
      {isAdmin && onEdit && (
        <button
          onClick={onEdit}
          aria-label="Edit event"
          className="p-1.5 rounded-lg transition shrink-0"
          style={{
            background: 'transparent',
            color: 'var(--gold-mid, #d4a017)',
            border: '1px solid var(--gold-mid, #d4a017)',
          }}
          title="Edit (admin)"
        >
          <Edit3 size={14} />
        </button>
      )}
    </div>
  )
}

/* ============================================================================
 * MonthView — 7-column grid of Hijri days with event pills
 * ========================================================================= */
const MonthView: React.FC<{
  year: number
  month: number
  monthLength: number
  firstWeekday: number
  monthEvents: IslamicEvent[]
  isCurrentMonth: boolean
  todayHijriDay: number | null
  onPrev: () => void
  onNext: () => void
  onEventClick: (ev: IslamicEvent) => void
  isAdmin?: boolean
  onEditEvent?: (ev: IslamicEvent) => void
}> = ({
  year,
  month,
  monthLength,
  firstWeekday,
  monthEvents,
  isCurrentMonth,
  todayHijriDay,
  onPrev,
  onNext,
  onEventClick,
}) => {
  const cells: React.ReactNode[] = []
  for (let i = 0; i < firstWeekday; i++) {
    cells.push(<div key={`empty-${i}`} className="p-2" />)
  }
  for (let day = 1; day <= monthLength; day++) {
    const isToday = isCurrentMonth && day === todayHijriDay
    const dayEvents = monthEvents.filter((e) => e.hijri_day === day)
    cells.push(
      <div
        key={day}
        className="rounded-xl p-2 min-h-[88px] flex flex-col gap-1"
        style={
          isToday
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
                border: '1px solid var(--gold-mid, #d4a017)',
              }
        }
      >
        <div className="flex items-center justify-between">
          <span
            className="text-sm font-bold tabular-nums"
            style={{
              color: isToday
                ? 'var(--emerald-deep, #064e3b)'
                : 'var(--manuscript-cream, #fbf3df)',
              fontFamily: 'Georgia, "Times New Roman", serif',
            }}
          >
            {day}
          </span>
          {isToday && (
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
        <div className="flex flex-col gap-1 mt-auto">
          {dayEvents.slice(0, 2).map((ev) => (
            <button
              key={ev.id}
              onClick={() => onEventClick(ev)}
              className="text-left text-[10px] px-2 py-1 rounded-md font-bold uppercase truncate transition hover:translate-x-0.5"
              style={{
                background: `${ev.color_code}33`,
                color: isToday
                  ? 'var(--emerald-deep, #064e3b)'
                  : 'var(--manuscript-cream, #fbf3df)',
                border: `1px solid ${ev.color_code}`,
                letterSpacing: '0.10em',
              }}
              title={ev.title_en}
            >
              {ev.title_en}
            </button>
          ))}
          {dayEvents.length > 2 && (
            <span
              className="text-[10px] font-bold"
              style={{
                color: isToday
                  ? 'var(--emerald-deep, #064e3b)'
                  : 'var(--gold-mid, #d4a017)',
              }}
            >
              +{dayEvents.length - 2} more
            </span>
          )}
        </div>
      </div>,
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onPrev}
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
            style={{ color: 'var(--gold-mid, #d4a017)', letterSpacing: '0.18em' }}
          >
            {year} AH · {monthLength} days
          </p>
        </div>
        <button
          onClick={onNext}
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

      <div className="mb-3">
        <GoldDivider />
      </div>

      <div className="grid grid-cols-7 gap-2 mb-3">
        {WEEKDAY_LABELS_EN.map((d) => (
          <div
            key={d}
            className="text-center font-bold p-2 text-[10px] uppercase"
            style={{ color: 'var(--gold-mid, #d4a017)', letterSpacing: '0.18em' }}
          >
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2">{cells}</div>
    </div>
  )
}

/* ============================================================================
 * YearView — 12 mini-cards, one per Hijri month, click to drill in
 * ========================================================================= */
const YearView: React.FC<{
  year: number
  eventsByMonth: Map<number, IslamicEvent[]>
  currentMonth: number
  onSelectMonth: (month: number) => void
}> = ({ year, eventsByMonth, currentMonth, onSelectMonth }) => {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2
          className="text-2xl font-bold"
          style={{
            color: 'var(--manuscript-cream, #fbf3df)',
            fontFamily: 'Georgia, "Times New Roman", serif',
          }}
        >
          {year} AH
        </h2>
        <p
          className="text-[10px] uppercase font-bold"
          style={{ color: 'var(--gold-mid, #d4a017)', letterSpacing: '0.18em' }}
        >
          Click a month to drill in
        </p>
      </div>

      <div className="mb-4">
        <GoldDivider />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {HIJRI_MONTHS_EN.map((mName, idx) => {
          const monthNum = idx + 1
          const monthEvents = eventsByMonth.get(monthNum) ?? []
          const monthLength = HIJRI_MONTH_LENGTHS[idx]
          const isCurrent = monthNum === currentMonth
          return (
            <button
              key={monthNum}
              onClick={() => onSelectMonth(monthNum)}
              className="rounded-xl p-3 text-left transition hover:translate-y-[-2px]"
              style={{
                background: isCurrent
                  ? 'linear-gradient(180deg, rgba(212, 160, 23, 0.18) 0%, rgba(212, 160, 23, 0.05) 100%)'
                  : 'linear-gradient(180deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0.01) 100%)',
                border: isCurrent
                  ? '1px solid var(--gold-light, #f0c75e)'
                  : '1px solid var(--gold-mid, #d4a017)',
                boxShadow: isCurrent
                  ? '0 4px 12px -2px rgba(212, 160, 23, 0.35)'
                  : '0 1px 2px rgba(0, 0, 0, 0.10)',
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className="font-bold text-sm"
                  style={{
                    color: 'var(--manuscript-cream, #fbf3df)',
                    fontFamily: 'Georgia, "Times New Roman", serif',
                  }}
                >
                  {mName}
                </span>
                <span
                  className="text-[10px] font-bold tabular-nums"
                  style={{ color: 'var(--gold-mid, #d4a017)' }}
                >
                  {monthLength}d
                </span>
              </div>
              <p
                className="text-[10px] uppercase font-bold mb-2"
                style={{ color: 'var(--gold-mid, #d4a017)', letterSpacing: '0.18em' }}
              >
                {monthEvents.length} {monthEvents.length === 1 ? 'event' : 'events'}
              </p>
              <div className="grid grid-cols-5 gap-0.5">
                {Array.from({ length: 5 }).map((_, row) =>
                  Array.from({ length: 7 }).map((_, col) => {
                    const dayNum = row * 7 + col + 1
                    const hasEvent =
                      dayNum <= monthLength &&
                      monthEvents.some((e) => e.hijri_day === dayNum)
                    return (
                      <div
                        key={`${row}-${col}`}
                        className="h-1.5 rounded-sm"
                        style={{
                          background: hasEvent
                            ? 'var(--gold-mid, #d4a017)'
                            : 'rgba(212, 160, 23, 0.10)',
                          opacity: hasEvent ? 1 : 0.6,
                        }}
                      />
                    )
                  }),
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ============================================================================
 * ListView — All events grouped by month, filterable by category
 * ========================================================================= */
const EVENTS_PER_PAGE = 20

const ListView: React.FC<{
  events: IslamicEvent[]
  categories: EventCategory[]
  activeCategory: EventCategory | null
  onCategoryChange: (cat: EventCategory | null) => void
  onEventClick: (ev: IslamicEvent) => void
  isAdmin?: boolean
  onEditEvent?: (ev: IslamicEvent) => void
}> = ({
  events,
  categories,
  activeCategory,
  onCategoryChange,
  onEventClick,
  isAdmin,
  onEditEvent,
}) => {
  const [currentPage, setCurrentPage] = useState(1)

  // Reset to page 1 whenever the filter / dataset changes.
  useEffect(() => {
    setCurrentPage(1)
  }, [activeCategory, events.length])

  // Flatten + sort all events by Hijri month then day, so we can
  // paginate across month boundaries.
  const sortedEvents = useMemo(() => {
    return [...events].sort(
      (a, b) =>
        a.hijri_month - b.hijri_month || a.hijri_day - b.hijri_day
    )
  }, [events])

  const totalPages = Math.max(1, Math.ceil(sortedEvents.length / EVENTS_PER_PAGE))
  const safePage = Math.min(currentPage, totalPages)
  const pageStart = (safePage - 1) * EVENTS_PER_PAGE
  const pageEvents = sortedEvents.slice(
    pageStart,
    pageStart + EVENTS_PER_PAGE
  )

  // Group only the events on the current page by month, preserving
  // the existing month-header layout.
  const grouped = useMemo(() => {
    const map = new Map<number, IslamicEvent[]>()
    for (const ev of pageEvents) {
      const m = ev.hijri_month
      if (!map.has(m)) map.set(m, [])
      map.get(m)!.push(ev)
    }
    for (const [, list] of map) {
      list.sort((a, b) => a.hijri_day - b.hijri_day)
    }
    return map
  }, [pageEvents])

  return (
    <div>
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
          All ({events.length})
        </button>
        {categories.map((cat) => {
          const meta = CATEGORY_META[cat]
          const count = events.filter((e) => e.category === cat).length
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

      <div className="space-y-6">
        {Array.from(grouped.entries()).map(([monthNum, monthEvents]) => (
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
                {monthEvents.length}
              </span>
            </h3>
            <div className="space-y-2">
              {monthEvents.map((ev) => {
                const meta = CATEGORY_META[ev.category]
                return (
                  <div
                    key={ev.id}
                    className="rounded-xl p-4 flex items-center gap-4"
                    style={{
                      background:
                        'linear-gradient(180deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.02) 100%)',
                      border: '1px solid var(--gold-mid, #d4a017)',
                      borderLeftWidth: 4,
                      borderLeftColor: ev.color_code,
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
                      {ev.hijri_day}
                    </div>
                    <button
                      onClick={() => onEventClick(ev)}
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
                          {ev.title_en}
                        </p>
                        <span
                          className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full"
                          style={{
                            background: `${meta.color}33`,
                            color: meta.color,
                            border: `1px solid ${meta.color}`,
                            letterSpacing: '0.18em',
                          }}
                        >
                          {meta.label}
                        </span>
                      </div>
                      {ev.title_bn && (
                        <p
                          className="text-xs mt-0.5"
                          style={{ color: 'var(--gold-mid, #d4a017)' }}
                        >
                          {ev.title_bn}
                        </p>
                      )}
                    </button>
                    {isAdmin && onEditEvent && (
                      <button
                        onClick={() => onEditEvent(ev)}
                        aria-label="Edit event"
                        className="p-1.5 rounded-lg transition shrink-0"
                        style={{
                          background: 'transparent',
                          color: 'var(--gold-mid, #d4a017)',
                          border: '1px solid var(--gold-mid, #d4a017)',
                        }}
                        title="Edit (admin)"
                      >
                        <Edit3 size={14} />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {grouped.size === 0 && (
          <p
            className="text-sm uppercase font-bold text-center py-8"
            style={{ color: 'var(--gold-mid, #d4a017)', letterSpacing: '0.18em' }}
          >
            No events match this filter.
          </p>
        )}
      </div>

      {/* ===== Pagination ===== */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2 flex-wrap">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
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
              ({pageStart + 1}–{Math.min(pageStart + EVENTS_PER_PAGE, sortedEvents.length)} of {sortedEvents.length})
            </span>
          </span>

          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
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

/* ============================================================================
 * EventDetailModal — full story + sources, dark+gold theme
 * ========================================================================= */
const EventDetailModal: React.FC<{
  event: IslamicEvent
  onClose: () => void
}> = ({ event, onClose }) => {
  const meta = CATEGORY_META[event.category]
  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4"
      style={{ background: 'rgba(8, 24, 18, 0.65)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl p-8 max-w-3xl w-full"
        style={{
          background:
            'linear-gradient(180deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.02) 100%)',
          border: '1px solid var(--gold-mid, #d4a017)',
          borderTop: `4px solid ${event.color_code}`,
          boxShadow: '0 24px 48px -16px rgba(0, 0, 0, 0.6)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-4 gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: event.color_code }}
              />
              <span
                className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full"
                style={{
                  background: `${meta.color}33`,
                  color: meta.color,
                  border: `1px solid ${meta.color}`,
                  letterSpacing: '0.18em',
                }}
              >
                {meta.label}
              </span>
            </div>
            <h2
              className="text-2xl font-bold"
              style={{
                color: 'var(--manuscript-cream, #fbf3df)',
                fontFamily: 'Georgia, "Times New Roman", serif',
              }}
            >
              {event.title_en}
            </h2>
            {event.title_bn && (
              <p
                className="text-base mt-1"
                style={{
                  color: 'var(--gold-mid, #d4a017)',
                  fontFamily: 'Georgia, "Times New Roman", serif',
                }}
              >
                {event.title_bn}
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
          {HIJRI_MONTHS_EN[event.hijri_month - 1]} {event.hijri_day}
        </div>

        <div className="space-y-3">
          {event.description_en && (
            <p
              className="text-sm leading-relaxed"
              style={{ color: 'var(--manuscript-cream, #fbf3df)' }}
            >
              {event.description_en}
            </p>
          )}
          {event.description_bn && (
            <p
              className="text-sm leading-relaxed"
              dir="rtl"
              style={{ color: 'var(--manuscript-cream, #fbf3df)', opacity: 0.9 }}
            >
              {event.description_bn}
            </p>
          )}
          {event.full_story_en && (
            <details open className="mt-2">
              <summary
                className="cursor-pointer font-bold uppercase text-[10px]"
                style={{ color: 'var(--gold-light, #f0c75e)', letterSpacing: '0.18em' }}
              >
                Full historical story
              </summary>
              <p
                className="mt-2 text-sm leading-relaxed whitespace-pre-wrap"
                style={{ color: 'var(--manuscript-cream, #fbf3df)', opacity: 0.92 }}
              >
                {event.full_story_en}
              </p>
            </details>
          )}
          {event.full_story_bn && (
            <details className="mt-2">
              <summary
                className="cursor-pointer font-bold uppercase text-[10px]"
                style={{ color: 'var(--gold-light, #f0c75e)', letterSpacing: '0.18em' }}
              >
                সম্পূর্ণ ঘটনা (বাংলা)
              </summary>
              <p
                className="mt-2 text-sm leading-relaxed whitespace-pre-wrap"
                dir="rtl"
                style={{ color: 'var(--manuscript-cream, #fbf3df)', opacity: 0.92 }}
              >
                {event.full_story_bn}
              </p>
            </details>
          )}
          {event.sources && (
            <p
              className="text-xs mt-4 pt-3"
              style={{
                color: 'var(--gold-mid, #d4a017)',
                borderTop: '1px solid var(--gold-deep, #9a6b0e)',
                opacity: 0.8,
              }}
            >
              <span
                className="font-bold uppercase mr-1"
                style={{ letterSpacing: '0.14em' }}
              >
                Sources
              </span>
              {event.sources}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

/* ============================================================================
 * AdminEventModal — add/edit/delete events (admin only)
 * ========================================================================= */
const AdminEventModal: React.FC<{
  editingEvent: IslamicEvent | null
  onClose: () => void
  onSubmit: (payload: Partial<IslamicEventCreate>) => void
  onDelete?: () => void
  isSubmitting: boolean
}> = ({ editingEvent, onClose, onSubmit, onDelete, isSubmitting }) => {
  const [form, setForm] = useState<Partial<IslamicEventCreate>>(() => {
    if (editingEvent) {
      return {
        title_en: editingEvent.title_en,
        title_bn: editingEvent.title_bn ?? '',
        hijri_month: editingEvent.hijri_month,
        hijri_day: editingEvent.hijri_day,
        category: editingEvent.category,
        description_en: editingEvent.description_en ?? '',
        description_bn: editingEvent.description_bn ?? '',
        full_story_en: editingEvent.full_story_en ?? '',
        full_story_bn: editingEvent.full_story_bn ?? '',
        sources: editingEvent.sources ?? '',
        color_code: editingEvent.color_code,
        is_recurring: editingEvent.is_recurring,
      }
    }
    return {
      title_en: '',
      title_bn: '',
      hijri_month: 1,
      hijri_day: 1,
      category: EventCategory.SPECIAL,
      description_en: '',
      description_bn: '',
      full_story_en: '',
      full_story_bn: '',
      sources: '',
      color_code: CATEGORY_META[EventCategory.SPECIAL].color,
      is_recurring: true,
    }
  })

  const labelStyle: React.CSSProperties = {
    color: 'var(--gold-mid, #d4a017)',
    letterSpacing: '0.18em',
  }
  const inputStyle: React.CSSProperties = {
    background: 'rgba(0, 0, 0, 0.30)',
    border: '1px solid var(--gold-mid, #d4a017)',
    color: 'var(--manuscript-cream, #fbf3df)',
  }
  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    fontFamily: 'Georgia, "Times New Roman", serif',
  }

  const handleSubmit = () => {
    if (!form.title_en?.trim()) return
    // Normalize empty strings to undefined so the backend can use its
    // own defaults.
    const payload: Partial<IslamicEventCreate> = {
      ...form,
      title_en: form.title_en!.trim(),
      hijri_month: form.hijri_month || 1,
      hijri_day: form.hijri_day || 1,
      category: form.category || EventCategory.SPECIAL,
      title_bn: form.title_bn?.trim() || undefined,
      description_en: form.description_en?.trim() || undefined,
      description_bn: form.description_bn?.trim() || undefined,
      full_story_en: form.full_story_en?.trim() || undefined,
      full_story_bn: form.full_story_bn?.trim() || undefined,
      sources: form.sources?.trim() || undefined,
    }
    onSubmit(payload)
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4"
      style={{ background: 'rgba(8, 24, 18, 0.65)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl p-6 max-w-2xl w-full my-8"
        style={{
          background:
            'linear-gradient(180deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.02) 100%)',
          border: '1px solid var(--gold-mid, #d4a017)',
          boxShadow: '0 24px 48px -16px rgba(0, 0, 0, 0.6)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2
            className="text-lg font-bold uppercase"
            style={{
              color: 'var(--manuscript-cream, #fbf3df)',
              fontFamily: 'Georgia, "Times New Roman", serif',
              letterSpacing: '0.14em',
            }}
          >
            {editingEvent ? 'Edit Event' : 'Add Event'}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg transition"
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
          className="mb-4"
          style={{ borderBottom: '1px solid var(--gold-deep, #9a6b0e)' }}
        />

        <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-2">
          {/* Title (English) */}
          <div>
            <label
              className="block text-[10px] uppercase font-bold mb-1"
              style={labelStyle}
            >
              Title (English) *
            </label>
            <input
              type="text"
              value={form.title_en ?? ''}
              onChange={(e) => setForm({ ...form, title_en: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2"
              style={inputStyle}
            />
          </div>

          {/* Title (Bangla) */}
          <div>
            <label
              className="block text-[10px] uppercase font-bold mb-1"
              style={labelStyle}
            >
              Title (Bangla)
            </label>
            <input
              type="text"
              value={form.title_bn ?? ''}
              onChange={(e) => setForm({ ...form, title_bn: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2"
              style={inputStyle}
            />
          </div>

          {/* Hijri month + day */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                className="block text-[10px] uppercase font-bold mb-1"
                style={labelStyle}
              >
                Hijri Month *
              </label>
              <select
                value={form.hijri_month ?? 1}
                onChange={(e) =>
                  setForm({ ...form, hijri_month: Number(e.target.value) })
                }
                className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                style={selectStyle}
              >
                {HIJRI_MONTHS_EN.map((m, idx) => (
                  <option key={idx} value={idx + 1}>
                    {idx + 1}. {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                className="block text-[10px] uppercase font-bold mb-1"
                style={labelStyle}
              >
                Day *
              </label>
              <input
                type="number"
                min={1}
                max={30}
                value={form.hijri_day ?? 1}
                onChange={(e) =>
                  setForm({ ...form, hijri_day: Number(e.target.value) })
                }
                className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <label
              className="block text-[10px] uppercase font-bold mb-1"
              style={labelStyle}
            >
              Category *
            </label>
            <select
              value={form.category ?? EventCategory.SPECIAL}
              onChange={(e) =>
                setForm({
                  ...form,
                  category: e.target.value as EventCategory,
                })
              }
              className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
              style={selectStyle}
            >
              {(Object.keys(CATEGORY_META) as EventCategory[]).map((cat) => (
                <option key={cat} value={cat}>
                  {CATEGORY_META[cat].label}
                </option>
              ))}
            </select>
          </div>

          {/* Color */}
          <div>
            <label
              className="block text-[10px] uppercase font-bold mb-1"
              style={labelStyle}
            >
              Color
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={form.color_code ?? '#EAB308'}
                onChange={(e) =>
                  setForm({ ...form, color_code: e.target.value })
                }
                className="w-12 h-9 rounded cursor-pointer"
                style={{ background: 'transparent', border: 'none' }}
              />
              <input
                type="text"
                value={form.color_code ?? '#EAB308'}
                onChange={(e) =>
                  setForm({ ...form, color_code: e.target.value })
                }
                className="flex-1 px-3 py-2 rounded-lg text-sm focus:outline-none"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Short description (English) */}
          <div>
            <label
              className="block text-[10px] uppercase font-bold mb-1"
              style={labelStyle}
            >
              Short Description (English)
            </label>
            <textarea
              value={form.description_en ?? ''}
              onChange={(e) =>
                setForm({ ...form, description_en: e.target.value })
              }
              rows={2}
              className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
              style={inputStyle}
            />
          </div>

          {/* Short description (Bangla) */}
          <div>
            <label
              className="block text-[10px] uppercase font-bold mb-1"
              style={labelStyle}
            >
              Short Description (Bangla)
            </label>
            <textarea
              value={form.description_bn ?? ''}
              onChange={(e) =>
                setForm({ ...form, description_bn: e.target.value })
              }
              rows={2}
              dir="rtl"
              className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
              style={inputStyle}
            />
          </div>

          {/* Full story (English) */}
          <div>
            <label
              className="block text-[10px] uppercase font-bold mb-1"
              style={labelStyle}
            >
              Full Historical Story (English)
            </label>
            <textarea
              value={form.full_story_en ?? ''}
              onChange={(e) =>
                setForm({ ...form, full_story_en: e.target.value })
              }
              rows={6}
              className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none font-mono"
              style={inputStyle}
            />
          </div>

          {/* Full story (Bangla) */}
          <div>
            <label
              className="block text-[10px] uppercase font-bold mb-1"
              style={labelStyle}
            >
              Full Story (Bangla)
            </label>
            <textarea
              value={form.full_story_bn ?? ''}
              onChange={(e) =>
                setForm({ ...form, full_story_bn: e.target.value })
              }
              rows={6}
              dir="rtl"
              className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
              style={inputStyle}
            />
          </div>

          {/* Sources */}
          <div>
            <label
              className="block text-[10px] uppercase font-bold mb-1"
              style={labelStyle}
            >
              Sources / References
            </label>
            <textarea
              value={form.sources ?? ''}
              onChange={(e) => setForm({ ...form, sources: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
              style={inputStyle}
            />
          </div>
        </div>

        {/* Action row */}
        <div
          className="mt-5 pt-4 flex flex-wrap items-center gap-2"
          style={{ borderTop: '1px solid var(--gold-deep, #9a6b0e)' }}
        >
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !form.title_en?.trim()}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-bold uppercase transition disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background:
                'linear-gradient(135deg, var(--gold-mid) 0%, var(--gold-light) 100%)',
              color: 'var(--emerald-deep, #064e3b)',
              border: '1px solid var(--gold-deep, #9a6b0e)',
              letterSpacing: '0.18em',
            }}
          >
            {isSubmitting
              ? 'Saving…'
              : editingEvent
                ? 'Save changes'
                : 'Create event'}
          </button>
          {editingEvent && onDelete && (
            <button
              onClick={onDelete}
              className="px-4 py-2 rounded-lg text-sm font-bold uppercase transition inline-flex items-center gap-1.5"
              style={{
                background: 'transparent',
                color: 'var(--missed, #e44244)',
                border: '1px solid var(--missed, #e44244)',
                letterSpacing: '0.18em',
              }}
            >
              <Trash2 size={14} /> Delete
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-bold uppercase transition"
            style={{
              background: 'transparent',
              color: 'var(--gold-mid, #d4a017)',
              border: '1px solid var(--gold-mid, #d4a017)',
              letterSpacing: '0.18em',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// Keep prayerTimesService referenced for tree-shaking guards.
