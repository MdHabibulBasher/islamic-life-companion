import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Clock, Moon, Sun, MapPin, RefreshCw, Loader } from 'lucide-react'
import { LoadingSpinner } from '../components/Loading'
import { Button } from '../components/Form'
import { prayerTimesService } from '../services/prayerTimesService'

interface Prayer {
  name: string
  time: string
  icon: React.ReactNode
  color: string
}

export const PrayerTimes = () => {
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null)
  const [locationName, setLocationName] = useState<{ city?: string; country?: string }>({})
  const [date] = useState(new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }))

  // Get user's geolocation on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          }
          setUserLocation(coords)
          
          // Try to get city/country from coordinates (reverse geocoding)
          // For now, we'll use default or let user set it
          setLocationName({ city: 'Your Location', country: 'Earth' })
        },
        (error) => {
          console.log('Geolocation not available, using default location:', error)
          // Default to a major city
          setLocationName({ city: 'Cairo', country: 'Egypt' })
        }
      )
    } else {
      setLocationName({ city: 'Cairo', country: 'Egypt' })
    }
  }, [])

  // Fetch prayer times from API based on location
  const { data: prayerData, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['prayerTimes', userLocation],
    queryFn: async () => {
      try {
        // If we have coordinates, use location endpoint
        if (userLocation?.latitude && userLocation?.longitude) {
          const response = await prayerTimesService.getPrayerTimesByLocation(
            userLocation.latitude,
            userLocation.longitude
          )
          return response
        } else {
          // Otherwise use city endpoint
          const response = await prayerTimesService.getPrayerTimesByCity(
            locationName.city || 'Cairo',
            locationName.country || 'Egypt'
          )
          return response
        }
      } catch (err) {
        console.error('Failed to fetch prayer times:', err)
        // Return fallback data
        return null
      }
    },
    enabled: !!(userLocation || locationName.city),
    staleTime: 1000 * 60 * 60, // 1 hour
    refetchInterval: 1000 * 60 * 60 * 4, // Refetch every 4 hours
  })

  // Transform prayer data to Prayer interface
  const prayers: Prayer[] = [
    {
      name: 'Fajr',
      time: typeof prayerData?.prayers?.fajr === 'string' ? prayerData.prayers.fajr : '05:30 AM',
      icon: <Sun size={24} />,
      color: 'text-orange-600'
    },
    {
      name: 'Dhuhr',
      time: typeof prayerData?.prayers?.dhuhr === 'string' ? prayerData.prayers.dhuhr : '12:45 PM',
      icon: <Sun size={24} />,
      color: 'text-yellow-600'
    },
    {
      name: 'Asr',
      time: typeof prayerData?.prayers?.asr === 'string' ? prayerData.prayers.asr : '03:50 PM',
      icon: <Sun size={24} />,
      color: 'text-amber-600'
    },
    {
      name: 'Maghrib',
      time: typeof prayerData?.prayers?.maghrib === 'string' ? prayerData.prayers.maghrib : '05:45 PM',
      icon: <Moon size={24} />,
      color: 'text-purple-600'
    },
    {
      name: 'Isha',
      time: typeof prayerData?.prayers?.isha === 'string' ? prayerData.prayers.isha : '07:15 PM',
      icon: <Moon size={24} />,
      color: 'text-indigo-600'
    }
  ]

  if (isLoading) return <LoadingSpinner fullScreen text="Loading prayer times..." />

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white border-2 border-amber-500 rounded-lg text-gray-900 px-4 py-3">
          <p className="font-semibold">Unable to Load Prayer Times</p>
          <p className="text-sm text-gray-600 mt-1">Please check your location settings and try again.</p>
          <Button onClick={() => refetch()} variant="secondary" className="mt-3 text-sm">
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 md:pt-0">
      {/* Header Section */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-3">Prayer Times</h1>
        <div className="bg-white rounded-lg p-6 border-2 border-amber-500 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-gray-700">
                <MapPin size={18} className="text-amber-600" />
                <span className="font-medium">{prayerData?.location || locationName.city || 'Your Location'}</span>
              </div>
              <p className="text-sm text-gray-600">{date}</p>
              {prayerData?.hijri_date && (
                <p className="text-sm text-gray-600">Islamic Date: {prayerData.hijri_date}</p>
              )}
            </div>
            <Button
              onClick={() => refetch()}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg"
              disabled={isRefetching}
            >
              <RefreshCw size={16} className={isRefetching ? 'animate-spin' : ''} />
              {isRefetching ? 'Updating...' : 'Refresh'}
            </Button>
          </div>
        </div>
      </div>

      {/* Prayer Times Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {prayers.map((prayer, index) => (
          <div
            key={index}
            className="bg-white rounded-lg p-5 border-2 border-amber-500 shadow hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="bg-amber-50 p-2 rounded-lg">
                <div className={`${prayer.color}`}>{prayer.icon}</div>
              </div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">{prayer.name}</h3>
            <p className="text-2xl font-bold text-gray-900">{prayer.time}</p>
          </div>
        ))}
      </div>

      {/* Additional Info Section */}
      {prayerData && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg p-6 border-2 border-amber-500 shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Sun size={20} className="text-amber-600" />
              Sunrise & Sunset
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-4 border-b border-gray-200">
                <span className="text-gray-600 font-medium">Sunrise</span>
                <span className="font-semibold text-gray-900">{typeof prayerData?.prayers?.sunrise === 'string' ? prayerData.prayers.sunrise : '06:30 AM'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600 font-medium">Sunset</span>
                <span className="font-semibold text-gray-900">{typeof prayerData?.prayers?.sunset === 'string' ? prayerData.prayers.sunset : '06:00 PM'}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 border-2 border-amber-500 shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Moon size={20} className="text-amber-600" />
              Fasting Times (Ramadan)
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-4 border-b border-gray-200">
                <span className="text-gray-600 font-medium">Imsak (Suhoor End)</span>
                <span className="font-semibold text-gray-900">{typeof prayerData?.prayers?.imsak === 'string' ? prayerData.prayers.imsak : '05:15 AM'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600 font-medium">Maghrib (Fast Break)</span>
                <span className="font-semibold text-gray-900">{typeof prayerData?.prayers?.maghrib === 'string' ? prayerData.prayers.maghrib : '05:45 PM'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Islamic Calendar Section */}
      <div className="bg-white rounded-lg p-8 border-2 border-amber-500 shadow">
        <div className="flex items-center gap-2 mb-4">
          <Clock size={24} className="text-amber-600" />
          <h2 className="text-2xl font-semibold text-gray-900">Islamic Calendar</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
            <p className="text-sm text-gray-600 mb-1">Islamic Date (Hijri)</p>
            <p className="text-xl font-bold text-gray-900">
              {prayerData?.hijri_date || 'Loading Islamic date...'}
            </p>
          </div>
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <p className="text-sm text-gray-600 mb-1">Gregorian Date</p>
            <p className="text-xl font-bold text-gray-900">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}





