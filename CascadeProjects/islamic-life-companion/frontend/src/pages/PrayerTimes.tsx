import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Clock, Moon, Sun, MapPin, RefreshCw } from 'lucide-react'
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
          setUserLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          })
        },
        (error) => {
          console.log('Geolocation not available, using default location:', error)
        }
      )
    }
  }, [])

  // Fetch prayer times from API
  const { data: prayerData, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['prayerTimes', userLocation],
    queryFn: async () => {
      try {
        const response = await prayerTimesService.getTodayPrayerTimes()
        console.log('Prayer times response:', response)
        return response
      } catch (err) {
        console.error('Failed to fetch prayer times:', err)
        // Return fallback data
        return null
      }
    },
    enabled: true,
    staleTime: 1000 * 60 * 60, // 1 hour
    refetchInterval: 1000 * 60 * 60 * 4, // Refetch every 4 hours
  })

  // Transform prayer data to Prayer interface
  const prayers: Prayer[] = [
    {
      name: 'Fajr',
      time: typeof prayerData?.prayers?.fajr === 'string' ? prayerData.prayers.fajr : '05:30 AM',
      icon: <Sun size={24} />,
      color: 'text-orange-500'
    },
    {
      name: 'Dhuhr',
      time: typeof prayerData?.prayers?.dhuhr === 'string' ? prayerData.prayers.dhuhr : '12:45 PM',
      icon: <Sun size={24} />,
      color: 'text-yellow-500'
    },
    {
      name: 'Asr',
      time: typeof prayerData?.prayers?.asr === 'string' ? prayerData.prayers.asr : '03:50 PM',
      icon: <Sun size={24} />,
      color: 'text-amber-500'
    },
    {
      name: 'Maghrib',
      time: typeof prayerData?.prayers?.maghrib === 'string' ? prayerData.prayers.maghrib : '05:45 PM',
      icon: <Moon size={24} />,
      color: 'text-purple-500'
    },
    {
      name: 'Isha',
      time: typeof prayerData?.prayers?.isha === 'string' ? prayerData.prayers.isha : '07:15 PM',
      icon: <Moon size={24} />,
      color: 'text-indigo-500'
    }
  ]

  if (isLoading) return <LoadingSpinner fullScreen text="Loading prayer times..." />

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-600 text-red-800 dark:text-red-200 px-4 py-3 rounded">
          <p className="font-bold">Error Loading Prayer Times</p>
          <p>Failed to load prayer times. Please try again later.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 md:pt-0">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">Prayer Times</h1>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-gray-600 dark:text-gray-400 mb-4">
          <div className="flex items-center gap-2">
            <MapPin size={18} />
            <span>{prayerData?.location || 'Cairo, Egypt'}</span>
          </div>
          <span className="text-sm">• {date}</span>
        </div>
        {prayerData?.hijri_date && (
          <p className="text-sm text-gray-500 dark:text-gray-500">Islamic Date: {prayerData.hijri_date}</p>
        )}
        <Button
          onClick={() => refetch()}
          variant="secondary"
          className="mt-2 flex items-center gap-2 text-sm"
          disabled={isRefetching}
        >
          <RefreshCw size={16} className={isRefetching ? 'animate-spin' : ''} />
          {isRefetching ? 'Updating...' : 'Refresh'}
        </Button>
      </div>

      {/* Prayer Times Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {prayers.map((prayer, index) => (
          <div
            key={index}
            className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`${prayer.color} bg-gray-100 dark:bg-gray-700 p-3 rounded-lg`}>
                  {prayer.icon}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{prayer.name}</h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">Islamic Prayer</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{prayer.time}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Additional Info Section */}
      {prayerData && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Sunrise & Sunset</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">Sunrise</span>
                <span className="font-semibold text-gray-900 dark:text-white">{typeof prayerData?.prayers?.sunrise === 'string' ? prayerData.prayers.sunrise : '06:30 AM'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">Sunset</span>
                <span className="font-semibold text-gray-900 dark:text-white">{typeof prayerData?.prayers?.sunset === 'string' ? prayerData.prayers.sunset : '06:00 PM'}</span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Fasting Times</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">Imsak (Suhoor End)</span>
                <span className="font-semibold text-gray-900 dark:text-white">{typeof prayerData?.prayers?.imsak === 'string' ? prayerData.prayers.imsak : '05:15 AM'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">Maghrib (Fast Break)</span>
                <span className="font-semibold text-gray-900 dark:text-white">{typeof prayerData?.prayers?.maghrib === 'string' ? prayerData.prayers.maghrib : '05:45 PM'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hijri Date Section */}
      <div className="bg-gradient-to-r from-green-500 to-blue-500 rounded-lg p-6 text-white">
        <div className="flex items-center gap-2 mb-3">
          <Clock size={20} />
          <h2 className="text-lg font-semibold">Islamic Calendar</h2>
        </div>
        <p className="text-sm opacity-90">
          {prayerData?.hijri_date || 'Loading Islamic date...'}
        </p>
        <p className="text-sm opacity-75 mt-2">Gregorian Date: {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>
    </div>
  )
}
