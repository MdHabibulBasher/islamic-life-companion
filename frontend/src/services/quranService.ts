import { api } from './api';

export interface Surah {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation?: string;
  numberOfAyahs: number;
  revelationType: string;
}

export interface Ayah {
  number: number;
  text: string;
  numberInSurah: number;
  juz?: number;
  page?: number;
  translation?: string | null;
  bengali?: string | null;
}

export interface SurahWithAyahs {
  surah_number: number;
  surah_name: string;
  english_name: string;
  revelation_type: string;
  number_of_ayahs: number;
  ayahs: Ayah[];
}

export interface QuranReadingSession {
  id: string;
  surahNumber: number;
  ayahNumber: number;
  timestamp: string;
  duration: number;
}

export interface QuranBookmark {
  id: string;
  surahNumber: number;
  ayahNumber: number;
  createdAt: string;
}

export interface QuranProgress {
  totalSurahsRead: number;
  totalAyahsRead: number;
  currentSurah: number;
  currentAyah: number;
  lastReadDate: string;
  readingStreak: number;
}

class QuranService {
  // Fetch all Surahs
  async getSurahs(): Promise<Surah[]> {
    try {
      const response = await api.get('/quran/surahs');
      return response.data;
    } catch (error) {
      console.error('Error fetching Surahs:', error);
      throw error;
    }
  }

  // Fetch a specific Surah's Ayahs (returns the full payload incl. EN + BN translations)
  async getSurahAyahs(surahNumber: number): Promise<SurahWithAyahs> {
    const response = await api.get(`/quran/surahs/${surahNumber}/ayahs`)
    return response.data
  }

  // Fetch a specific Ayah
  async getAyah(surahNumber: number, ayahNumber: number): Promise<Ayah> {
    try {
      const response = await api.get(`/quran/surahs/${surahNumber}/ayahs/${ayahNumber}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching Ayah:', error);
      throw error;
    }
  }

  // Get user's reading progress
  async getReadingProgress(): Promise<QuranProgress> {
    try {
      const response = await api.get('/quran/progress');
      return response.data;
    } catch (error) {
      console.error('Error fetching reading progress:', error);
      throw error;
    }
  }

  // Log a reading session
  async logReadingSession(surahNumber: number, ayahNumber: number, duration: number): Promise<QuranReadingSession> {
    try {
      const response = await api.post('/quran/sessions', {
        surahNumber,
        ayahNumber,
        duration,
      });
      return response.data;
    } catch (error) {
      console.error('Error logging reading session:', error);
      throw error;
    }
  }

  // Get user's bookmarks
  async getBookmarks(): Promise<QuranBookmark[]> {
    try {
      const response = await api.get('/quran/bookmarks');
      return response.data;
    } catch (error) {
      console.error('Error fetching bookmarks:', error);
      throw error;
    }
  }

  // Add a bookmark
  async addBookmark(surahNumber: number, ayahNumber: number): Promise<QuranBookmark> {
    try {
      const response = await api.post('/quran/bookmarks', {
        surahNumber,
        ayahNumber,
      });
      return response.data;
    } catch (error) {
      console.error('Error adding bookmark:', error);
      throw error;
    }
  }

  // Remove a bookmark
  async removeBookmark(bookmarkId: string): Promise<void> {
    try {
      await api.delete(`/quran/bookmarks/${bookmarkId}`);
    } catch (error) {
      console.error('Error removing bookmark:', error);
      throw error;
    }
  }

  // Get Ayah translation
  async getAyahTranslation(surahNumber: number, ayahNumber: number, language: string = 'en'): Promise<string> {
    try {
      const response = await api.get(`/quran/surahs/${surahNumber}/ayahs/${ayahNumber}/translation`, {
        params: { language },
      });
      return response.data.translation;
    } catch (error) {
      console.error('Error fetching translation:', error);
      throw error;
    }
  }

  // Get Ayah tafsir (interpretation)
  async getAyahTafsir(surahNumber: number, ayahNumber: number): Promise<string> {
    try {
      const response = await api.get(`/quran/surahs/${surahNumber}/ayahs/${ayahNumber}/tafsir`);
      return response.data.tafsir;
    } catch (error) {
      console.error('Error fetching tafsir:', error);
      throw error;
    }
  }

  // Search Quran
  async searchQuran(query: string): Promise<Ayah[]> {
    try {
      const response = await api.get('/quran/search', {
        params: { q: query },
      });
      return response.data;
    } catch (error) {
      console.error('Error searching Quran:', error);
      throw error;
    }
  }

  // Get Ayah audio URL
  async getAyahAudio(surahNumber: number, ayahNumber: number, reciter: string = 'default'): Promise<string> {
    try {
      const response = await api.get(`/quran/surahs/${surahNumber}/ayahs/${ayahNumber}/audio`, {
        params: { reciter },
      });
      return response.data.audioUrl;
    } catch (error) {
      console.error('Error getting audio:', error);
      throw error;
    }
  }

  // Get available reciters
  async getReciters(): Promise<any[]> {
    try {
      const response = await api.get('/quran/reciters');
      return response.data;
    } catch (error) {
      console.error('Error fetching reciters:', error);
      throw error;
    }
  }
}

export const quranService = new QuranService();
