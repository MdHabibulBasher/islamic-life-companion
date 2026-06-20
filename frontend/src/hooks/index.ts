import { useCallback } from 'react'
import { useAuthStore } from '../store/authStore'

/**
 * Custom hook to check if user is authenticated
 */
export const useAuth = () => {
  const { isAuthenticated, user, logout } = useAuthStore()

  const handleLogout = useCallback(() => {
    logout()
    window.location.href = '/login'
  }, [logout])

  return {
    isAuthenticated,
    user,
    logout: handleLogout,
  }
}

/**
 * Custom hook for managing form state
 */
export const useForm = <T>(initialState: T) => {
  const [formData, setFormData] = React.useState(initialState)

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' 
        ? (e.target as HTMLInputElement).checked 
        : value
    }))
  }, [])

  const resetForm = useCallback(() => {
    setFormData(initialState)
  }, [initialState])

  return {
    formData,
    setFormData,
    handleChange,
    resetForm,
  }
}

/**
 * Custom hook for API calls with loading state
 */
import React from 'react'

export const useAsync = <T, E = string>(
  asyncFunction: () => Promise<T>,
  immediate = true
) => {
  const [status, setStatus] = React.useState<'idle' | 'pending' | 'success' | 'error'>('idle')
  const [value, setValue] = React.useState<T | null>(null)
  const [error, setError] = React.useState<E | null>(null)

  const execute = React.useCallback(async () => {
    setStatus('pending')
    setValue(null)
    setError(null)
    try {
      const response = await asyncFunction()
      setValue(response)
      setStatus('success')
      return response
    } catch (error) {
      setError(error as E)
      setStatus('error')
    }
  }, [asyncFunction])

  React.useEffect(() => {
    if (immediate) {
      execute()
    }
  }, [execute, immediate])

  return { execute, status, value, error }
}
