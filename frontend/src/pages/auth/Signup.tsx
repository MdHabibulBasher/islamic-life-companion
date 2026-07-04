import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Mail, Lock, User, BookOpen, Calendar, Target, Compass } from 'lucide-react'
import { Input } from '../../components/Form'
import { LoadingSpinner } from '../../components/Loading'
import { useToast } from '../../components/Toast'
import { useAuthStore } from '../../store/authStore'
import { api } from '../../services/api'
import {
  GoldDivider,
  CrescentStar,
  Star8,
  OrnateCard,
} from '../../components/IslamicOrnamentBG'

export const Signup = () => {
  const navigate = useNavigate()
  const { success, error } = useToast()
  const { setAuthenticated, setUser, setTokens } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }))
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    if (!formData.full_name) newErrors.full_name = 'Name is required'
    if (!formData.email) newErrors.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = 'Invalid email format'
    if (!formData.password) newErrors.password = 'Password is required'
    else if (formData.password.length < 8) newErrors.password = 'Password must be at least 8 characters'
    else if (!/[A-Z]/.test(formData.password)) newErrors.password = 'Password must contain an uppercase letter'
    else if (!/[0-9]/.test(formData.password)) newErrors.password = 'Password must contain a number'
    else if (!/[!@#$%^&*]/.test(formData.password)) newErrors.password = 'Password must contain a special character'
    if (!formData.confirmPassword) newErrors.confirmPassword = 'Please confirm your password'
    else if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = 'Passwords do not match'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return
    setLoading(true)
    try {
      const response = await api.post('/auth/signup', {
        email: formData.email,
        password: formData.password,
        full_name: formData.full_name,
      })
      const { access_token, refresh_token, user } = response.data
      setTokens(access_token, refresh_token)
      setUser(user)
      setAuthenticated(true)
      success('Account created successfully! Welcome to Islamic Life.')
      navigate('/')
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || err.message || 'Signup failed. Please try again.'
      error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center px-4 py-8 sm:py-12 relative">
      {/* Top radial gold glow — matches Prayer Tracker hero */}
      <div
        className="absolute inset-x-0 top-0 h-72 opacity-50 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at top, var(--gold-glow) 0%, transparent 70%)',
        }}
      />
      <div className="relative z-10 w-full max-w-md">
        {/* ============================ HERO ============================ */}
        <OrnateCard
          variant="dark"
          topBar
          corners="all"
          className="!p-6 sm:!p-8 relative overflow-hidden mb-6"
        >
          {/* Decorative gold blur accents — same as Prayer Tracker */}
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div
              className="absolute -top-24 -right-24 w-72 h-72 rounded-full blur-3xl"
              style={{
                background:
                  'radial-gradient(circle, rgba(240,199,94,0.18) 0%, transparent 70%)',
              }}
            />
            <div
              className="absolute -bottom-20 -left-20 w-60 h-60 rounded-full blur-3xl"
              style={{
                background:
                  'radial-gradient(circle, rgba(212,160,23,0.12) 0%, transparent 70%)',
              }}
            />
            <div
              className="absolute top-6 bottom-6 left-0 w-px"
              style={{
                background:
                  'linear-gradient(180deg, transparent 0%, var(--gold-mid) 50%, transparent 100%)',
                opacity: 0.6,
              }}
            />
          </div>

          <div className="relative z-10 text-center">
            {/* Eyebrow */}
            <div
              className="flex items-center justify-center gap-2 text-[11px] uppercase tracking-[0.2em] font-bold mb-3"
              style={{ color: 'var(--gold-glow)' }}
            >
              <Star8 size={14} />
              <span>Begin a new journey</span>
              <Star8 size={14} />
            </div>

            <h1
              className="text-3xl sm:text-4xl font-bold tracking-tight mb-1"
              style={{
                color: 'var(--text-on-glass)',
                fontFamily: 'Georgia, "Times New Roman", serif',
              }}
            >
              Islamic Life
            </h1>
            <p
              className="text-sm sm:text-base max-w-md mx-auto"
              style={{ color: 'var(--text-on-glass)', opacity: 0.82 }}
            >
              Begin your spiritual journey — habits, prayer times, qada, and Quran in one illuminated space.
            </p>
          </div>
        </OrnateCard>

        {/* Manuscript form card — uses shared OrnateCard like the rest of the site */}
        <OrnateCard variant="warm" topBar corners="all" className="!p-6 sm:!p-8">
          <h2
            className="text-2xl font-bold mb-1 text-center"
            style={{
              color: 'var(--emerald-deep)',
              fontFamily: 'Georgia, "Times New Roman", serif',
            }}
          >
            Create Account
          </h2>
          <div className="mb-5 mt-2">
            <GoldDivider />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Full Name"
              name="full_name"
              type="text"
              value={formData.full_name}
              onChange={handleChange}
              error={errors.full_name}
              icon={<User size={20} />}
              placeholder="Your name"
              disabled={loading}
            />
            <Input
              label="Email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              error={errors.email}
              icon={<Mail size={20} />}
              placeholder="you@example.com"
              disabled={loading}
            />
            <Input
              label="Password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              error={errors.password}
              icon={<Lock size={20} />}
              placeholder="••••••••"
              helperText="At least 8 characters, 1 uppercase, 1 number, 1 special character"
              disabled={loading}
            />
            <Input
              label="Confirm Password"
              name="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={handleChange}
              error={errors.confirmPassword}
              icon={<Lock size={20} />}
              placeholder="••••••••"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading}
              className="btn-gold-leaf w-full mt-6 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? <LoadingSpinner size="sm" /> : 'Begin the Journey'}
            </button>
          </form>

          <p className="text-center mt-6 text-sm" style={{ color: 'var(--gold-deep)' }}>
            Already have an account?{' '}
            <Link to="/login" className="font-semibold" style={{ color: 'var(--emerald-deep)' }}>
              Login
            </Link>
          </p>
        </OrnateCard>

        {/* Benefits grid */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 mt-6">
          <FeaturePill icon={<Target size={20} style={{ color: 'var(--gold-mid)' }} />} label="Goal Tracking" />
          <FeaturePill icon={<Compass size={20} style={{ color: 'var(--gold-mid)' }} />} label="Prayer Times" />
          <FeaturePill icon={<BookOpen size={20} style={{ color: 'var(--gold-mid)' }} />} label="Quran Reading" />
          <FeaturePill icon={<Calendar size={20} style={{ color: 'var(--gold-mid)' }} />} label="Islamic Calendar" />
        </div>
      </div>
    </div>
  )
}

const FeaturePill: React.FC<{ icon: React.ReactNode; label: string }> = ({ icon, label }) => (
  <div
    className="flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl text-center"
    style={{
      background:
        'linear-gradient(180deg, var(--manuscript-cream) 0%, var(--manuscript-cream-2) 100%)',
      border: '1px solid var(--gold-mid)',
    }}
  >
    {icon}
    <span
      className="text-[10px] uppercase tracking-[0.15em] font-semibold"
      style={{ color: 'var(--emerald-deep)' }}
    >
      {label}
    </span>
  </div>
)
