import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Moon, Sun, MapPin, RefreshCw, AlertCircle, Loader, Compass,
} from 'lucide-react'
import { prayerTimesService, type UserLocation } from '../services/prayerTimesService'
import { format12Hour } from '../utils'
import {
  OrnateCard,
  PageHeader,
  ManuscriptSection,
  GoldDivider,
} from '../components/IslamicOrnamentBG'

interface Prayer {
  name: string
  time: string
  icon: React.ReactNode
  accent: string // CSS gradient for the icon circle
}

export const PrayerTimes = () => {
  // ---- Read location from the shared cache (set via the TopNav picker) ----
  const { data: userLoc } = useQuery<UserLocation | undefined>({
    queryKey: ['userLocation'],
    queryFn: () => prayerTimesService.getUserLocation(),
    staleTime: Infinity,
  })

  const [date] = useState(
    new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
  )

  // ---- Prayer times query ----
  const queryKey = useMemo(
    () => ['prayerTimes', userLoc?.latitude, userLoc?.longitude, userLoc?.city, userLoc?.country],
    [userLoc],
  )

  const {
    data: prayerData,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey,
    queryFn: async () => {
      try {
        if (userLoc?.latitude && userLoc?.longitude) {
          return await prayerTimesService.getPrayerTimesByLocation(
            userLoc.latitude,
            userLoc.longitude,
          )
        }
        if (userLoc?.city && userLoc?.country) {
          return await prayerTimesService.getPrayerTimesByCity(
            userLoc.city,
            userLoc.country,
          )
        }
        return null
      } catch (err) {
        console.error('Failed to fetch prayer times:', err)
        return null
      }
    },
    enabled: !!userLoc,
    staleTime: 1000 * 60 * 60,
    refetchInterval: 1000 * 60 * 60 * 4,
  })

  // ---- Build display list ----
  const prayers: Prayer[] = [
    { name: 'Fajr',    time: format12Hour(prayerData?.prayers?.fajr),    icon: <Sun size={22} />,  accent: 'linear-gradient(135deg, var(--gold-mid) 0%, var(--gold-light) 100%)' },
    { name: 'Dhuhr',   time: format12Hour(prayerData?.prayers?.dhuhr),   icon: <Sun size={22} />,  accent: 'linear-gradient(135deg, var(--gold-light) 0%, var(--gold-glow) 100%)' },
    { name: 'Asr',     time: format12Hour(prayerData?.prayers?.asr),     icon: <Sun size={22} />,  accent: 'linear-gradient(135deg, var(--gold-mid) 0%, var(--gold-deep) 100%)' },
    { name: 'Maghrib', time: format12Hour(prayerData?.prayers?.maghrib), icon: <Moon size={22} />, accent: 'linear-gradient(135deg, var(--crimson, #b91c1c) 0%, var(--gold-deep) 100%)' },
    { name: 'Isha',    time: format12Hour(prayerData?.prayers?.isha),    icon: <Moon size={22} />, accent: 'linear-gradient(135deg, var(--lapiz, #1e3a8a) 0%, var(--gold-deep) 100%)' },
  ]

  const locationLabel = userLoc
    ? `${userLoc.city}, ${userLoc.country}`
    : 'Location not set'

  // ---------- RENDER ----------

  if (isLoading && !prayerData) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader size={32} className="animate-spin" style={{ color: 'var(--gold-mid)' }} />
          <span
            className="text-[10px] uppercase font-semibold"
            style={{ color: 'var(--gold-deep)', letterSpacing: '0.18em' }}
          >
            Calculating prayer times
          </span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <OrnateCard variant="dark" topBar corners="all" className="!p-6">
          <div className="flex items-start gap-3">
            <AlertCircle size={20} style={{ color: 'var(--missed, #e44244)' }} />
            <div>
              <p
                className="font-bold"
                style={{
                  color: 'var(--text-on-glass)',
                  fontFamily: 'Georgia, "Times New Roman", serif',
                }}
              >
                Unable to Load Prayer Times
              </p>
              <p className="text-sm mt-1" style={{ color: 'var(--gold-mid)' }}>
                Please try again or pick a different city.
              </p>
              <button
                onClick={() => refetch()}
                className="mt-3 px-4 py-1.5 rounded-xl text-sm font-semibold transition"
                style={{
                  background:
                    'linear-gradient(135deg, var(--gold-mid) 0%, var(--gold-light) 100%)',
                  color: 'var(--emerald-deep)',
                  border: '1px solid var(--gold-deep)',
                }}
              >
                Try Again
              </button>
            </div>
          </div>
        </OrnateCard>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 md:pt-0">
      <PageHeader
        title="Prayer Times"
        subtitle="Daily schedule for your location"
        actions={
          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition disabled:opacity-60 border"
            style={{
              background:
                'linear-gradient(135deg, var(--gold-mid) 0%, var(--gold-light) 100%)',
              color: 'var(--emerald-deep)',
              borderColor: 'var(--gold-deep)',
            }}
          >
            <RefreshCw size={16} className={isRefetching ? 'animate-spin' : ''} />
            {isRefetching ? 'Updating…' : 'Refresh'}
          </button>
        }
      />

      {/* ----- Location card ----- */}
      <OrnateCard variant="dark" topBar corners="all" className="!p-4 sm:!p-6 mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2">
                <MapPin size={16} className="flex-shrink-0 sm:hidden" style={{ color: 'var(--gold-mid)' }} />
                <MapPin size={18} className="flex-shrink-0 hidden sm:block" style={{ color: 'var(--gold-mid)' }} />
              <span
                className="font-bold truncate"
                title={locationLabel}
                style={{
                  color: 'var(--text-on-glass)',
                  fontFamily: 'Georgia, "Times New Roman", serif',
                }}
              >
                {isLoading ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader size={14} className="animate-spin" />
                    Loading…
                  </span>
                ) : (
                  locationLabel
                )}
              </span>
            </div>
            <p
              className="text-xs uppercase font-semibold"
              style={{ color: 'var(--gold-mid)', letterSpacing: '0.18em' }}
            >
              {date}
            </p>
            {prayerData?.hijri_date && (
              <p
                className="text-xs"
                style={{ color: 'var(--gold-light)' }}
              >
                Islamic Date: <span className="font-semibold">{prayerData.hijri_date}</span>
              </p>
            )}
          </div>
        </div>
      </OrnateCard>

      {/* ----- Empty state when no location is set yet ----- */}
      {!userLoc && !isLoading && (
        <OrnateCard variant="dark" topBar corners="all" className="!p-4 sm:!p-6 mb-6 sm:mb-8 text-center">
          <Compass
            className="mx-auto mb-3"
            size={40}
            style={{ color: 'var(--gold-mid)' }}
          />
          <p
            className="text-base sm:text-lg font-bold mb-1"
            style={{
              color: 'var(--text-on-glass)',
              fontFamily: 'Georgia, "Times New Roman", serif',
            }}
          >
            No location set
          </p>
          <p
            className="text-xs sm:text-sm mb-4"
            style={{ color: 'var(--gold-mid)' }}
          >
            Use the location button in the top navigation bar to pick a city or
            use your device&rsquo;s GPS.
          </p>
        </OrnateCard>
      )}

      {/* ----- Prayer Times Grid ----- */}
      {prayerData && (
        <ManuscriptSection
          title="Today's Schedule"
          subtitle="Five daily prayers"
        >
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 mt-3 sm:mt-4">
            {prayers.map((prayer) => (
              <div
                key={prayer.name}
                className="rounded-2xl p-3 sm:p-4 flex flex-col"
                style={{
                  background:
                    'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',
                  border: '1px solid var(--gold-mid)',
                  boxShadow: '0 4px 24px -12px rgba(0,0,0,0.4)',
                }}
              >
                <div className="flex items-center justify-between mb-2 sm:mb-3">
                  <div
                    className="p-1.5 sm:p-2 rounded-lg inline-flex items-center justify-center"
                    style={{ background: prayer.accent, color: 'var(--emerald-deep)' }}
                  >
                    {prayer.icon}
                  </div>
                </div>
                <h3
                  className="text-sm sm:text-base font-bold mb-0.5 sm:mb-1"
                  style={{
                    color: 'var(--text-on-glass)',
                    fontFamily: 'Georgia, "Times New Roman", serif',
                  }}
                >
                  {prayer.name}
                </h3>
                <p
                  className="text-lg sm:text-2xl font-bold tabular-nums"
                  style={{
                    color: 'var(--text-on-glass)',
                    fontFamily: 'Georgia, "Times New Roman", serif',
                  }}
                >
                  {prayer.time}
                </p>
              </div>
            ))}
          </div>
        </ManuscriptSection>
      )}

      {/* ----- Sunrise / Sunset + Fasting Times ----- */}
      {prayerData && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mt-3 sm:mt-4 mb-6 sm:mb-8">
          <OrnateCard variant="dark" topBar={false} corners="all" className="!p-4 sm:!p-6">
            <h3
              className="text-base sm:text-lg font-bold mb-3 sm:mb-4 flex items-center gap-2"
              style={{
                color: 'var(--text-on-glass)',
                fontFamily: 'Georgia, "Times New Roman", serif',
              }}
            >
              <Sun size={18} className="sm:hidden" style={{ color: 'var(--gold-mid)' }} />
              <Sun size={20} className="hidden sm:block" style={{ color: 'var(--gold-mid)' }} />
              Sunrise &amp; Sunset
            </h3>
            <div className="space-y-3 sm:space-y-4">
              <div
                className="flex justify-between items-center pb-3 sm:pb-4"
                style={{ borderBottom: '1px solid var(--gold-mid)' }}
              >
                <span
                  className="text-[9px] sm:text-[10px] uppercase font-semibold"
                  style={{ color: 'var(--gold-mid)', letterSpacing: '0.18em' }}
                >
                  Sunrise
                </span>
                <span
                  className="text-sm sm:text-base font-bold tabular-nums"
                  style={{
                    color: 'var(--text-on-glass)',
                    fontFamily: 'Georgia, "Times New Roman", serif',
                  }}
                >
                  {format12Hour(prayerData.prayers.sunrise)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span
                  className="text-[9px] sm:text-[10px] uppercase font-semibold"
                  style={{ color: 'var(--gold-mid)', letterSpacing: '0.18em' }}
                >
                  Sunset
                </span>
                <span
                  className="text-sm sm:text-base font-bold tabular-nums"
                  style={{
                    color: 'var(--text-on-glass)',
                    fontFamily: 'Georgia, "Times New Roman", serif',
                  }}
                >
                  {format12Hour(prayerData.prayers.sunset)}
                </span>
              </div>
            </div>
          </OrnateCard>

          <OrnateCard variant="dark" topBar={false} corners="all" className="!p-4 sm:!p-6">
            <h3
              className="text-base sm:text-lg font-bold mb-3 sm:mb-4 flex items-center gap-2"
              style={{
                color: 'var(--text-on-glass)',
                fontFamily: 'Georgia, "Times New Roman", serif',
              }}
            >
              <Moon size={18} className="sm:hidden" style={{ color: 'var(--gold-mid)' }} />
              <Moon size={20} className="hidden sm:block" style={{ color: 'var(--gold-mid)' }} />
              Fasting Times (Ramadan)
            </h3>
            <div className="space-y-3 sm:space-y-4">
              <div
                className="flex justify-between items-center pb-3 sm:pb-4"
                style={{ borderBottom: '1px solid var(--gold-mid)' }}
              >
                <span
                  className="text-[9px] sm:text-[10px] uppercase font-semibold"
                  style={{ color: 'var(--gold-mid)', letterSpacing: '0.18em' }}
                >
                  Imsak (Suhoor End)
                </span>
                <span
                  className="text-sm sm:text-base font-bold tabular-nums"
                  style={{
                    color: 'var(--text-on-glass)',
                    fontFamily: 'Georgia, "Times New Roman", serif',
                  }}
                >
                  {format12Hour(prayerData.prayers.imsak)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span
                  className="text-[9px] sm:text-[10px] uppercase font-semibold"
                  style={{ color: 'var(--gold-mid)', letterSpacing: '0.18em' }}
                >
                  Maghrib (Fast Break)
                </span>
                <span
                  className="text-sm sm:text-base font-bold tabular-nums"
                  style={{
                    color: 'var(--text-on-glass)',
                    fontFamily: 'Georgia, "Times New Roman", serif',
                  }}
                >
                  {format12Hour(prayerData.prayers.maghrib)}
                </span>
              </div>
            </div>
          </OrnateCard>
        </div>
      )}

      {/* ----- Islamic Calendar ----- */}
      {prayerData && (
        <ManuscriptSection
          title="Islamic Calendar"
          subtitle="Today across both calendars"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mt-3 sm:mt-4">
            <OrnateCard variant="dark" topBar={false} corners="all" className="!p-4 sm:!p-5">
              <p
                className="text-[9px] sm:text-[10px] uppercase font-semibold mb-1"
                style={{ color: 'var(--gold-mid)', letterSpacing: '0.18em' }}
              >
                Islamic Date (Hijri)
              </p>
              <p
                className="text-base sm:text-xl font-bold"
                style={{
                  color: 'var(--text-on-glass)',
                  fontFamily: 'Georgia, "Times New Roman", serif',
                }}
              >
                {prayerData.hijri_date ?? '—'}
              </p>
              
            </OrnateCard>

            <OrnateCard variant="dark" topBar={false} corners="all" className="!p-4 sm:!p-5">
              <p
                className="text-[9px] sm:text-[10px] uppercase font-semibold mb-1"
                style={{ color: 'var(--gold-mid)', letterSpacing: '0.18em' }}
              >
                Gregorian Date
              </p>
              <p
                className="text-base sm:text-xl font-bold"
                style={{
                  color: 'var(--text-on-glass)',
                  fontFamily: 'Georgia, "Times New Roman", serif',
                }}
              >
                {new Date().toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </OrnateCard>
          </div>
        </ManuscriptSection>
      )}

      <GoldDivider className="my-6" />

      {/* Bottom-of-page hint when something goes wrong */}
      {prayerData === null && !isLoading && (
        <OrnateCard variant="dark" topBar={false} corners="all" className="!p-4 mt-4 flex items-center gap-2">
          <AlertCircle size={18} style={{ color: 'var(--gold-mid)' }} />
          <span
            className="text-sm"
            style={{
              color: 'var(--text-on-glass)',
              fontFamily: 'Georgia, "Times New Roman", serif',
            }}
          >
            Could not load prayer times. Set your location from the top
            navigation bar.
          </span>
        </OrnateCard>
      )}
    </div>
  )
}
