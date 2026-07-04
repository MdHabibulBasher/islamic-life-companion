import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

/**
 * Theme system
 * -----------
 * Dark-only for now. The app always applies the Deep Night palette (gold
 * leaf on deep emerald/forest). `applyTheme` unconditionally adds `.dark`
 * to <html>; `toggleTheme` is a no-op kept for API compatibility so call
 * sites don't need to change. The choice is still persisted to localStorage
 * (always 'dark') for forward-compat if light mode returns later.
 */

export type ThemeId = 'light' | 'dark'

export interface ThemeMeta {
  id: ThemeId
  name: string
  tagline: string
  recommended?: boolean
  /**
   * Six swatches displayed in the theme picker card preview:
   * Primary, Light (mid), Fill, Accent, Fill-2 (alt accent), Surface.
   */
  swatches: {
    primary: string
    light: string
    fill: string
    accent: string
    fill2: string
    surface: string
  }
}

export const THEMES: ThemeMeta[] = [
  {
    id: 'dark',
    name: 'Deep Night',
    tagline: 'Deep emerald/forest with gold leaf — premium, dark-friendly, easy on the eyes.',
    recommended: true,
    swatches: {
      primary: '#d4a017',
      light:   '#1e3a32',
      fill:    '#f0c75e',
      accent:  '#f0c75e',
      fill2:   '#163a32',
      surface: '#0d2e29',
    },
  },
]

const STORAGE_KEY = 'app:theme'
const DEFAULT_THEME: ThemeId = 'dark'

interface ThemeContextValue {
  theme: ThemeId
  meta: ThemeMeta
  setTheme: (id: ThemeId) => void
  toggleTheme: () => void
  themes: ThemeMeta[]
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

/**
 * Always apply `.dark` — dark-only theme. Safe to call on the server.
 */
export function applyTheme(_id?: ThemeId): void {
  if (typeof document === 'undefined') return
  document.documentElement.classList.add('dark')
}

export function getStoredTheme(): ThemeId {
  return DEFAULT_THEME
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Initialise from localStorage so the first paint already has the right theme
  // — no flash of the default before the effect runs.
  const [theme, setThemeState] = useState<ThemeId>(() => getStoredTheme())

  // Keep the `.dark` class on <html> in sync on mount + on every change.
  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const setTheme = useCallback((_id: ThemeId) => {
    // Dark-only: ignore any request for light mode.
    setThemeState('dark')
    applyTheme('dark')
    try {
      window.localStorage.setItem(STORAGE_KEY, 'dark')
    } catch {
      /* ignore quota / private-mode errors */
    }
  }, [])

  const toggleTheme = useCallback(() => {
    // Dark-only: no-op. Kept for API compatibility with existing call sites.
  }, [])

  const meta = useMemo(
    () => THEMES.find((t) => t.id === theme) ?? THEMES[0],
    [theme],
  )

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, meta, setTheme, toggleTheme, themes: THEMES }),
    [theme, meta, setTheme, toggleTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

/**
 * Hook for accessing the active theme. Throws if used outside <ThemeProvider>,
 * which surfaces integration mistakes early in development.
 */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useTheme must be used inside <ThemeProvider>')
  }
  return ctx
}
