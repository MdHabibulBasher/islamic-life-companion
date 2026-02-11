import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Mail, Lock, User } from 'lucide-react'
import { Input, Button } from '../../components/Form'
import { LoadingSpinner } from '../../components/Loading'
import { useToast } from '../../components/Toast'
import { useAuthStore } from '../../store/authStore'
import { api } from '../../services/api'

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
    setFormData(prev => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
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

      // Store tokens and user info
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
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-block text-5xl mb-4">🕌</div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Islamic Life</h1>
          <p className="text-gray-600 dark:text-gray-400">Begin your spiritual journey</p>
        </div>

        {/* Signup Form */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 text-center">Create Account</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Full Name"
              name="full_name"
              type="text"
              value={formData.full_name}
              onChange={handleChange}
              error={errors.full_name}
              icon={<User size={20} />}
              placeholder="John Doe"
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

            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={loading}
              className="w-full mt-6"
            >
              {loading ? <LoadingSpinner size="sm" /> : 'Create Account'}
            </Button>
          </form>

          {/* Login Link */}
          <p className="text-center text-gray-600 dark:text-gray-400 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 font-medium">
              Login
            </Link>
          </p>
        </div>

        {/* Benefits */}
        <div className="grid grid-cols-2 gap-4 mt-8 text-sm">
          <div className="text-center">
            <div className="text-2xl mb-2">🎯</div>
            <p className="text-gray-600 dark:text-gray-400 text-xs">Goal Tracking</p>
          </div>
          <div className="text-center">
            <div className="text-2xl mb-2">🌙</div>
            <p className="text-gray-600 dark:text-gray-400 text-xs">Prayer Times</p>
          </div>
          <div className="text-center">
            <div className="text-2xl mb-2">📖</div>
            <p className="text-gray-600 dark:text-gray-400 text-xs">Quran Reading</p>
          </div>
          <div className="text-center">
            <div className="text-2xl mb-2">📅</div>
            <p className="text-gray-600 dark:text-gray-400 text-xs">Islamic Calendar</p>
          </div>
        </div>
      </div>
    </div>
  )
}
