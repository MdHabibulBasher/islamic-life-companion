import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Settings as SettingsIcon,
  User,
  Bell,
  MapPin,
  Lock,
  LogOut,
  Save,
  AlertCircle,
  Eye,
  EyeOff,
  Info,
  Palette,
} from 'lucide-react'
import { Button, Input, Select } from '../components/Form'
import { useAuthStore } from '../store/authStore'
import { api } from '../services/api'
import { useToast } from '../components/Toast'
import { ThemeSwitcher } from '../components/ThemeSwitcher'
import { useTheme } from '../contexts/ThemeContext'
import {
  OrnateCard,
  PageHeader,
  GoldDivider,
} from '../components/IslamicOrnamentBG'

interface UserProfile {
  id: number
  email: string
  username: string | null
  full_name: string | null
  avatar_url: string | null
  bio: string | null
  location: string | null
  timezone: string | null
  language: string | null
  is_active: boolean
}

// Local Hijri-calculation basis options. Keep in sync with the backend's
// `HIJRI_BASIS_ALADHAN_METHOD` in `app/services/hijri.py`.
const HIJRI_BASIS_OPTIONS = [
  { value: 'global', label: 'Global default (Aladhan)' },
  { value: 'umm_al_qura', label: 'Umm al-Qura (Saudi Arabia)' },
  { value: 'isna', label: 'ISNA (North America)' },
  { value: 'mwl', label: 'Muslim World League' },
  { value: 'egyptian', label: 'Egyptian General Authority' },
  { value: 'karachi', label: 'Karachi' },
  { value: 'tehran', label: 'Tehran (Shia)' },
  { value: 'jafari', label: 'Jafari (Shia Ithna Ashari)' },
]

interface UserPreferences {
  dark_mode: boolean
  arabic_text: boolean
  default_view: string
  email_notifications: boolean
  habit_reminders: boolean
  challenge_updates: boolean
  prayer_reminders: boolean
  hijri_basis: string
  hijri_offset: number
}

type Tab = 'profile' | 'notifications' | 'preferences' | 'appearance' | 'security'

export const UserSettings: React.FC = () => {
  const queryClient = useQueryClient()
  const { user, setUser, setAuthenticated, logout } = useAuthStore()
  const { success, error: showError } = useToast()

  const [activeTab, setActiveTab] = useState<Tab>('profile')
  const [editMode, setEditMode] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [prefs, setPrefs] = useState<UserPreferences | null>(null)

  // Password change form
  const [showCurrentPw, setShowCurrentPw] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')

  const profileQuery = useQuery<UserProfile>({
    queryKey: ['user-profile'],
    queryFn: async () => (await api.get('/user/profile')).data,
  })

  const prefsQuery = useQuery<UserPreferences>({
    queryKey: ['user-preferences'],
    queryFn: async () => (await api.get('/user/preferences')).data,
  })

  useEffect(() => {
    if (profileQuery.data) setProfile(profileQuery.data)
  }, [profileQuery.data])

  useEffect(() => {
    if (prefsQuery.data) setPrefs(prefsQuery.data)
  }, [prefsQuery.data])

  const updateProfileMutation = useMutation({
    mutationFn: async (payload: Partial<UserProfile>) =>
      (await api.put('/user/profile', payload)).data,
    onSuccess: (data: UserProfile) => {
      queryClient.invalidateQueries({ queryKey: ['user-profile'] })
      setProfile(data)
      if (user) {
        setUser({
          ...user,
          full_name: data.full_name ?? undefined,
          email: data.email,
        })
      }
      success('Profile updated')
      setEditMode(false)
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      showError(err?.response?.data?.detail ?? 'Failed to update profile')
    },
  })

  const updatePrefsMutation = useMutation({
    mutationFn: async (payload: Partial<UserPreferences>) =>
      (await api.put('/user/preferences', payload)).data,
    onSuccess: (data: UserPreferences) => {
      queryClient.invalidateQueries({ queryKey: ['user-preferences'] })
      setPrefs(data)
      success('Preferences updated')
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      showError(err?.response?.data?.detail ?? 'Failed to update preferences')
    },
  })

  const changePasswordMutation = useMutation({
    mutationFn: async (payload: { current_password: string; new_password: string }) =>
      (await api.put('/user/password', payload)).data,
    onSuccess: () => {
      success('Password updated')
      setCurrentPw('')
      setNewPw('')
      setConfirmPw('')
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      showError(err?.response?.data?.detail ?? 'Failed to change password')
    },
  })

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await api.post('/auth/logout')
    },
    onSettled: () => {
      logout()
      setAuthenticated(false)
    },
  })

  const handleProfileChange = (field: keyof UserProfile, value: string) => {
    if (!profile) return
    setProfile({ ...profile, [field]: value })
  }

  const handlePrefToggle = (
    field: keyof UserPreferences,
    immediate = false,
  ) => {
    if (!prefs) return
    const updated = { ...prefs, [field]: !prefs[field] }
    setPrefs(updated)
    if (immediate) {
      updatePrefsMutation.mutate({ [field]: updated[field] })
    }
  }

  const handleSaveProfile = async () => {
    if (!profile) return
    setIsSaving(true)
    try {
      await updateProfileMutation.mutateAsync({
        full_name: profile.full_name ?? undefined,
        username: profile.username ?? undefined,
        location: profile.location ?? undefined,
        timezone: profile.timezone ?? undefined,
        language: profile.language ?? undefined,
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleSavePrefs = () => {
    if (!prefs) return
    updatePrefsMutation.mutate({
      default_view: prefs.default_view,
      arabic_text: prefs.arabic_text,
      hijri_basis: prefs.hijri_basis,
      hijri_offset: prefs.hijri_offset,
    })
  }

  const handleChangePassword = () => {
    if (!currentPw || !newPw) {
      showError('Please fill in both password fields')
      return
    }
    if (newPw !== confirmPw) {
      showError('New passwords do not match')
      return
    }
    if (newPw.length < 8) {
      showError('New password must be at least 8 characters')
      return
    }
    changePasswordMutation.mutate({ current_password: currentPw, new_password: newPw })
  }

  const tabs: { id: Tab; label: string; icon: typeof User }[] = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'preferences', label: 'Preferences', icon: SettingsIcon },
    { id: 'appearance', label: 'Appearance', icon: Palette },
  ]

  if (profileQuery.isError || prefsQuery.isError) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <OrnateCard topBar corners="all" className="!p-6 flex items-center gap-2">
          <AlertCircle size={20} style={{ color: 'var(--missed, #e44244)' }} />
          <span style={{ color: 'var(--missed, #e44244)' }}>
            Failed to load settings. Please refresh the page.
          </span>
        </OrnateCard>
      </div>
    )
  }

  if (!profile || !prefs) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <p style={{ color: 'var(--gold-deep)' }}>Loading…</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 md:pt-0">
      <PageHeader
        title="Settings"
        subtitle="Tailor the companion to your journey"
        ornament={<SettingsIcon size={26} />}
      />

      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition whitespace-nowrap"
            style={
              activeTab === id
                ? {
                    background:
                      'linear-gradient(135deg, var(--gold-mid) 0%, var(--gold-light) 100%)',
                    color: 'var(--emerald-deep)',
                    border: '1px solid var(--gold-deep)',
                  }
                : {
                    background:
                      'linear-gradient(180deg, var(--manuscript-cream) 0%, var(--manuscript-cream-2) 100%)',
                    color: 'var(--gold-deep)',
                    border: '1px solid var(--gold-mid)',
                  }
            }
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      <OrnateCard topBar corners="all" className="!p-8">
        {activeTab === 'profile' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center mb-6">
              <h2
                className="text-2xl font-bold"
                style={{
                  color: 'var(--emerald-deep)',
                  fontFamily: 'Georgia, "Times New Roman", serif',
                }}
              >
                Profile Information
              </h2>
              {!editMode && (
                <Button onClick={() => setEditMode(true)} variant="primary">
                  Edit Profile
                </Button>
              )}
            </div>

            {editMode ? (
              <div className="space-y-4">
                <Input
                  label="Full Name"
                  type="text"
                  value={profile.full_name ?? ''}
                  onChange={(e) => handleProfileChange('full_name', e.target.value)}
                />
                <Input
                  label="Username"
                  type="text"
                  value={profile.username ?? ''}
                  onChange={(e) => handleProfileChange('username', e.target.value)}
                />
                <Input label="Email" type="email" value={profile.email} disabled />
                <div className="flex gap-2 items-end">
                  <MapPin className="w-5 h-5 text-gray-400 mb-2" />
                  <Input
                    label="Location"
                    type="text"
                    placeholder="City, Country"
                    value={profile.location ?? ''}
                    onChange={(e) => handleProfileChange('location', e.target.value)}
                  />
                </div>
                <Select
                  label="Timezone"
                  value={profile.timezone ?? 'UTC'}
                  onChange={(e) => handleProfileChange('timezone', e.target.value)}
                  options={[
                    { value: 'UTC', label: 'UTC' },
                    { value: 'Africa/Cairo', label: 'Cairo (Egypt)' },
                    { value: 'Asia/Dhaka', label: 'Dhaka (Bangladesh)' },
                    { value: 'Asia/Dubai', label: 'Dubai (UAE)' },
                    { value: 'Asia/Riyadh', label: 'Riyadh (Saudi Arabia)' },
                    { value: 'Europe/London', label: 'London (UK)' },
                    { value: 'America/New_York', label: 'New York (USA)' },
                  ]}
                />
                <Select
                  label="Language"
                  value={profile.language ?? 'en'}
                  onChange={(e) => handleProfileChange('language', e.target.value)}
                  options={[
                    { value: 'en', label: 'English' },
                    { value: 'ar', label: 'العربية' },
                    { value: 'bn', label: 'বাংলা' },
                    { value: 'fr', label: 'Français' },
                  ]}
                />

                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={handleSaveProfile}
                    variant="primary"
                    disabled={isSaving || updateProfileMutation.isPending}
                    className="flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    {isSaving || updateProfileMutation.isPending ? 'Saving…' : 'Save Changes'}
                  </Button>
                  <Button onClick={() => setEditMode(false)} variant="secondary">
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <Row label="Full Name" value={profile.full_name ?? '—'} />
                <Row label="Username" value={profile.username ?? '—'} />
                <Row label="Email" value={profile.email} />
                <Row label="Location" value={profile.location ?? '—'} />
                <Row label="Timezone" value={profile.timezone ?? 'UTC'} />
                <Row label="Language" value={profile.language ?? 'en'} />
              </div>
            )}
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="space-y-6">
            <h2
              className="text-2xl font-bold"
              style={{
                color: 'var(--emerald-deep)',
                fontFamily: 'Georgia, "Times New Roman", serif',
              }}
            >
              Notification Preferences
            </h2>
            <div className="space-y-3">
              <ToggleRow
                label="Email Notifications"
                description="Receive updates via email"
                checked={prefs.email_notifications}
                onChange={() => handlePrefToggle('email_notifications', true)}
              />
              <ToggleRow
                label="Habit Reminders"
                description="Get reminded about daily habits"
                checked={prefs.habit_reminders}
                onChange={() => handlePrefToggle('habit_reminders', true)}
              />
              <ToggleRow
                label="Challenge Updates"
                description="Updates on challenges you're participating in"
                checked={prefs.challenge_updates}
                onChange={() => handlePrefToggle('challenge_updates', true)}
              />
              <ToggleRow
                label="Prayer Reminders"
                description="Reminders for prayer times"
                checked={prefs.prayer_reminders}
                onChange={() => handlePrefToggle('prayer_reminders', true)}
              />
            </div>
          </div>
        )}

        {activeTab === 'preferences' && (
          <div className="space-y-6">
            <h2
              className="text-2xl font-bold"
              style={{
                color: 'var(--emerald-deep)',
                fontFamily: 'Georgia, "Times New Roman", serif',
              }}
            >
              App Preferences
            </h2>
            <div className="space-y-3">
              <ToggleRow
                label="Arabic Text"
                description="Display Arabic text and translations"
                checked={prefs.arabic_text}
                onChange={() => handlePrefToggle('arabic_text', true)}
              />
              <div>
                <label
                  className="block text-sm font-semibold mb-2"
                  style={{
                    color: 'var(--emerald-deep)',
                    fontFamily: 'Georgia, "Times New Roman", serif',
                  }}
                >
                  Default View
                </label>
                <Select
                  value={prefs.default_view}
                  onChange={(e) => setPrefs({ ...prefs, default_view: e.target.value })}
                  options={[
                    { value: 'daily', label: 'Daily View' },
                    { value: 'weekly', label: 'Weekly View' },
                    { value: 'monthly', label: 'Monthly View' },
                  ]}
                />
              </div>

              <div className="pt-4 mt-4">
                <h3
                  className="text-lg font-semibold mb-1"
                  style={{
                    color: 'var(--emerald-deep)',
                    fontFamily: 'Georgia, "Times New Roman", serif',
                  }}
                >
                  Hijri Calendar
                </h3>
                <div
                  className="flex items-start gap-2 text-sm mb-4"
                  style={{ color: 'var(--gold-deep)' }}
                >
                  <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <p>
                    Pick the calculation method used by your local community. If your
                    country&rsquo;s committee announces the new month one day earlier or
                    later than Aladhan&rsquo;s global default, set the offset accordingly.
                    Most users should leave the offset at <strong>0</strong>.
                  </p>
                </div>

                <Select
                  label="Calculation basis"
                  value={prefs.hijri_basis}
                  onChange={(e) =>
                    setPrefs({ ...prefs, hijri_basis: e.target.value })
                  }
                  options={HIJRI_BASIS_OPTIONS}
                />

                <div>
                  <Select
                    label="Local sighting offset"
                    value={String(prefs.hijri_offset)}
                    onChange={(e) =>
                      setPrefs({ ...prefs, hijri_offset: Number(e.target.value) })
                    }
                    options={[
                      { value: '-1', label: '−1 day (e.g. Bangladesh, parts of India)' },
                      { value: '0', label: '0 (follow basis exactly)' },
                      { value: '1', label: '+1 day (e.g. Morocco, parts of North Africa)' },
                    ]}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 -mt-3 mb-4">
                    −1 = your community tends to start the new month one day earlier;
                    +1 = one day later; 0 = follow the basis as-is.
                  </p>
                </div>
              </div>
            </div>
            <Button
              onClick={handleSavePrefs}
              variant="primary"
              disabled={updatePrefsMutation.isPending}
              className="flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {updatePrefsMutation.isPending ? 'Saving…' : 'Save Preferences'}
            </Button>
          </div>
        )}

        {activeTab === 'appearance' && <AppearancePanel />}

        {activeTab === 'security' && (
          <div className="space-y-6">
            <h2
              className="text-2xl font-bold"
              style={{
                color: 'var(--emerald-deep)',
                fontFamily: 'Georgia, "Times New Roman", serif',
              }}
            >
              Security
            </h2>

            <div className="space-y-3">
              <h3
                className="font-semibold flex items-center gap-2"
                style={{
                  color: 'var(--emerald-deep)',
                  fontFamily: 'Georgia, "Times New Roman", serif',
                }}
              >
                <Lock className="w-4 h-4" style={{ color: 'var(--gold-deep)' }} />
                Change Password
              </h3>

              <div className="relative">
                <Input
                  label="Current Password"
                  type={showCurrentPw ? 'text' : 'password'}
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPw((v) => !v)}
                  className="absolute right-3 top-9"
                  style={{ color: 'var(--gold-deep)' }}
                >
                  {showCurrentPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <div className="relative">
                <Input
                  label="New Password"
                  type={showNewPw ? 'text' : 'password'}
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  helperText="Minimum 8 characters, 1 uppercase, 1 digit"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPw((v) => !v)}
                  className="absolute right-3 top-9"
                  style={{ color: 'var(--gold-deep)' }}
                >
                  {showNewPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <Input
                label="Confirm New Password"
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
              />

              <Button
                variant="primary"
                onClick={handleChangePassword}
                disabled={changePasswordMutation.isPending}
              >
                {changePasswordMutation.isPending ? 'Updating…' : 'Update Password'}
              </Button>
            </div>

            <GoldDivider className="my-6" />

            <Button
              variant="secondary"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              className="flex items-center gap-2"
              style={{ color: 'var(--missed, #e44244)' }}
            >
              <LogOut className="w-4 h-4" />
              Logout
            </Button>
          </div>
        )}
      </OrnateCard>
    </div>
  )
}

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div
    className="p-4 rounded-xl"
    style={{
      background:
        'linear-gradient(180deg, var(--manuscript-cream) 0%, var(--manuscript-cream-2) 100%)',
      border: '1px solid var(--gold-mid)',
    }}
  >
    <div
      className="text-[10px] uppercase tracking-[0.18em] font-semibold mb-1"
      style={{ color: 'var(--gold-deep)' }}
    >
      {label}
    </div>
    <div
      className="font-semibold"
      style={{
        color: 'var(--emerald-deep)',
        fontFamily: 'Georgia, "Times New Roman", serif',
      }}
    >
      {value}
    </div>
  </div>
)

const ToggleRow: React.FC<{
  label: string
  description: string
  checked: boolean
  onChange: () => void
}> = ({ label, description, checked, onChange }) => (
  <div
    className="p-4 rounded-xl flex items-center justify-between"
    style={{
      background:
        'linear-gradient(180deg, var(--manuscript-cream) 0%, var(--manuscript-cream-2) 100%)',
      border: '1px solid var(--gold-mid)',
    }}
  >
    <div>
      <div
        className="font-semibold"
        style={{
          color: 'var(--emerald-deep)',
          fontFamily: 'Georgia, "Times New Roman", serif',
        }}
      >
        {label}
      </div>
      <div
        className="text-sm"
        style={{ color: 'var(--gold-deep)', opacity: 0.85 }}
      >
        {description}
      </div>
    </div>
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className="w-5 h-5 cursor-pointer"
      style={{ accentColor: 'var(--gold-mid)' }}
    />
  </div>
)
/**
 * Appearance tab — a theme picker powered by `useTheme()` + `<ThemeSwitcher />`.
 * Updates the `data-theme` attribute on <html> immediately and persists to
 * localStorage, so the choice survives reloads and the next page render.
 */
const AppearancePanel: React.FC = () => {
  const { meta, themes } = useTheme()
  return (
    <div className="space-y-6">
      <div>
        <h2
          className="text-2xl font-bold"
          style={{
            color: 'var(--emerald-deep)',
            fontFamily: 'Georgia, "Times New Roman", serif',
          }}
        >
          Appearance
        </h2>
        <p
          className="text-sm mt-1"
          style={{ color: 'var(--gold-deep)' }}
        >
          Pick the colour palette for the whole app. The change is instant and
          applies to every page — Prayer Tracker, Settings, Dashboard, and beyond.
        </p>
      </div>

      <ThemeSwitcher />

      <div
        className="rounded-2xl p-4 text-sm"
        style={{
          background:
            'linear-gradient(180deg, var(--manuscript-cream) 0%, var(--manuscript-cream-2) 100%)',
          border: '1px solid var(--gold-mid)',
          color: 'var(--gold-deep)',
        }}
      >
        <div className="flex items-center gap-2 mb-2">
          <Info className="w-4 h-4" style={{ color: 'var(--emerald)' }} />
          <span
            className="font-semibold"
            style={{
              color: 'var(--emerald-deep)',
              fontFamily: 'Georgia, "Times New Roman", serif',
            }}
          >
            Currently active
          </span>
        </div>
        <p>
          <strong
            style={{
              color: 'var(--emerald-deep)',
              fontFamily: 'Georgia, "Times New Roman", serif',
            }}
          >
            {meta.name}
          </strong>
          {' — '}
          {meta.tagline}
        </p>
        <p className="mt-2 text-xs">
          {themes.length} themes available
        </p>
      </div>
    </div>
  )
}
