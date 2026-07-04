import { api } from './api'

export enum PrayerName {
  FAJR = 'fajr',
  DHUHR = 'dhuhr',
  ASR = 'asr',
  MAGHRIB = 'maghrib',
  ISHA = 'isha',
}

export const PRAYER_ORDER: PrayerName[] = [
  PrayerName.FAJR,
  PrayerName.DHUHR,
  PrayerName.ASR,
  PrayerName.MAGHRIB,
  PrayerName.ISHA,
]

export enum CalculationMethod {
  ISNA = 'isna',
  MWL = 'mwl',
  EGYPT = 'egypt',
  KARACHI = 'karachi',
  MAKKAH = 'makkah',
  CUSTOM = 'custom',
}

export enum JuristicMethod {
  SHAFI = 'shafi',
  HANAFI = 'hanafi',
}

export interface PrayerTracking {
  id: number
  user_id: number
  prayer_name: PrayerName
  tracking_date: string
  is_completed: boolean
  completed_at?: string | null
  is_jamaaah: boolean
  notes?: string | null
  created_at: string
  updated_at?: string | null
}

export interface DayPrayerStatus {
  prayer_name: PrayerName
  scheduled_time?: string | null
  is_completed: boolean
  completed_at?: string | null
  is_jamaaah: boolean
  notes?: string | null
}

export interface DayTrackingResponse {
  date: string
  prayers: DayPrayerStatus[]
  completed_count: number
  is_full_day: boolean
  /** HH:MM — bounds the end of the Fajr prayer window. */
  sunrise?: string | null
  /** HH:MM — bounds the end of the Isha prayer window. */
  midnight?: string | null
}

export interface PrayerStreak {
  prayer_name: string
  current_streak: number
  longest_streak: number
  last_completed_date?: string | null
  badges: string[]
}

export interface AllStreaksResponse {
  streaks: PrayerStreak[]
}

export interface PrayerQada {
  prayer_name: PrayerName
  owed_count: number
  made_up_count: number
}

export interface AllQadaResponse {
  qada: PrayerQada[]
  total_owed: number
  total_made_up: number
}

export interface PrayerSettings {
  id: number
  user_id: number
  calculation_method: CalculationMethod
  juristic_method: JuristicMethod
  notifications_enabled: boolean
  reminder_minutes_before: number
  track_jamaaah: boolean
  track_qada: boolean
  created_at: string
  updated_at?: string | null
}

export interface PrayerSettingsUpdate {
  calculation_method?: CalculationMethod
  juristic_method?: JuristicMethod
  notifications_enabled?: boolean
  reminder_minutes_before?: number
  track_jamaaah?: boolean
  track_qada?: boolean
}

export interface PrayerStatistics {
  total_tracked: number
  total_completed: number
  overall_completion_rate: number
  best_prayer_name?: string | null
  worst_prayer_name?: string | null
  last_30_days_rate: number
  streaks: PrayerStreak[]
  qada: PrayerQada[]
}

export interface CreateTrackingData {
  prayer_name: PrayerName
  tracking_date: string
  is_completed: boolean
  is_jamaaah?: boolean
  notes?: string | null
}

export interface QadaAdjustData {
  prayer_name: PrayerName
  delta: number
  /** Calendar date the adjustment is FOR (the missed/made-up prayer
   *  date). Optional; backend defaults to today. */
  tracking_date?: string
}

class PrayerTrackingService {
  /** GET /prayer-tracking/today?city=&country= */
  async getToday(city?: string, country?: string): Promise<DayTrackingResponse> {
    const r = await api.get<DayTrackingResponse>('/prayer-tracking/today', {
      params: { city, country },
    })
    return r.data
  }

  /** GET /prayer-tracking/day/{date}?city=&country= */
  async getDay(date: string, city?: string, country?: string): Promise<DayTrackingResponse> {
    const r = await api.get<DayTrackingResponse>(`/prayer-tracking/day/${date}`, {
      params: { city, country },
    })
    return r.data
  }

  /** GET /prayer-tracking/week */
  async getWeek(endDate?: string): Promise<DayTrackingResponse[]> {
    const r = await api.get<DayTrackingResponse[]>('/prayer-tracking/week', {
      params: endDate ? { end_date: endDate } : undefined,
    })
    return r.data
  }

  /** GET /prayer-tracking/month/{year}/{month} */
  async getMonth(year: number, month: number): Promise<DayTrackingResponse[]> {
    const r = await api.get<DayTrackingResponse[]>(
      `/prayer-tracking/month/${year}/${month}`,
    )
    return r.data
  }

  /** GET /prayer-tracking/summary?start=&end= */
  async getSummary(start: string, end: string) {
    const r = await api.get('/prayer-tracking/summary', {
      params: { start, end },
    })
    return r.data as {
      start: string
      end: string
      days_in_range: number
      days_tracked: number
      prayed: number
      missed: number
      full_days: number
      per_prayer: Array<{ prayer_name: PrayerName; prayed: number; missed: number }>
    }
  }

  /** GET /prayer-tracking/qada/history?start=&end= */
  async getQadaHistory(start?: string, end?: string) {
    const r = await api.get('/prayer-tracking/qada/history', {
      params: { start, end },
    })
    return r.data as {
      items: Array<{
        prayer_name: PrayerName
        net_delta: number
        made_up: number
        added: number
      }>
      total_made_up: number
      total_added: number
    }
  }

  /** GET /prayer-tracking/qada/stats?start=&end= */
  async getQadaStats(start?: string, end?: string) {
    const r = await api.get('/prayer-tracking/qada/stats', {
      params: { start, end },
    })
    return r.data as {
      start?: string | null
      end?: string | null
      items: Array<{
        prayer_name: PrayerName
        added_in_range: number
        made_up_in_range: number
        net_in_range: number
        owed_now: number
        made_up_now: number
      }>
      total_added_in_range: number
      total_made_up_in_range: number
      total_net_in_range: number
      total_owed_now: number
      total_made_up_now: number
    }
  }

  /** POST /prayer-tracking/track */
  async upsertTracking(payload: CreateTrackingData): Promise<PrayerTracking> {
    const r = await api.post<PrayerTracking>('/prayer-tracking/track', payload)
    return r.data
  }

  /** PATCH /prayer-tracking/track/{id} */
  async patchTracking(
    id: number,
    payload: Partial<CreateTrackingData>,
  ): Promise<PrayerTracking> {
    const r = await api.patch<PrayerTracking>(`/prayer-tracking/track/${id}`, payload)
    return r.data
  }

  /** DELETE /prayer-tracking/track/{id} */
  async deleteTracking(id: number): Promise<void> {
    await api.delete(`/prayer-tracking/track/${id}`)
  }

  /** GET /prayer-tracking/streaks */
  async getStreaks(): Promise<AllStreaksResponse> {
    const r = await api.get<AllStreaksResponse>('/prayer-tracking/streaks')
    return r.data
  }

  /** POST /prayer-tracking/streaks/recompute */
  async recomputeStreaks(): Promise<AllStreaksResponse> {
    const r = await api.post<AllStreaksResponse>('/prayer-tracking/streaks/recompute')
    return r.data
  }

  /** GET /prayer-tracking/qada */
  async getQada(): Promise<AllQadaResponse> {
    const r = await api.get<AllQadaResponse>('/prayer-tracking/qada')
    return r.data
  }

  /** POST /prayer-tracking/qada/adjust */
  async adjustQada(payload: QadaAdjustData): Promise<PrayerQada> {
    const r = await api.post<PrayerQada>('/prayer-tracking/qada/adjust', payload)
    return r.data
  }

  /** GET /prayer-tracking/qada/entries?start=&end= */
  async getQadaEntries(start?: string, end?: string) {
    const r = await api.get('/prayer-tracking/qada/entries', {
      params: { start, end },
    })
    return r.data as {
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
    }
  }

  /** GET /prayer-tracking/settings */
  async getSettings(): Promise<PrayerSettings> {
    const r = await api.get<PrayerSettings>('/prayer-tracking/settings')
    return r.data
  }

  /** PUT /prayer-tracking/settings */
  async updateSettings(payload: PrayerSettingsUpdate): Promise<PrayerSettings> {
    const r = await api.put<PrayerSettings>('/prayer-tracking/settings', payload)
    return r.data
  }

  /** GET /prayer-tracking/statistics */
  async getStatistics(): Promise<PrayerStatistics> {
    const r = await api.get<PrayerStatistics>('/prayer-tracking/statistics')
    return r.data
  }

  /** GET /prayer-tracking/export.csv — returns the raw text */
  async exportCsv(start?: string, end?: string): Promise<string> {
    const r = await api.get<string>('/prayer-tracking/export.csv', {
      params: { start, end },
      responseType: 'text',
    })
    return r.data
  }
}

export const prayerTrackingService = new PrayerTrackingService()
