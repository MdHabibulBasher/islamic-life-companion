/**
 * Utility functions for the application
 */

// Date utilities
export const formatDate = (date: string | Date): string => {
  const d = new Date(date)
  return d.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })
}

export const formatTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

export const getLocalDate = (): string => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const formatDateISO = (date: Date): string => {
  return date.toISOString().split('T')[0]
}

export const isToday = (dateStr: string): boolean => {
  return dateStr === getLocalDate()
}

export const isPastDate = (dateStr: string): boolean => {
  return dateStr < getLocalDate()
}

export const isFutureDate = (dateStr: string): boolean => {
  return dateStr > getLocalDate()
}

// String utilities
export const capitalize = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export const truncate = (str: string, length: number): string => {
  if (str.length <= length) return str
  return str.substr(0, length) + '...'
}

// Color utilities
export const getColorForCategory = (categoryId: number): string => {
  const colors = [
    '#2C5F2D', // Green
    '#D97706', // Orange
    '#7C3AED', // Purple
    '#DC2626', // Red
    '#0891B2', // Cyan
    '#6366F1', // Indigo
  ]
  return colors[categoryId % colors.length]
}

// Validation utilities
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export const isStrongPassword = (password: string): boolean => {
  return password.length >= 8 && 
         /[A-Z]/.test(password) && 
         /[a-z]/.test(password) && 
         /[0-9]/.test(password)
}

// Calculate utilities
export const calculateCompletionRate = (completed: number, total: number): number => {
  if (total === 0) return 0
  return Math.round((completed / total) * 100)
}

export const calculateStreak = (dates: string[]): number => {
  if (dates.length === 0) return 0
  
  const sortedDates = [...dates].sort().reverse()
  let streak = 0
  const today = getLocalDate()
  const someDate = new Date(today)
  
  let currentDate = new Date(someDate)
  
  for (let i = 0; i < sortedDates.length; i++) {
    const expectedDate = new Date(currentDate)
    expectedDate.setDate(currentDate.getDate() - i)
    
    if (formatDateISO(expectedDate) === sortedDates[i]) {
      streak++
    } else {
      break
    }
  }
  
  return streak
}
