import { Check, Moon, Sun } from 'lucide-react'
import { THEMES, useTheme, type ThemeId } from '../contexts/ThemeContext'

/**
 * Theme picker UI — renders a vertical list of theme cards. Each card
 * previews the six palette tokens as colour swatches so the user can see
 * what they're picking, and shows a green check on the active card.
 *
 * Used standalone on the Settings page (see `Settings.tsx`) and embedded
 * in the Sidebar drawer (via `CompactThemeSwitcher` below).
 */
export const ThemeSwitcher: React.FC = () => {
  const { theme, setTheme } = useTheme()

  return (
    <div className="space-y-3">
      {THEMES.map((t) => (
        <ThemeCard
          key={t.id}
          id={t.id}
          name={t.name}
          tagline={t.tagline}
          recommended={t.recommended}
          swatches={t.swatches}
          active={theme === t.id}
          onSelect={() => setTheme(t.id)}
        />
      ))}
    </div>
  )
}

interface ThemeCardProps {
  id: ThemeId
  name: string
  tagline: string
  recommended?: boolean
  swatches: {
    primary: string
    light: string
    fill: string
    accent: string
    fill2: string
    surface: string
  }
  active: boolean
  onSelect: () => void
}

const ThemeCard: React.FC<ThemeCardProps> = ({
  id,
  name,
  tagline,
  recommended,
  swatches,
  active,
  onSelect,
}) => (
  <button
    type="button"
    onClick={onSelect}
    aria-pressed={active}
    data-testid={`theme-card-${id}`}
    className={`relative w-full text-left rounded-2xl border-2 bg-surface-card transition-all duration-200 ${
      active
        ? 'border-edge-focus shadow-[0_8px_24px_-12px_rgba(15,23,42,0.25)] ring-2 ring-edge-focus/30'
        : 'border-edge-soft hover:border-edge-strong hover:shadow-sm'
    }`}
  >
    {/* Header row: title + recommended + active check */}
    <div className="flex items-start justify-between gap-3 p-4 pb-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-base font-bold text-text-strong">{name}</h3>
          {recommended && (
            <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-brand-mid text-brand-primary">
              Recommended
            </span>
          )}
        </div>
        <p className="text-xs text-text-muted mt-1 leading-relaxed">{tagline}</p>
      </div>
      {active && (
        <span className="shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-full bg-brand-primary text-text-inverse">
          <Check size={14} strokeWidth={3} />
        </span>
      )}
    </div>

    {/* Swatch row — mirrors the reference image's preview strip */}
    <div className="grid grid-cols-6 gap-2 px-4 pb-4">
      <Swatch hex={swatches.primary} label="Primary" />
      <Swatch hex={swatches.light} label="Light" />
      <Swatch hex={swatches.fill} label="Fill" />
      <Swatch hex={swatches.accent} label="Accent" />
      <Swatch hex={swatches.fill2} label="Fill-2" />
      <Swatch hex={swatches.surface} label="Surface" isSurface />
    </div>
  </button>
)

const Swatch: React.FC<{ hex: string; label: string; isSurface?: boolean }> = ({
  hex,
  label,
  isSurface,
}) => (
  <div>
    <div
      className={`aspect-square w-full rounded-xl border border-edge-soft ${isSurface ? '' : 'shadow-inner'}`}
      style={{ backgroundColor: hex }}
      aria-label={`${label} swatch ${hex}`}
    />
    <div className="mt-1 text-[9px] uppercase tracking-wider text-text-muted text-center font-semibold">
      {label}
    </div>
  </div>
)

/**
 * Compact switcher for tight spaces (TopNav / popover).
 * A single sun/moon toggle button that flips between light and dark.
 */
export const CompactThemeSwitcher: React.FC = () => {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-pressed={isDark}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Light mode' : 'Dark mode'}
      className="relative inline-flex items-center justify-center h-9 w-9 rounded-full border-2 transition hover:scale-105"
      style={{
        borderColor: 'var(--gold-mid)',
        background: 'var(--glass-bg)',
        color: 'var(--gold-mid)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  )
}
