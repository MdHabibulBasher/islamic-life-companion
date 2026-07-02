import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Moon, Sun, MapPin, RefreshCw, Search, X, AlertCircle, Loader, Compass,
} from 'lucide-react'
import { prayerTimesService } from '../services/prayerTimesService'
import { useToast } from '../components/Toast'
import { format12Hour } from '../utils'
import {
  OrnateCard,
  PageHeader,
  ManuscriptSection,
  GoldDivider,
  CrescentStar,
} from '../components/IslamicOrnamentBG'

interface Prayer {
  name: string
  time: string
  icon: React.ReactNode
  accent: string // CSS gradient for the icon circle
}

interface Coords {
  latitude: number
  longitude: number
  timezone?: string
}

interface City {
  city: string
  country: string
}

// Curated list of cities most likely to be searched. The backend uses
// Aladhan's address-info endpoint to resolve any of these to coordinates.
// `coords` are bundled here so the UI can also POST /user/location and let
// the backend auto-seed the local Hijri offset (e.g. Dhaka → −1 day).
const POPULAR_CITIES: Array<City & { coords: Coords }> = [
  { city: 'Dhaka',        country: 'Bangladesh',         coords: { latitude: 23.8103, longitude: 90.4125, timezone: 'Asia/Dhaka' } },
  { city: 'Cairo',        country: 'Egypt',              coords: { latitude: 30.0444, longitude: 31.2357, timezone: 'Africa/Cairo' } },
  { city: 'Riyadh',       country: 'Saudi Arabia',       coords: { latitude: 24.7136, longitude: 46.6753, timezone: 'Asia/Riyadh' } },
  { city: 'Mecca',        country: 'Saudi Arabia',       coords: { latitude: 21.3891, longitude: 39.8579, timezone: 'Asia/Riyadh' } },
  { city: 'Medina',       country: 'Saudi Arabia',       coords: { latitude: 24.4686, longitude: 39.6142, timezone: 'Asia/Riyadh' } },
  { city: 'Dubai',        country: 'United Arab Emirates', coords: { latitude: 25.2048, longitude: 55.2708, timezone: 'Asia/Dubai' } },
  { city: 'Istanbul',     country: 'Turkey',             coords: { latitude: 41.0082, longitude: 28.9784, timezone: 'Europe/Istanbul' } },
  { city: 'Karachi',      country: 'Pakistan',           coords: { latitude: 24.8607, longitude: 67.0011, timezone: 'Asia/Karachi' } },
  { city: 'Lahore',       country: 'Pakistan',           coords: { latitude: 31.5497, longitude: 74.3436, timezone: 'Asia/Karachi' } },
  { city: 'Jakarta',      country: 'Indonesia',          coords: { latitude: -6.2088, longitude: 106.8456, timezone: 'Asia/Jakarta' } },
  { city: 'Kuala Lumpur', country: 'Malaysia',           coords: { latitude: 3.1390,  longitude: 101.6869, timezone: 'Asia/Kuala_Lumpur' } },
  { city: 'London',       country: 'United Kingdom',     coords: { latitude: 51.5074, longitude: -0.1278,  timezone: 'Europe/London' } },
  { city: 'New York',     country: 'United States',      coords: { latitude: 40.7128, longitude: -74.0060, timezone: 'America/New_York' } },
  { city: 'Toronto',      country: 'Canada',             coords: { latitude: 43.6532, longitude: -79.3832, timezone: 'America/Toronto' } },
  { city: 'Sydney',       country: 'Australia',          coords: { latitude: -33.8688, longitude: 151.2093, timezone: 'Australia/Sydney' } },
]

const STORAGE_KEY = 'prayer-times:location'

const loadSavedLocation = (): { coords?: Coords; city?: City } | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

const saveLocation = (data: { coords?: Coords; city?: City }) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    /* ignore quota errors */
  }
}

const displayLabel = (city?: City): string => {
  if (!city) return ''
  if (city.city === 'Your Location') return city.city
  return `${city.city}, ${city.country}`
}

export const PrayerTimes = () => {
  const { error: showErrorToast } = useToast()

  // Restore the user's last location so they don't have to re-pick every visit.
  const saved = useMemo(() => loadSavedLocation(), [])
  const [coords, setCoords] = useState<Coords | undefined>(saved?.coords)
  const [selectedCity, setSelectedCity] = useState<City | undefined>(saved?.city)
  const [resolvedCity, setResolvedCity] = useState<City | undefined>(saved?.city)

  const [date] = useState(
    new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
  )

  // Manual search UI state
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [resolvingCity, setResolvingCity] = useState(false)

  // ---- On mount: try geolocation once, if we have no saved location ----
  useEffect(() => {
    if (coords || selectedCity) {
      return
    }
    if (!('geolocation' in navigator)) return

    setResolvingCity(true)
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const c: Coords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC',
        }
        setCoords(c)
        try {
          const geo = await prayerTimesService.reverseGeocode(c.latitude, c.longitude)
          if (geo.city && geo.country) {
            const city: City = { city: geo.city, country: geo.country }
            setResolvedCity(city)
            saveLocation({ coords: c, city })
            prayerTimesService
              .setUserLocation({
                city: city.city,
                country: city.country,
                latitude: c.latitude,
                longitude: c.longitude,
                timezone: c.timezone ?? 'UTC',
              })
              .catch((err) => console.warn('Failed to persist GPS location', err))
          } else {
            saveLocation({ coords: c })
          }
        } catch (err) {
          console.warn('Reverse-geocode failed', err)
          saveLocation({ coords: c })
        } finally {
          setResolvingCity(false)
        }
      },
      (err) => {
        console.log('Geolocation denied/unavailable:', err.message)
        setResolvingCity(false)
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    )
  }, [coords, selectedCity])

  // ---- Filtered search results ----
  const filteredCities = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return POPULAR_CITIES.slice(0, 8)
    return POPULAR_CITIES.filter(
      (c) => c.city.toLowerCase().includes(q) || c.country.toLowerCase().includes(q),
    )
  }, [searchQuery])

  const handlePickCity = (c: City & { coords?: Coords }) => {
    setSelectedCity(c)
    setResolvedCity(c)
    setCoords(undefined)
    setSearchOpen(false)
    setSearchQuery('')
    saveLocation({ city: c })

    const coords = c.coords
    if (coords && coords.latitude != null && coords.longitude != null) {
      prayerTimesService
        .setUserLocation({
          city: c.city,
          country: c.country,
          latitude: coords.latitude,
          longitude: coords.longitude,
          timezone: coords.timezone ?? 'UTC',
        })
        .catch((err) => console.warn('Failed to persist user location to backend', err))
    }
  }

  const handleUseGPS = () => {
    if (!('geolocation' in navigator)) {
      showErrorToast('Geolocation is not supported in this browser')
      return
    }
    setResolvingCity(true)
    setSearchOpen(false)
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const c: Coords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC',
        }
        setCoords(c)
        setSelectedCity(undefined)
        try {
          const geo = await prayerTimesService.reverseGeocode(c.latitude, c.longitude)
          const city: City | undefined =
            geo.city && geo.country ? { city: geo.city, country: geo.country } : undefined
          setResolvedCity(city)
          saveLocation({ coords: c, city })
          if (city) {
            prayerTimesService
              .setUserLocation({
                city: city.city,
                country: city.country,
                latitude: c.latitude,
                longitude: c.longitude,
                timezone: c.timezone ?? 'UTC',
              })
              .catch((err) => console.warn('Failed to persist GPS location', err))
          }
          if (!city) {
            showErrorToast('Could not resolve a city name from your location')
          }
        } catch (err) {
          console.warn('Reverse-geocode failed', err)
          setResolvedCity(undefined)
          saveLocation({ coords: c })
          showErrorToast('Could not resolve a city name from your location')
        } finally {
          setResolvingCity(false)
        }
      },
      (err) => {
        setResolvingCity(false)
        showErrorToast(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission denied. Please pick a city manually.'
            : 'Could not detect your location. Please pick a city manually.',
        )
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    )
  }

  // ---- Prayer times query ----
  const queryKey = useMemo(
    () => ['prayerTimes', coords?.latitude, coords?.longitude, selectedCity?.city, selectedCity?.country],
    [coords, selectedCity],
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
        if (coords?.latitude && coords?.longitude) {
          return await prayerTimesService.getPrayerTimesByLocation(
            coords.latitude,
            coords.longitude,
          )
        }
        if (selectedCity) {
          return await prayerTimesService.getPrayerTimesByCity(
            selectedCity.city,
            selectedCity.country,
          )
        }
        return null
      } catch (err) {
        console.error('Failed to fetch prayer times:', err)
        return null
      }
    },
    enabled: !!(coords || selectedCity),
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

  const locationLabel = resolvedCity
    ? displayLabel(resolvedCity)
    : coords
      ? `${coords.latitude.toFixed(2)}, ${coords.longitude.toFixed(2)}`
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
                  color: 'var(--manuscript-cream)',
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
        ornament={<CrescentStar size={28} />}
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
      <OrnateCard variant="dark" topBar corners="all" className="!p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2">
              <MapPin size={18} style={{ color: 'var(--gold-mid)' }} className="flex-shrink-0" />
              <span
                className="font-bold truncate"
                title={locationLabel}
                style={{
                  color: 'var(--manuscript-cream)',
                  fontFamily: 'Georgia, "Times New Roman", serif',
                }}
              >
                {resolvingCity ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader size={14} className="animate-spin" />
                    Detecting your location…
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
          <button
            onClick={() => setSearchOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition border"
            style={{
              background:
                'linear-gradient(135deg, var(--gold-mid) 0%, var(--gold-light) 100%)',
              color: 'var(--emerald-deep)',
              borderColor: 'var(--gold-deep)',
            }}
          >
            <Search size={16} />
            {resolvedCity || coords ? 'Change city' : 'Pick a city'}
          </button>
        </div>
      </OrnateCard>

      {/* ----- Empty state when no location is set yet ----- */}
      {!coords && !selectedCity && !resolvingCity && (
        <OrnateCard variant="dark" topBar corners="all" className="!p-8 mb-8 text-center">
          <Compass
            className="mx-auto mb-3"
            size={48}
            style={{ color: 'var(--gold-mid)' }}
          />
          <p
            className="text-lg font-bold mb-1"
            style={{
              color: 'var(--manuscript-cream)',
              fontFamily: 'Georgia, "Times New Roman", serif',
            }}
          >
            No location set
          </p>
          <p
            className="text-sm mb-4"
            style={{ color: 'var(--gold-mid)' }}
          >
            Pick a city or use your device&rsquo;s GPS to see accurate prayer times.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              onClick={handleUseGPS}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition border"
              style={{
                background:
                  'linear-gradient(135deg, var(--gold-mid) 0%, var(--gold-light) 100%)',
                color: 'var(--emerald-deep)',
                borderColor: 'var(--gold-deep)',
              }}
            >
              Use my location
            </button>
            <button
              onClick={() => setSearchOpen(true)}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition border"
              style={{
                background: 'rgba(251,243,223,0.10)',
                color: 'var(--manuscript-cream)',
                borderColor: 'var(--gold-mid)',
              }}
            >
              Choose a city
            </button>
          </div>
        </OrnateCard>
      )}

      {/* ----- Prayer Times Grid ----- */}
      {prayerData && (
        <ManuscriptSection
          title="Today's Schedule"
          subtitle="Five daily prayers"
        >
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mt-4">
            {prayers.map((prayer) => (
              <div
                key={prayer.name}
                className="rounded-2xl p-4 flex flex-col"
                style={{
                  background:
                    'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',
                  border: '1px solid var(--gold-mid)',
                  boxShadow: '0 4px 24px -12px rgba(0,0,0,0.4)',
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div
                    className="p-2 rounded-lg inline-flex items-center justify-center"
                    style={{ background: prayer.accent, color: 'var(--emerald-deep)' }}
                  >
                    {prayer.icon}
                  </div>
                </div>
                <h3
                  className="text-base font-bold mb-1"
                  style={{
                    color: 'var(--manuscript-cream)',
                    fontFamily: 'Georgia, "Times New Roman", serif',
                  }}
                >
                  {prayer.name}
                </h3>
                <p
                  className="text-2xl font-bold tabular-nums"
                  style={{
                    color: 'var(--manuscript-cream)',
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 mb-8">
          <OrnateCard variant="dark" topBar={false} corners="all" className="!p-6">
            <h3
              className="text-lg font-bold mb-4 flex items-center gap-2"
              style={{
                color: 'var(--manuscript-cream)',
                fontFamily: 'Georgia, "Times New Roman", serif',
              }}
            >
              <Sun size={20} style={{ color: 'var(--gold-mid)' }} />
              Sunrise &amp; Sunset
            </h3>
            <div className="space-y-4">
              <div
                className="flex justify-between items-center pb-4"
                style={{ borderBottom: '1px solid var(--gold-mid)' }}
              >
                <span
                  className="text-[10px] uppercase font-semibold"
                  style={{ color: 'var(--gold-mid)', letterSpacing: '0.18em' }}
                >
                  Sunrise
                </span>
                <span
                  className="font-bold"
                  style={{
                    color: 'var(--manuscript-cream)',
                    fontFamily: 'Georgia, "Times New Roman", serif',
                  }}
                >
                  {format12Hour(prayerData.prayers.sunrise)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span
                  className="text-[10px] uppercase font-semibold"
                  style={{ color: 'var(--gold-mid)', letterSpacing: '0.18em' }}
                >
                  Sunset
                </span>
                <span
                  className="font-bold"
                  style={{
                    color: 'var(--manuscript-cream)',
                    fontFamily: 'Georgia, "Times New Roman", serif',
                  }}
                >
                  {format12Hour(prayerData.prayers.sunset)}
                </span>
              </div>
            </div>
          </OrnateCard>

          <OrnateCard variant="dark" topBar={false} corners="all" className="!p-6">
            <h3
              className="text-lg font-bold mb-4 flex items-center gap-2"
              style={{
                color: 'var(--manuscript-cream)',
                fontFamily: 'Georgia, "Times New Roman", serif',
              }}
            >
              <Moon size={20} style={{ color: 'var(--gold-mid)' }} />
              Fasting Times (Ramadan)
            </h3>
            <div className="space-y-4">
              <div
                className="flex justify-between items-center pb-4"
                style={{ borderBottom: '1px solid var(--gold-mid)' }}
              >
                <span
                  className="text-[10px] uppercase font-semibold"
                  style={{ color: 'var(--gold-mid)', letterSpacing: '0.18em' }}
                >
                  Imsak (Suhoor End)
                </span>
                <span
                  className="font-bold"
                  style={{
                    color: 'var(--manuscript-cream)',
                    fontFamily: 'Georgia, "Times New Roman", serif',
                  }}
                >
                  {format12Hour(prayerData.prayers.imsak)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span
                  className="text-[10px] uppercase font-semibold"
                  style={{ color: 'var(--gold-mid)', letterSpacing: '0.18em' }}
                >
                  Maghrib (Fast Break)
                </span>
                <span
                  className="font-bold"
                  style={{
                    color: 'var(--manuscript-cream)',
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <OrnateCard variant="dark" topBar={false} corners="all" className="!p-5">
              <p
                className="text-[10px] uppercase font-semibold mb-1"
                style={{ color: 'var(--gold-mid)', letterSpacing: '0.18em' }}
              >
                Islamic Date (Hijri)
              </p>
              <p
                className="text-xl font-bold"
                style={{
                  color: 'var(--manuscript-cream)',
                  fontFamily: 'Georgia, "Times New Roman", serif',
                }}
              >
                {prayerData.hijri_date ?? '—'}
              </p>
              
            </OrnateCard>

            <OrnateCard variant="dark" topBar={false} corners="all" className="!p-5">
              <p
                className="text-[10px] uppercase font-semibold mb-1"
                style={{ color: 'var(--gold-mid)', letterSpacing: '0.18em' }}
              >
                Gregorian Date
              </p>
              <p
                className="text-xl font-bold"
                style={{
                  color: 'var(--manuscript-cream)',
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

      {/* ----- City search modal ----- */}
      {searchOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4"
          onClick={() => setSearchOpen(false)}
          style={{
            background: 'rgba(8, 24, 18, 0.65)',
            backdropFilter: 'blur(4px)',
          }}
        >
          <OrnateCard
            topBar
            corners="all"
            className="!p-0 w-full max-w-md mt-12 sm:mt-0 overflow-hidden"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="rounded-2xl overflow-hidden"
              style={{
                background:
                  'linear-gradient(180deg, var(--manuscript-cream) 0%, var(--manuscript-cream-2) 100%)',
              }}
            >
              <div
                className="p-4 flex items-center gap-2"
                style={{
                  background:
                    'linear-gradient(135deg, var(--gold-mid) 0%, var(--gold-light) 100%)',
                  borderBottom: '1px solid var(--gold-deep)',
                }}
              >
                <Search size={20} style={{ color: 'var(--emerald-deep)' }} />
                <input
                  type="text"
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search city or country…"
                  className="flex-1 outline-none bg-transparent"
                  style={{
                    color: 'var(--emerald-deep)',
                    fontFamily: 'Georgia, "Times New Roman", serif',
                  }}
                />
                <button
                  onClick={() => setSearchOpen(false)}
                  style={{ color: 'var(--emerald-deep)' }}
                  aria-label="Close"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="max-h-80 overflow-y-auto">
                {filteredCities.length === 0 ? (
                  <div
                    className="p-6 text-center text-sm"
                    style={{ color: 'var(--gold-deep)' }}
                  >
                    No matches for &ldquo;{searchQuery}&rdquo;.
                    <br />
                    <span className="text-xs" style={{ opacity: 0.8 }}>
                      Try one of the popular cities below.
                    </span>
                  </div>
                ) : (
                  filteredCities.map((c) => {
                    const isActive =
                      selectedCity?.city === c.city && selectedCity?.country === c.country
                    return (
                      <button
                        key={`${c.city},${c.country}`}
                        onClick={() => handlePickCity(c)}
                        className="w-full text-left p-3 border-b last:border-0 flex items-center justify-between transition"
                        style={{
                          background: isActive
                            ? 'linear-gradient(90deg, var(--manuscript-cream) 0%, var(--manuscript-cream-2) 100%)'
                            : 'transparent',
                          color: 'var(--emerald-deep)',
                          borderColor: 'var(--gold-mid)',
                        }}
                      >
                        <div>
                          <p
                            className="font-bold"
                            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
                          >
                            {c.city}
                          </p>
                          <p
                            className="text-[10px] uppercase font-semibold"
                            style={{
                              color: 'var(--gold-deep)',
                              letterSpacing: '0.18em',
                            }}
                          >
                            {c.country}
                          </p>
                        </div>
                        {isActive && (
                          <span
                            className="text-[10px] font-bold uppercase"
                            style={{
                              color: 'var(--gold-deep)',
                              letterSpacing: '0.18em',
                            }}
                          >
                            Selected
                          </span>
                        )}
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          </OrnateCard>
        </div>
      )}

      {/* Bottom-of-page hint when something goes wrong */}
      {prayerData === null && !isLoading && (
        <OrnateCard variant="dark" topBar={false} corners="all" className="!p-4 mt-4 flex items-center gap-2">
          <AlertCircle size={18} style={{ color: 'var(--gold-mid)' }} />
          <span
            className="text-sm"
            style={{
              color: 'var(--manuscript-cream)',
              fontFamily: 'Georgia, "Times New Roman", serif',
            }}
          >
            Could not load prayer times. Pick a city from the search above.
          </span>
        </OrnateCard>
      )}
    </div>
  )
}
