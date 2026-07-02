import { api } from './api';

export interface PrayerTime {
  name: string;
  time: string;
  athan?: string;
  iqamah?: string;
}

export interface DailyPrayerTimes {
  date: string;
  prayers: {
    fajr: string;
    dhuhr: string;
    asr: string;
    maghrib: string;
    isha: string;
    sunrise?: string;
    sunset?: string;
    imsak?: string;
  };
  hijri_date: string;
  /** Optional metadata about which basis/offset produced `hijri_date`.
   *  Surfaced by the backend on /prayer-times/today so the UI can show
   *  "per local committee" hints when applicable. */
  hijri_basis?: string;
  hijri_offset_applied?: number;
  location?: string;
}

export interface MonthlyPrayerTimes {
  month: number;
  year: number;
  days: DailyPrayerTimes[];
}

export interface IslamicCalendarEvent {
  date: string;
  event: string;
  hijriDate: string;
  description: string;
}

export interface ReverseGeocodeResult {
  city: string | null;
  country: string | null;
  display_name: string | null;
}

export interface UserLocation {
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

class PrayerTimesService {
  // Reverse-geocode lat/long to a city/country name
  async reverseGeocode(latitude: number, longitude: number): Promise<ReverseGeocodeResult> {
    const response = await api.get('/prayer-times/reverse-geocode', {
      params: { latitude, longitude },
    });
    return response.data;
  }

  // Get today's prayer times
  async getTodayPrayerTimes(): Promise<DailyPrayerTimes> {
    try {
      const response = await api.get('/prayer-times/today');
      return response.data;
    } catch (error) {
      console.error('Error fetching today prayer times:', error);
      throw error;
    }
  }

  // Get prayer times for a specific date
  async getPrayerTimesByDate(date: string): Promise<DailyPrayerTimes> {
    try {
      const response = await api.get(`/prayer-times/date/${date}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching prayer times for date:', error);
      throw error;
    }
  }

  // Get prayer times for a month
  async getMonthlyPrayerTimes(month: number, year: number): Promise<MonthlyPrayerTimes> {
    try {
      const response = await api.get('/prayer-times/monthly', {
        params: { month, year },
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching monthly prayer times:', error);
      throw error;
    }
  }

  // Get prayer times by location (latitude, longitude)
  async getPrayerTimesByLocation(latitude: number, longitude: number, date?: string): Promise<DailyPrayerTimes> {
    try {
      const response = await api.get('/prayer-times/location', {
        params: { latitude, longitude, date },
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching prayer times by location:', error);
      throw error;
    }
  }

  // Get prayer times by city name
  async getPrayerTimesByCity(city: string, country: string, date?: string): Promise<DailyPrayerTimes> {
    try {
      const response = await api.get('/prayer-times/city', {
        params: { city, country, date },
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching prayer times by city:', error);
      throw error;
    }
  }

  // Get Islamic calendar events
  async getIslamicCalendarEvents(month: number, year: number): Promise<IslamicCalendarEvent[]> {
    try {
      const response = await api.get('/islamic-calendar/events', {
        params: { month, year },
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching Islamic calendar events:', error);
      throw error;
    }
  }

  // Get specific Islamic event
  async getIslamicEvent(eventName: string): Promise<IslamicCalendarEvent> {
    try {
      const response = await api.get(`/islamic-calendar/events/${eventName}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching Islamic event:', error);
      throw error;
    }
  }

  // Set user's prayer location
  async setUserLocation(location: UserLocation): Promise<UserLocation> {
    try {
      const response = await api.post('/user/location', location);
      return response.data;
    } catch (error) {
      console.error('Error setting user location:', error);
      throw error;
    }
  }

  // Get user's prayer location
  async getUserLocation(): Promise<UserLocation> {
    try {
      const response = await api.get('/user/location');
      return response.data;
    } catch (error) {
      console.error('Error fetching user location:', error);
      throw error;
    }
  }

  // Get next prayer
  async getNextPrayer(): Promise<{ name: string; time: string; minutesRemaining: number }> {
    try {
      const response = await api.get('/prayer-times/next');
      return response.data;
    } catch (error) {
      console.error('Error fetching next prayer:', error);
      throw error;
    }
  }

  // Get prayer notification status
  async getPrayerNotificationStatus(): Promise<{ [key: string]: boolean }> {
    try {
      const response = await api.get('/prayer-times/notifications/status');
      return response.data;
    } catch (error) {
      console.error('Error fetching notification status:', error);
      throw error;
    }
  }

  // Update prayer notification settings
  async updatePrayerNotifications(settings: { [key: string]: boolean }): Promise<void> {
    try {
      await api.post('/prayer-times/notifications/settings', settings);
    } catch (error) {
      console.error('Error updating prayer notifications:', error);
      throw error;
    }
  }

  // Get Islamic date for today
  async getTodayIslamicDate(): Promise<{ hijri: string; gregorian: string }> {
    try {
      const response = await api.get('/prayer-times/islamic-date');
      return { hijri: response.data.hijri_date, gregorian: response.data.gregorian_date };
    } catch (error) {
      console.error('Error fetching Islamic date:', error);
      throw error;
    }
  }

  // Get Islamic date for a specific date
  async getIslamicDate(date: string): Promise<{ hijri: string; gregorian: string }> {
    try {
      const response = await api.get('/prayer-times/islamic-date', { params: { target_date: date } });
      return { hijri: response.data.hijri_date, gregorian: response.data.gregorian_date };
    } catch (error) {
      console.error('Error fetching Islamic date:', error);
      throw error;
    }
  }
}

export const prayerTimesService = new PrayerTimesService();
