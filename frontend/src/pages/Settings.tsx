import React, { useState } from 'react';
import { Settings, User, Bell, MapPin, Lock, LogOut, Save, X } from 'lucide-react';
import { Button, Input, Select } from '../components/Form';
import { useAuthStore } from '../store/authStore';

interface UserSettings {
  email: string;
  username: string;
  fullName: string;
  location: string;
  timezone: string;
  language: string;
  notifications: {
    emailNotifications: boolean;
    habitReminders: boolean;
    challengeUpdates: boolean;
    prayerReminders: boolean;
  };
  preferences: {
    darkMode: boolean;
    arabicText: boolean;
    defaultView: string;
  };
}

export const UserSettings: React.FC = () => {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'profile' | 'notifications' | 'preferences' | 'security'>('profile');
  const [isSaving, setIsSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const [settings, setSettings] = useState<UserSettings>({
    email: user?.email || 'user@example.com',
    username: user?.username || 'username',
    fullName: user?.full_name || 'Full Name',
    location: 'Cairo, Egypt',
    timezone: 'Africa/Cairo',
    language: 'en',
    notifications: {
      emailNotifications: true,
      habitReminders: true,
      challengeUpdates: true,
      prayerReminders: true,
    },
    preferences: {
      darkMode: true,
      arabicText: true,
      defaultView: 'daily',
    },
  });

  const handleInputChange = (field: keyof Omit<UserSettings, 'notifications' | 'preferences'>, value: string) => {
    setSettings({ ...settings, [field]: value });
  };

  const handleNotificationChange = (field: keyof UserSettings['notifications']) => {
    setSettings({
      ...settings,
      notifications: {
        ...settings.notifications,
        [field]: !settings.notifications[field],
      },
    });
  };

  const handlePreferenceChange = (field: keyof UserSettings['preferences'], value: boolean | string) => {
    setSettings({
      ...settings,
      preferences: {
        ...settings.preferences,
        [field]: value,
      },
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setSuccessMessage('Settings saved successfully!');
      setEditMode(false);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      setErrorMessage('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const tabs = [
    { id: 'profile' as const, label: 'Profile', icon: User },
    { id: 'notifications' as const, label: 'Notifications', icon: Bell },
    { id: 'preferences' as const, label: 'Preferences', icon: Settings },
    { id: 'security' as const, label: 'Security', icon: Lock },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-6">
            <Settings className="w-8 h-8 text-emerald-400" />
            <h1 className="text-4xl font-bold">Settings</h1>
          </div>

          {successMessage && (
            <div className="p-4 bg-emerald-900/30 border border-emerald-500 rounded-lg text-emerald-300 flex justify-between items-center mb-4">
              <span>{successMessage}</span>
              <button onClick={() => setSuccessMessage('')}>
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {errorMessage && (
            <div className="p-4 bg-red-900/30 border border-red-500 rounded-lg text-red-300 flex justify-between items-center mb-4">
              <span>{errorMessage}</span>
              <button onClick={() => setErrorMessage('')}>
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition whitespace-nowrap ${
                activeTab === id
                  ? 'bg-emerald-500 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="bg-slate-800 rounded-lg p-8 shadow-xl">
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Profile Information</h2>
                {!editMode && (
                  <Button onClick={() => setEditMode(true)} variant="primary">
                    Edit Profile
                  </Button>
                )}
              </div>

              {editMode && (
                <div className="space-y-4">
                  <Input
                    label="Full Name"
                    type="text"
                    value={settings.fullName}
                    onChange={(e) => handleInputChange('fullName', e.target.value)}
                  />
                  <Input
                    label="Username"
                    type="text"
                    value={settings.username}
                    onChange={(e) => handleInputChange('username', e.target.value)}
                  />
                  <Input
                    label="Email"
                    type="email"
                    value={settings.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                  />
                  <div className="flex gap-2 items-center">
                    <MapPin className="w-5 h-5 text-slate-400" />
                    <Input
                      label="Location"
                      type="text"
                      placeholder="City, Country"
                      value={settings.location}
                      onChange={(e) => handleInputChange('location', e.target.value)}
                    />
                  </div>
                  <Select
                    label="Timezone"
                    value={settings.timezone}
                    onChange={(e) => handleInputChange('timezone', e.target.value)}
                    options={[
                      { value: 'Africa/Cairo', label: 'Cairo (Egypt)' },
                      { value: 'Asia/Dubai', label: 'Dubai (UAE)' },
                      { value: 'Asia/Riyadh', label: 'Riyadh (Saudi Arabia)' },
                      { value: 'Europe/London', label: 'London (UK)' },
                      { value: 'America/New_York', label: 'New York (USA)' },
                    ]}
                  />
                  <Select
                    label="Language"
                    value={settings.language}
                    onChange={(e) => handleInputChange('language', e.target.value)}
                    options={[
                      { value: 'en', label: 'English' },
                      { value: 'ar', label: 'العربية' },
                      { value: 'fr', label: 'Français' },
                    ]}
                  />

                  <div className="flex gap-3 pt-4">
                    <Button onClick={handleSave} variant="primary" disabled={isSaving} className="flex items-center gap-2">
                      <Save className="w-4 h-4" />
                      {isSaving ? 'Saving...' : 'Save Changes'}
                    </Button>
                    <Button
                      onClick={() => setEditMode(false)}
                      variant="secondary"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {!editMode && (
                <div className="space-y-4">
                  <div className="p-4 bg-slate-700 rounded-lg">
                    <div className="text-sm text-slate-400 mb-1">Full Name</div>
                    <div className="font-semibold">{settings.fullName}</div>
                  </div>
                  <div className="p-4 bg-slate-700 rounded-lg">
                    <div className="text-sm text-slate-400 mb-1">Username</div>
                    <div className="font-semibold">{settings.username}</div>
                  </div>
                  <div className="p-4 bg-slate-700 rounded-lg">
                    <div className="text-sm text-slate-400 mb-1">Email</div>
                    <div className="font-semibold">{settings.email}</div>
                  </div>
                  <div className="p-4 bg-slate-700 rounded-lg">
                    <div className="text-sm text-slate-400 mb-1">Location</div>
                    <div className="font-semibold flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      {settings.location}
                    </div>
                  </div>
                  <div className="p-4 bg-slate-700 rounded-lg">
                    <div className="text-sm text-slate-400 mb-1">Timezone</div>
                    <div className="font-semibold">{settings.timezone}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">Notification Preferences</h2>

              <div className="space-y-4">
                <div className="p-4 bg-slate-700 rounded-lg flex items-center justify-between">
                  <div>
                    <div className="font-semibold">Email Notifications</div>
                    <div className="text-sm text-slate-400">Receive updates via email</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.notifications.emailNotifications}
                    onChange={() => handleNotificationChange('emailNotifications')}
                    className="w-5 h-5 cursor-pointer"
                  />
                </div>

                <div className="p-4 bg-slate-700 rounded-lg flex items-center justify-between">
                  <div>
                    <div className="font-semibold">Habit Reminders</div>
                    <div className="text-sm text-slate-400">Get reminded about daily habits</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.notifications.habitReminders}
                    onChange={() => handleNotificationChange('habitReminders')}
                    className="w-5 h-5 cursor-pointer"
                  />
                </div>

                <div className="p-4 bg-slate-700 rounded-lg flex items-center justify-between">
                  <div>
                    <div className="font-semibold">Challenge Updates</div>
                    <div className="text-sm text-slate-400">Updates on challenges you\'re participating in</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.notifications.challengeUpdates}
                    onChange={() => handleNotificationChange('challengeUpdates')}
                    className="w-5 h-5 cursor-pointer"
                  />
                </div>

                <div className="p-4 bg-slate-700 rounded-lg flex items-center justify-between">
                  <div>
                    <div className="font-semibold">Prayer Reminders</div>
                    <div className="text-sm text-slate-400">Reminders for prayer times</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.notifications.prayerReminders}
                    onChange={() => handleNotificationChange('prayerReminders')}
                    className="w-5 h-5 cursor-pointer"
                  />
                </div>
              </div>

              <Button onClick={handleSave} variant="primary" className="flex items-center gap-2">
                <Save className="w-4 h-4" />
                Save Preferences
              </Button>
            </div>
          )}

          {activeTab === 'preferences' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">App Preferences</h2>

              <div className="space-y-4">
                <div className="p-4 bg-slate-700 rounded-lg flex items-center justify-between">
                  <div>
                    <div className="font-semibold">Dark Mode</div>
                    <div className="text-sm text-slate-400">Use dark theme throughout app</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.preferences.darkMode}
                    onChange={(e) => handlePreferenceChange('darkMode', e.target.checked)}
                    className="w-5 h-5 cursor-pointer"
                  />
                </div>

                <div className="p-4 bg-slate-700 rounded-lg flex items-center justify-between">
                  <div>
                    <div className="font-semibold">Arabic Text</div>
                    <div className="text-sm text-slate-400">Display Arabic text and translations</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.preferences.arabicText}
                    onChange={(e) => handlePreferenceChange('arabicText', e.target.checked)}
                    className="w-5 h-5 cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">Default View</label>
                  <Select
                    value={settings.preferences.defaultView}
                    onChange={(e) => handlePreferenceChange('defaultView', e.target.value)}
                    options={[
                      { value: 'daily', label: 'Daily View' },
                      { value: 'weekly', label: 'Weekly View' },
                      { value: 'monthly', label: 'Monthly View' },
                    ]}
                  />
                </div>
              </div>

              <Button onClick={handleSave} variant="primary" className="flex items-center gap-2">
                <Save className="w-4 h-4" />
                Save Preferences
              </Button>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">Security</h2>

              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    Change Password
                  </h3>
                  <div className="space-y-3">
                    <Input
                      label="Current Password"
                      type="password"
                      placeholder="Enter current password"
                    />
                    <Input
                      label="New Password"
                      type="password"
                      placeholder="Enter new password"
                    />
                    <Input
                      label="Confirm Password"
                      type="password"
                      placeholder="Confirm new password"
                    />
                    <Button variant="primary">Update Password</Button>
                  </div>
                </div>

                <div className="border-t border-slate-700 pt-6">
                  <h3 className="font-semibold mb-3">Sessions</h3>
                  <div className="p-4 bg-slate-700 rounded-lg flex justify-between items-center">
                    <div>
                      <div className="font-semibold">Current Session</div>
                      <div className="text-sm text-slate-400">Windows PC - Cairo, Egypt</div>
                      <div className="text-xs text-slate-500 mt-1">Last active: 2 minutes ago</div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-700 pt-6">
                  <Button variant="secondary" className="flex items-center gap-2 text-red-400 hover:text-red-300">
                    <LogOut className="w-4 h-4" />
                    Logout
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
