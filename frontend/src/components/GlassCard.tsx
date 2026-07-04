import React from 'react'

/**
 * GlassCard
 * ---------
 * Frosted-glass surface for the creamy-white / dark duo-theme. Both modes
 * resolve through CSS variables (`--glass-bg`, `--glass-border`,
 * `--glass-shadow`, `--glass-highlight`, `--glass-text`) defined in
 * `index.css`, so a single `.glass-card` class works in either mode — no
 * `dark:` prefix needed.
 *
 *   • `backdrop-filter` + `-webkit-backdrop-filter` (Safari needs both)
 *   • top-edge highlight via the `.glass-card::before` rule
 *   • optional gold ornaments (corner flourishes + top accent bar) —
 *     uses a self-contained `CornerFlourish` SVG so this file has no
 *     circular dependency on `IslamicOrnamentBG`.
 *   • `variant="dark"` forces the dark-glass spec (`--glass-bg-dark` etc.)
 *     regardless of the active mode — for hero cards that should always
 *     read as dark glass.
 *
 * Usage:
 *   <GlassCard className="p-6">
 *     <h3 className="font-semibold">Quran journey</h3>
 *   </GlassCard>
 *
 *   <GlassCard ornaments variant="dark" className="p-6">
 *     <h3>Hero banner</h3>
 *   </GlassCard>
 */

// Self-contained corner flourish (avoids a circular import with
// IslamicOrnamentBG, which now delegates OrnateCard to GlassCard).
const CornerFlourish: React.FC<{
  size?: number
  strokeWidth?: number
  className?: string
  color?: string
  flip?: 'h' | 'v' | 'both' | 'none'
}> = ({
  size = 28,
  strokeWidth = 1.2,
  className,
  color,
  flip = 'none',
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 40 40"
    width={size}
    height={size}
    fill="none"
    stroke={color ?? 'currentColor'}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
    style={{
      transform:
        flip === 'both'
          ? 'scale(-1, -1)'
          : flip === 'h'
            ? 'scaleX(-1)'
            : flip === 'v'
              ? 'scaleY(-1)'
              : undefined,
    }}
  >
    <path d="M 4 4 Q 4 18, 18 18 Q 30 18, 36 12" />
    <path d="M 4 4 Q 18 4, 18 18" />
    <circle cx="18" cy="18" r="1.6" fill={color ?? 'currentColor'} />
    <path d="M 22 14 Q 26 10, 32 10" opacity="0.7" />
    <path d="M 14 22 Q 10 26, 10 32" opacity="0.7" />
  </svg>
)

export interface GlassCardProps {
  children: React.ReactNode
  className?: string
  /**
   * Show gold corner flourishes + top accent bar (illuminated-manuscript
   * treatment). Default `false` — pure glass. Pages that previously used
   * `<OrnateCard corners="all" />` pass `ornaments` to keep the gold frame.
   */
  ornaments?: boolean
  /** Top accent bar (gold leaf). Implied `true` when `ornaments` is on. */
  topBar?: boolean
  /** Which corners get flourishes when `ornaments` is on. */
  corners?: 'none' | 'all' | 'top' | 'bottom'
  /**
   * Visual variant. `'light'` / `'dark'` auto-selects the matching glass
   * spec; `'dark'` forces dark glass regardless of the active mode (for
   * hero banners). Default `'auto'` follows the current theme.
   */
  variant?: 'auto' | 'light' | 'dark'
  /** Optional header ornament, centred above the children. */
  headerOrnament?: React.ReactNode
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className = '',
  ornaments = false,
  topBar,
  corners = 'all',
  variant = 'auto',
  headerOrnament,
}) => {
  // Force-dark only when explicitly requested; otherwise the CSS vars
  // already flip via the `.dark` class on <html>.
  const darkClass = variant === 'dark' ? 'glass-card--dark' : ''
  const showTopBar = topBar ?? ornaments
  const showOrnaments = ornaments

  const renderCorner = (corner: 'tl' | 'tr' | 'bl' | 'br') => {
    if (corners === 'none') return null
    if (corners === 'top' && (corner === 'bl' || corner === 'br')) return null
    if (corners === 'bottom' && (corner === 'tl' || corner === 'tr')) return null
    const position =
      corner === 'tl'
        ? 'top-2 left-2'
        : corner === 'tr'
          ? 'top-2 right-2'
          : corner === 'bl'
            ? 'bottom-2 left-2'
            : 'bottom-2 right-2'
    const flip: 'h' | 'v' | 'both' | undefined =
      corner === 'tr' ? 'h' : corner === 'bl' ? 'v' : corner === 'br' ? 'both' : undefined
    return (
      <span
        className={`absolute ${position} text-[var(--gold-mid)] pointer-events-none z-10`}
      >
        <CornerFlourish size={28} flip={flip} />
      </span>
    )
  }

  return (
    <div className={`relative glass-card ${darkClass} ${className}`}>
      {showTopBar && (
        <div className="absolute top-0 left-6 right-6 h-[2px] accent-bar-gold rounded-full z-10" />
      )}
      {showOrnaments && corners !== 'none' && (
        <>
          {renderCorner('tl')}
          {renderCorner('tr')}
          {renderCorner('bl')}
          {renderCorner('br')}
        </>
      )}
      {headerOrnament && (
        <div className="flex items-center justify-center pt-5 text-[var(--gold-mid)] relative z-10">
          {headerOrnament}
        </div>
      )}
      <div className="relative">{children}</div>
    </div>
  )
}

export default GlassCard