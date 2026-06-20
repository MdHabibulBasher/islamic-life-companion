import { create } from 'zustand'

interface User {
  id: number
  email: string
  username?: string
  full_name?: string
}

interface AuthStore {
  isAuthenticated: boolean
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  
  // Actions
  setAuthenticated: (authenticated: boolean) => void
  setUser: (user: User | null) => void
  setTokens: (accessToken: string, refreshToken: string) => void
  logout: () => void
  login: (user: User, accessToken: string, refreshToken: string) => void
}

export const useAuthStore = create<AuthStore>((set) => ({
  isAuthenticated: !!localStorage.getItem('access_token'),
  user: null,
  accessToken: localStorage.getItem('access_token'),
  refreshToken: localStorage.getItem('refresh_token'),
  
  setAuthenticated: (authenticated: boolean) => 
    set({ isAuthenticated: authenticated }),
  
  setUser: (user: User | null) => 
    set({ user }),
  
  setTokens: (accessToken: string, refreshToken: string) => {
    localStorage.setItem('access_token', accessToken)
    localStorage.setItem('refresh_token', refreshToken)
    set({ accessToken, refreshToken, isAuthenticated: true })
  },
  
  logout: () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    set({ 
      isAuthenticated: false, 
      user: null, 
      accessToken: null, 
      refreshToken: null 
    })
  },
  
  login: (user: User, accessToken: string, refreshToken: string) => {
    localStorage.setItem('access_token', accessToken)
    localStorage.setItem('refresh_token', refreshToken)
    set({ 
      user, 
      accessToken, 
      refreshToken, 
      isAuthenticated: true 
    })
  },
}))
