import { api } from './api';
import type { Task } from './taskService';

export enum EventCategory {
  HOLIDAY = 'holiday',
  BATTLE = 'battle',
  REVELATION = 'revelation',
  PROPHETIC = 'prophetic',
  COMPANION = 'companion',
  TREATY = 'treaty',
  SPECIAL = 'special',
}

export enum DatePrecision {
  EXACT = 'exact',
  MONTH_YEAR = 'month_year',
  YEAR_ONLY = 'year_only',
  APPROXIMATE = 'approximate',
}

export enum Authenticity {
  STRONG = 'strong',
  MODERATE = 'moderate',
  DISPUTED = 'disputed',
  WEAK = 'weak',
}

export interface IslamicEvent {
  id: number;
  title_en: string;
  title_bn?: string | null;
  hijri_month: number;
  hijri_day: number;
  hijri_year?: number | null;
  category: EventCategory;
  description_en?: string | null;
  description_bn?: string | null;
  full_story_en?: string | null;
  full_story_bn?: string | null;
  sources?: string | null;
  color_code: string;
  is_recurring: boolean;
  // v2 metadata
  location?: string | null;
  date_gregorian?: string | null;
  date_precision?: DatePrecision;
  primary_sources?: string[] | null;
  historical_sources?: string[] | null;
  scholarly_consensus?: boolean;
  authenticity?: Authenticity;
  notes?: string | null;
}

export interface IslamicEventCreate {
  title_en: string;
  title_bn?: string;
  hijri_month: number;
  hijri_day: number;
  hijri_year?: number;
  category: EventCategory;
  description_en?: string;
  description_bn?: string;
  full_story_en?: string;
  full_story_bn?: string;
  sources?: string;
  color_code?: string;
  is_recurring?: boolean;
  // v2 metadata
  location?: string;
  date_gregorian?: string;
  date_precision?: DatePrecision;
  primary_sources?: string[];
  historical_sources?: string[];
  scholarly_consensus?: boolean;
  authenticity?: Authenticity;
  notes?: string;
}

export interface IslamicEventUpdate {
  title_en?: string;
  title_bn?: string;
  hijri_month?: number;
  hijri_day?: number;
  hijri_year?: number;
  category?: EventCategory;
  description_en?: string;
  description_bn?: string;
  full_story_en?: string;
  full_story_bn?: string;
  sources?: string;
  color_code?: string;
  is_recurring?: boolean;
  // v2 metadata
  location?: string;
  date_gregorian?: string;
  date_precision?: DatePrecision;
  primary_sources?: string[];
  historical_sources?: string[];
  scholarly_consensus?: boolean;
  authenticity?: Authenticity;
  notes?: string;
}

/**
 * Color legend used in the Calendar UI to make the category immediately
 * recognizable in the legend chips and event pills. Values match the
 * backend's `EventCategory` enum.
 */
export const CATEGORY_META: Record<
  EventCategory,
  { label: string; color: string; description: string }
> = {
  [EventCategory.HOLIDAY]: {
    label: 'Holiday',
    color: '#059669',
    description: 'Major Islamic holidays and festive occasions',
  },
  [EventCategory.BATTLE]: {
    label: 'Battle',
    color: '#B91C1C',
    description: 'Major battles in Islamic history',
  },
  [EventCategory.REVELATION]: {
    label: 'Revelation',
    color: '#D97706',
    description: 'Moments of divine revelation',
  },
  [EventCategory.PROPHETIC]: {
    label: 'Prophetic',
    color: '#0EA5E9',
    description: 'Key events in the Prophets life',
  },
  [EventCategory.COMPANION]: {
    label: 'Companion',
    color: '#7C3AED',
    description: 'Notable Companions and biographical events',
  },
  [EventCategory.TREATY]: {
    label: 'Treaty',
    color: '#0F766E',
    description: 'Diplomatic agreements and constitutions',
  },
  [EventCategory.SPECIAL]: {
    label: 'Special',
    color: '#EAB308',
    description: 'Sacred months and special recommended days',
  },
};

class IslamicCalendarService {
  async listEvents(month?: number): Promise<IslamicEvent[]> {
    const response = await api.get('/islamic-calendar/events', {
      params: month === undefined ? undefined : { month },
    });
    return response.data;
  }

  async getEvent(id: number): Promise<IslamicEvent> {
    const response = await api.get(`/islamic-calendar/events/${id}`);
    return response.data;
  }

  /** Admin-only - backend returns 403 for non-admins. */
  async createEvent(payload: IslamicEventCreate): Promise<IslamicEvent> {
    const response = await api.post('/islamic-calendar/events', payload);
    return response.data;
  }

  /** Admin-only. */
  async updateEvent(
    id: number,
    payload: IslamicEventUpdate
  ): Promise<IslamicEvent> {
    const response = await api.put(`/islamic-calendar/events/${id}`, payload);
    return response.data;
  }

  /** Admin-only. */
  async deleteEvent(id: number): Promise<void> {
    await api.delete(`/islamic-calendar/events/${id}`);
  }
}

export const islamicCalendarService = new IslamicCalendarService();

export type { Task };