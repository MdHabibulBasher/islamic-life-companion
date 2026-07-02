import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

/**
 * Theme system
 * -----------
 * Four themes ship today, all sharing the same 14 CSS variables defined in
 * `index.css` under `[data-theme="…"]`:
 *
 *   teal-amber    — calm Islamic feel (default; the previous ihadis palette)
 *   purple-teal   — spiritual, meditative
 *   green-coral   — green = completed, coral = missed
 *   blue-amber    — premium, dark-friendly
 *
 * Switching the theme is a one-line mutation: it sets `data-theme` on
 * `<html>`. Every page repaints immediately because the Tailwind classes
 * (`bg-brand-primary`, `text-ink-body`, …) resolve through CSS variables.
 *
 * The choice is persisted to `localStorage` so it survives reloads.
 */

export type ThemeId = 'teal-amber' | 'purple-teal' | 'green-coral' | 'blue-amber'

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
    id: 'teal-amber',
    name: 'Teal & Amber',
    tagline: 'Calm Islamic feel — teal for primary actions, amber for streaks & alerts.',
    recommended: true,
    swatches: {
      primary: '#2f6157',
      light:   '#eef5ee',
      fill:    '#417e38',
      accent:  '#f59e0b',
      fill2:   '#eef5ee',
      surface: '#fdfcf7',
    },
  },
  {
    id: 'purple-teal',
    name: 'Purple & Teal',
    tagline: 'Spiritual & modern — purple for headings, teal as accent.',
    swatches: {
      primary: '#7c3aed',
      light:   '#ddd6fe',
      fill:    '#6d28d9',
      accent:  '#0d9488',
      fill2:   '#ede9fe',
      surface: '#faf5ff',
    },
  },
  {
    id: 'green-coral',
    name: 'Green & Coral',
    tagline: 'Earthy & energetic — green for completed states, coral for outstanding.',
    swatches: {
      primary: '#16a34a',
      light:   '#dcfce7',
      fill:    '#15803d',
      accent:  '#fb7185',
      fill2:   '#f0fdf4',
      surface: '#f0fdf4',
    },
  },
  {
    id: 'blue-amber',
    name: 'Deep Blue & Amber',
    tagline: 'Premium & dark-friendly — blue for primary, amber for streaks & highlights.',
    swatches: {
      primary: '#1d4ed8',
      light:   '#dbeafe',
      fill:    '#2563eb',
      accent:  '#f59e0b',
      fill2:   '#eff6ff',
      surface: '#f8fafc',
    },
  },
]

const STORAGE_KEY = 'app:theme'
const DEFAULT_THEME: ThemeId = 'teal-amber'

interface ThemeContextValue {
  theme: ThemeId
  meta: ThemeMeta
  setTheme: (id: ThemeId) => void
  themes: ThemeMeta[]
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

/**
 * Apply the theme to <html> as `data-theme="…"`. Safe to call on the server
 * (guards `typeof document`) and before React mounts.
 */
export function applyTheme(id: ThemeId): void {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-theme', id)
}

export function getStoredTheme(): ThemeId {
  if (typeof window === 'undefined') return DEFAULT_THEME
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw && THEMES.some((t) => t.id === raw)) {
      return raw as ThemeId
    }
  } catch {
    /* localStorage may be unavailable in private mode */
  }
  return DEFAULT_THEME
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Initialise from localStorage so the first paint already has the right theme
  // — no flash of the default before the effect runs.
  const [theme, setThemeState] = useState<ThemeId>(() => getStoredTheme())

  // Keep <html data-theme=…> in sync on mount + on every change.
  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const setTheme = useCallback((id: ThemeId) => {
    setThemeState(id)
    applyTheme(id)
    try {
      window.localStorage.setItem(STORAGE_KEY, id)
    } catch {
      /* ignore quota / private-mode errors */
    }
  }, [])

  const meta = useMemo(
    () => THEMES.find((t) => t.id === theme) ?? THEMES[0],
    [theme],
  )

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, meta, setTheme, themes: THEMES }),
    [theme, meta, setTheme],
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
