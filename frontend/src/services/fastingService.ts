// Fasting service — wraps the /api/v1/fasting/* REST endpoints.
//
// The page keeps a Hijri-month window of entries in cache and uses
// upserts (POST) for the calendar's click-to-mark flow. The service
// hides the query-string wiring so the page stays clean.
import { api } from './api'

export interface FastingEntry {
  id: number
  user_id: number
  date: string // ISO YYYY-MM-DD
  hijri_date: string | null
  hijri_day: number | null
  hijri_month: number | null
  hijri_year: number | null
  hijri_month_name: string | null
  fasted: boolean
  is_ramadan: boolean
  is_monday_thursday: boolean
  is_white_day: boolean
  donation_amount: number | null
  donation_currency: string | null
  donation_note: string | null
  good_deed: string | null
  good_deed_done: boolean | null
  notes: string | null
  created_at: string
  updated_at: string | null
}

export interface FastingMonthSummary {
  hijri_year: number
  hijri_month: number
  hijri_month_name: string
  gregorian_start: string
  gregorian_end: string
  total_days: number
  fasted_days: number
  ramadan_days: number
  sunnah_days: number
  white_days: number
  total_donations: number
  good_deeds_done: number
}

export interface FastingUpsert {
  // The backend schema renames the field to `tracking_date` to avoid a
  // Pydantic 2.12 name-clash with the `datetime.date` type. Sending
  // `tracking_date` here keeps the wire format aligned with the API.
  tracking_date: string
  fasted?: boolean
  notes?: string | null
  donation_amount?: number | null
  donation_currency?: string | null
  donation_note?: string | null
  good_deed?: string | null
  good_deed_done?: boolean | null
}

export interface FastingPatch {
  fasted?: boolean
  notes?: string | null
  donation_amount?: number | null
  donation_currency?: string | null
  donation_note?: string | null
  good_deed?: string | null
  good_deed_done?: boolean | null
}

const base = '/fasting'

export const fastingService = {
  list: async (startDate?: string, endDate?: string): Promise<FastingEntry[]> => {
    const params: Record<string, string> = {}
    if (startDate) params.start_date = startDate
    if (endDate) params.end_date = endDate
    const r = await api.get<FastingEntry[]>(`${base}/`, { params })
    return r.data
  },

  listByHijriMonth: async (hijriYear: number, hijriMonth: number): Promise<FastingEntry[]> => {
    const r = await api.get<FastingEntry[]>(`${base}/month`, {
      params: { hijri_year: hijriYear, hijri_month: hijriMonth },
    })
    return r.data
  },

  monthSummary: async (hijriYear: number, hijriMonth: number): Promise<FastingMonthSummary> => {
    const r = await api.get<FastingMonthSummary>(`${base}/summary`, {
      params: { hijri_year: hijriYear, hijri_month: hijriMonth },
    })
    return r.data
  },

  upsert: async (payload: FastingUpsert): Promise<FastingEntry> => {
    const r = await api.post<FastingEntry>(`${base}/`, payload)
    return r.data
  },

  patch: async (id: number, payload: FastingPatch): Promise<FastingEntry> => {
    const r = await api.patch<FastingEntry>(`${base}/${id}`, payload)
    return r.data
  },

  remove: async (id: number): Promise<void> => {
    await api.delete(`${base}/${id}`)
  },
}
