import { api } from './api';

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  fullName: string;
  avatar?: string;
  bio?: string;
  location: string;
  timezone: string;
  language: string;
  createdAt: string;
}

export interface UserPreferences {
  darkMode: boolean;
  arabicText: boolean;
  defaultView: string;
  emailNotifications: boolean;
  habitReminders: boolean;
  challengeUpdates: boolean;
  prayerReminders: boolean;
}

export interface UserStatistics {
  totalHabits: number;
  completedToday: number;
  totalCompleted: number;
  currentStreak: number;
  longestStreak: number;
  totalChallenges: number;
  challengesCompleted: number;
  achievementsEarned: number;
  totalPoints: number;
}

class UserService {
  // Get user profile
  async getUserProfile(): Promise<UserProfile> {
    try {
      const response = await api.get('/user/profile');
      return response.data;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      throw error;
    }
  }

  // Update user profile
  async updateUserProfile(profileData: Partial<UserProfile>): Promise<UserProfile> {
    try {
      const response = await api.put('/user/profile', profileData);
      return response.data;
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw error;
    }
  }

  // Upload user avatar
  async uploadAvatar(file: File): Promise<string> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await api.post('/user/avatar', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data.avatarUrl;
    } catch (error) {
      console.error('Error uploading avatar:', error);
      throw error;
    }
  }

  // Get user preferences
  async getUserPreferences(): Promise<UserPreferences> {
    try {
      const response = await api.get('/user/preferences');
      return response.data;
    } catch (error) {
      console.error('Error fetching user preferences:', error);
      throw error;
    }
  }

  // Update user preferences
  async updateUserPreferences(preferences: Partial<UserPreferences>): Promise<UserPreferences> {
    try {
      const response = await api.put('/user/preferences', preferences);
      return response.data;
    } catch (error) {
      console.error('Error updating user preferences:', error);
      throw error;
    }
  }

  // Get user statistics
  async getUserStatistics(): Promise<UserStatistics> {
    try {
      const response = await api.get('/user/statistics');
      return response.data;
    } catch (error) {
      console.error('Error fetching user statistics:', error);
      throw error;
    }
  }

  // Change password
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    try {
      await api.put('/user/password', {
        currentPassword,
        newPassword,
      });
    } catch (error) {
      console.error('Error changing password:', error);
      throw error;
    }
  }

  // Request email verification
  async requestEmailVerification(): Promise<void> {
    try {
      await api.post('/user/email/verify/request');
    } catch (error) {
      console.error('Error requesting email verification:', error);
      throw error;
    }
  }

  // Verify email
  async verifyEmail(code: string): Promise<void> {
    try {
      await api.post('/user/email/verify', { code });
    } catch (error) {
      console.error('Error verifying email:', error);
      throw error;
    }
  }

  // Delete account
  async deleteAccount(password: string): Promise<void> {
    try {
      await api.delete('/user/account', {
        data: { password },
      });
    } catch (error) {
      console.error('Error deleting account:', error);
      throw error;
    }
  }

  // Export user data
  async exportUserData(): Promise<Blob> {
    try {
      const response = await api.get('/user/export', {
        responseType: 'blob',
      });
      return response.data;
    } catch (error) {
      console.error('Error exporting user data:', error);
      throw error;
    }
  }

  // Get user's achievements
  async getUserAchievements(): Promise<any[]> {
    try {
      const response = await api.get('/user/achievements');
      return response.data;
    } catch (error) {
      console.error('Error fetching achievements:', error);
      throw error;
    }
  }

  // Get user's badges
  async getUserBadges(): Promise<any[]> {
    try {
      const response = await api.get('/user/badges');
      return response.data;
    } catch (error) {
      console.error('Error fetching badges:', error);
      throw error;
    }
  }

  // Get all sessions
  async getSessions(): Promise<any[]> {
    try {
      const response = await api.get('/user/sessions');
      return response.data;
    } catch (error) {
      console.error('Error fetching sessions:', error);
      throw error;
    }
  }

  // Logout from a specific session
  async logoutSession(sessionId: string): Promise<void> {
    try {
      await api.delete(`/user/sessions/${sessionId}`);
    } catch (error) {
      console.error('Error logging out session:', error);
      throw error;
    }
  }

  // Logout from all sessions
  async logoutAllSessions(): Promise<void> {
    try {
      await api.delete('/user/sessions');
    } catch (error) {
      console.error('Error logging out all sessions:', error);
      throw error;
    }
  }

  // Enable two-factor authentication
  async enableTwoFactor(): Promise<{ qrCode: string; backupCodes: string[] }> {
    try {
      const response = await api.post('/user/2fa/enable');
      return response.data;
    } catch (error) {
      console.error('Error enabling 2FA:', error);
      throw error;
    }
  }

  // Disable two-factor authentication
  async disableTwoFactor(code: string): Promise<void> {
    try {
      await api.post('/user/2fa/disable', { code });
    } catch (error) {
      console.error('Error disabling 2FA:', error);
      throw error;
    }
  }
}

export const userService = new UserService();
