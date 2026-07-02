// ============================================================================
// LocationPicker
// ----------------------------------------------------------------------------
// A shared city/country selector used by the Calendar and Fasting pages to
// keep the user's location (and the auto-seeded Hijri offset derived from it)
// in sync. Mirrors the prayer-times picker exactly so the three pages all
// look the same and all benefit from the country -> Hijri offset heuristic
// in `app/services/hijri.py`.
//
// When the user picks a city for the first time, the backend
// `POST /user/location` endpoint calls `suggest_hijri_offset_for(country)`
// and writes the result to `user_preferences.hijri_offset`. Subsequent
// Hijri-date queries (on /prayer-times/islamic-date, calendar events,
// fasting entries) then automatically use the right offset.
//
// Props
//   onLocationChange?: called with the new location after a successful
//     pick so the parent can invalidate its own queries.
// ============================================================================
import React, { useEffect, useMemo, useState } from 'react'
import { MapPin, Search, X, Crosshair } from 'lucide-react'
import { prayerTimesService, type UserLocation } from '../services/prayerTimesService'
import { useToast } from './Toast'
import { OrnateCard } from './IslamicOrnamentBG'

interface Coords {
  latitude: number
  longitude: number
  timezone?: string
}

interface City {
  city: string
  country: string
}

// Same curated list as in PrayerTimes.tsx so the picker behaves identically.
const POPULAR_CITIES: Array<City & { coords: Coords }> = [
  { city: 'Dhaka',        country: 'Bangladesh',         coords: { latitude: 23.8103, longitude: 90.4125, timezone: 'Asia/Dhaka' } },
  { city: 'Chittagong',   country: 'Bangladesh',         coords: { latitude: 22.3569, longitude: 91.7832, timezone: 'Asia/Dhaka' } },
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

const displayLabel = (city?: { city: string; country: string } | null): string => {
  if (!city) return ''
  return `${city.city}, ${city.country}`
}

export interface LocationPickerProps {
  /** Called after a successful location pick with the saved location. */
  onLocationChange?: (loc: UserLocation) => void
  /** Optional className for the trigger button. */
  className?: string
  /** Optional compact mode for tight layouts. */
  compact?: boolean
}

export const LocationPicker: React.FC<LocationPickerProps> = ({
  onLocationChange,
  className,
  compact,
}) => {
  const { success, error: showError } = useToast()
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [resolving, setResolving] = useState(false)
  const [currentLoc, setCurrentLoc] = useState<UserLocation | null>(null)

  // Load current location on mount.
  useEffect(() => {
    let mounted = true
    prayerTimesService
      .getUserLocation()
      .then((loc) => {
        if (mounted) setCurrentLoc(loc)
      })
      .catch(() => {
        /* not set yet — that's fine */
      })
    return () => {
      mounted = false
    }
  }, [])

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return POPULAR_CITIES.slice(0, 10)
    return POPULAR_CITIES.filter(
      (c) =>
        c.city.toLowerCase().includes(q) || c.country.toLowerCase().includes(q),
    )
  }, [searchQuery])

  const handlePickCity = async (c: City & { coords: Coords }) => {
    setOpen(false)
    setSearchQuery('')
    try {
      const saved = await prayerTimesService.setUserLocation({
        city: c.city,
        country: c.country,
        latitude: c.coords.latitude,
        longitude: c.coords.longitude,
        timezone: c.coords.timezone ?? 'UTC',
      })
      setCurrentLoc(saved)
      success(`Location set to ${c.city}, ${c.country}`)
      onLocationChange?.(saved)
    } catch (e: any) {
      showError(e?.response?.data?.detail ?? 'Failed to save location')
    }
  }

  const handleUseGPS = () => {
    if (!('geolocation' in navigator)) {
      showError('Geolocation is not supported in this browser')
      return
    }
    setResolving(true)
    setOpen(false)
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const c: Coords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC',
        }
        try {
          const geo = await prayerTimesService.reverseGeocode(
            c.latitude,
            c.longitude,
          )
          const city: City | undefined =
            geo.city && geo.country
              ? { city: geo.city, country: geo.country }
              : undefined
          if (!city) {
            showError('Could not resolve a city name from your location')
            setResolving(false)
            return
          }
          // The backend requires coordinates, so pass them along.
          const saved = await prayerTimesService.setUserLocation({
            city: city.city,
            country: city.country,
            latitude: c.latitude,
            longitude: c.longitude,
            timezone: c.timezone ?? 'UTC',
          })
          setCurrentLoc(saved)
          success(`Location set to ${city.city}, ${city.country}`)
          onLocationChange?.(saved)
        } catch (err) {
          showError('Could not resolve a city name from your location')
        } finally {
          setResolving(false)
        }
      },
      (err) => {
        setResolving(false)
        showError(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission denied. Please pick a city manually.'
            : 'Could not detect your location. Please pick a city manually.',
        )
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    )
  }

  const label = currentLoc?.city
    ? displayLabel({ city: currentLoc.city, country: currentLoc.country ?? '' })
    : 'Set location'

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={resolving}
        className={
          'inline-flex items-center gap-2 transition disabled:opacity-50 ' +
          (className ?? '')
        }
        style={{
          background:
            'linear-gradient(135deg, rgba(212, 160, 23, 0.15) 0%, rgba(212, 160, 23, 0.05) 100%)',
          color: 'var(--gold-mid, #d4a017)',
          border: '1px solid var(--gold-mid, #d4a017)',
          borderRadius: 12,
          padding: compact ? '4px 10px' : '6px 12px',
          fontSize: compact ? 10 : 11,
          fontWeight: 700,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          fontFamily: 'Georgia, "Times New Roman", serif',
        }}
        title={label}
      >
        <MapPin size={compact ? 12 : 14} />
        {resolving ? 'Detecting…' : label}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4"
          onClick={() => setOpen(false)}
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
                  onClick={() => setOpen(false)}
                  style={{ color: 'var(--emerald-deep)' }}
                  aria-label="Close"
                >
                  <X size={20} />
                </button>
              </div>

              <div
                className="px-3 py-2 border-b flex items-center gap-2 cursor-pointer transition"
                onClick={handleUseGPS}
                style={{
                  background:
                    'linear-gradient(90deg, var(--manuscript-cream) 0%, var(--manuscript-cream-2) 100%)',
                  borderColor: 'var(--gold-mid)',
                  color: 'var(--emerald-deep)',
                }}
              >
                <Crosshair size={16} style={{ color: 'var(--gold-deep)' }} />
                <span
                  className="text-sm font-bold"
                  style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
                >
                  Use my current location
                </span>
              </div>

              <div className="max-h-80 overflow-y-auto">
                {filtered.length === 0 ? (
                  <div
                    className="p-6 text-center text-sm"
                    style={{ color: 'var(--gold-deep)' }}
                  >
                    No matches for &ldquo;{searchQuery}&rdquo;.
                  </div>
                ) : (
                  filtered.map((c) => {
                    const isActive =
                      currentLoc?.city === c.city &&
                      currentLoc?.country === c.country
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
                            style={{
                              fontFamily: 'Georgia, "Times New Roman", serif',
                            }}
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
    </>
  )
}

export default LocationPicker
