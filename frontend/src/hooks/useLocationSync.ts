// ============================================================================
// useLocationSync
// ----------------------------------------------------------------------------
// Central hook for reacting to a location change originating from the global
// LocationPicker in the TopNav. All location-dependent pages register their
// React Query keys here so that picking a city in one place invalidates every
// relevant query across Calendar, Prayer Times, Prayer Tracker, Fasting and
// the Dashboard Hijri widget.
//
// Usage (in TopNav):
//   const syncLocation = useLocationSync()
//   <LocationPicker compact onLocationChange={syncLocation} />
// ============================================================================

import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import type { UserLocation } from '../services/prayerTimesService'

/**
 * Invalidate every React Query key that depends on the user's location.
 * Also writes the new location into the shared `['userLocation']` cache so
 * the Prayer Tracker (and any other reader) sees it immediately without
 * waiting for a refetch.
 */
export function useLocationSync() {
  const queryClient = useQueryClient()

  return useCallback(
    (loc: UserLocation) => {
      // 1. Seed the shared cache so readers get the new value instantly.
      queryClient.setQueryData(['userLocation'], loc)

      // 2. Invalidate all location-derived queries across the app.
      //    Calendar / Hijri widgets
      queryClient.invalidateQueries({ queryKey: ['hijri-today'] })
      queryClient.invalidateQueries({ queryKey: ['hijri-today-dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['islamic-events'] })

      //    Prayer Times (uses a compound key, so invalidate by prefix)
      queryClient.invalidateQueries({ queryKey: ['prayerTimes'] })

      //    Prayer Tracker
      queryClient.invalidateQueries({ queryKey: ['prayerTrackerToday'] })
      queryClient.invalidateQueries({ queryKey: ['prayerTrackerDay'] })
      queryClient.invalidateQueries({ queryKey: ['prayerTrackerWeek'] })
      queryClient.invalidateQueries({ queryKey: ['prayerTrackerMonth'] })
      queryClient.invalidateQueries({ queryKey: ['prayerStreaks'] })
      queryClient.invalidateQueries({ queryKey: ['prayerSummary'] })

      //    Fasting
      queryClient.invalidateQueries({ queryKey: ['fasting'] })

      //    Dashboard (may show location-aware cards)
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
    [queryClient],
  )
}