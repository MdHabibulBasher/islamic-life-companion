import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { GlassCard } from './GlassCard'

/**
 * IslamicOrnamentBG
 * -----------------
 * A decorative background layer behind page content, rendered into
 * document.body via a React portal so it sits below all routes.
 *
 * The lantern image pattern was removed per user request — the page now
 * uses the clean solid deep-colour background already painted on <body>
 * (radial gradient emerald → deep-edge). The component is still mounted
 * by App.tsx so the auth variant can contribute a gold-gradient wash
 * via .islamic-bg--auth::before, and so the parent layout doesn't need
 * to be restructured.
 *
 * Three intensity presets (only `auth` still has a visible effect):
 *   • default — empty wrapper (transparent)
 *   • auth    — gold-gradient wash for login/signup
 *   • top     — empty wrapper (transparent; reserved for future hero)
 *
 * The file also exports the reusable ornament SVG library
 * (`MihrabArch`, `CrescentStar`, `Star8`, `HexRosette`, `CornerFlourish`,
 * `GoldDivider`, `OrnateCard`) used across the rest of the redesign.
 */

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

export type OrnamentIntensity = 'default' | 'auth' | 'top'

interface IslamicOrnamentBGProps {
  /**
   * Visual intensity preset.
   *  • `default` — subtle page-level wash behind every authenticated page
   *  • `auth`    — stronger wash + warm gradient for login/signup
   *  • `top`     — single large lantern behind a hero card
   */
  intensity?: OrnamentIntensity
  /** Optional className passthrough for layout positioning. */
  className?: string
}

export const IslamicOrnamentBG: React.FC<IslamicOrnamentBGProps> = ({
  intensity = 'default',
  className = '',
}) => {
  // `mounted` is needed so we can defer the portal render until after
  // first client mount — `document.body` is unavailable during SSR.
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  // Background pattern was removed per user request — they prefer a
  // clean solid deep-colour page with no lantern imagery. The component
  // is still mounted by App.tsx so the auth variant can contribute a
  // gold-gradient wash via .islamic-bg--auth::before, and so the parent
  // layout doesn't need to be restructured.

  // The wrapper is rendered into `document.body` via a portal so it sits
  // at the very top of the body's stacking context, with `position: fixed`
  // anchoring it to the viewport. This is the only way to guarantee no
  // page-level solid background can paint over the ornament.
  const node = (
    <div
      aria-hidden="true"
      className={`islamic-bg islamic-bg--${intensity} pointer-events-none ${className}`}
    />
  )

  if (!mounted || typeof document === 'undefined') return null
  return createPortal(node, document.body)
}

export default IslamicOrnamentBG

// ============================================================================
// ORNAMENT LIBRARY
// ----------------------------------------------------------------------------
// Reusable SVG components that draw the motifs seen across the user's
// ornament references — gold-line illuminated-manuscript style. All strokes
// use `currentColor`, so the colour is controlled by the parent's `color:`
// (typically `var(--gold-mid)` or `var(--ornament-ink)`).
//
// Each component takes:
//   • `size?: number`         — width AND height in px (default 24)
//   • `strokeWidth?: number`  — override default 1.5
//   • `className?: string`    — passthrough for layout
// ============================================================================

interface OrnamentProps {
  size?: number
  strokeWidth?: number
  className?: string
  color?: string
}

const SVGDefaults = ({
  size,
  strokeWidth = 1.5,
  className,
  color,
  children,
  viewBox,
}: OrnamentProps & { children: React.ReactNode; viewBox: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox={viewBox}
    width={size}
    height={size}
    fill="none"
    stroke={color ?? 'currentColor'}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    {children}
  </svg>
)

// ---------------------------------------------------------------------------
// Lantern — REMOVED per user request. The page now uses a clean solid
// deep background instead of the lantern motif. Kept as a stub export
// (returns null) so any leftover import doesn't break the build.
// ---------------------------------------------------------------------------
export const Lantern: React.FC<OrnamentProps> = () => null

// ---------------------------------------------------------------------------
// MihrabArch — pointed horseshoe arch with concentric inner frame,
// spandrel flourishes, and a keystone drop. Use as a page-level frame
// behind hero content. Pass a custom height via the size prop.
// ---------------------------------------------------------------------------
export const MihrabArch: React.FC<OrnamentProps & { height?: number }> = ({
  height,
  size = 320,
  ...p
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 200 240"
    width={size}
    height={height ?? size * 1.2}
    fill="none"
    stroke={p.color ?? 'currentColor'}
    strokeWidth={p.strokeWidth ?? 1.4}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={p.className}
    aria-hidden="true"
  >
    {/* Outer pointed arch */}
    <path d="M 20 230 L 20 110 C 20 50, 60 18, 100 18 C 140 18, 180 50, 180 110 L 180 230 Z" />
    {/* Inner concentric arch */}
    <path d="M 36 230 L 36 116 C 36 64, 70 36, 100 36 C 130 36, 164 64, 164 116 L 164 230 Z" opacity="0.7" />
    {/* Spandrel flourishes */}
    <g opacity="0.6">
      <path d="M 56 80 Q 44 92, 56 104 Q 68 92, 56 80 Z" />
      <path d="M 144 80 Q 156 92, 144 104 Q 132 92, 144 80 Z" />
    </g>
    {/* Keystone + drop */}
    <path d="M 95 18 L 105 18" />
    <circle cx="100" cy="38" r="2" />
    <path d="M 100 40 L 100 56" />
    {/* Inner-base rule */}
    <path d="M 16 230 L 184 230" />
  </svg>
)

// ---------------------------------------------------------------------------
// CrescentStar — Islamic crescent + star. Often used at the top of banners
// and beside titles.
// ---------------------------------------------------------------------------
export const CrescentStar: React.FC<OrnamentProps> = (p) => (
  <SVGDefaults viewBox="0 0 60 60" {...p}>
    {/* Crescent */}
    <path d="M 36 12 A 18 18 0 1 0 36 48 A 14 14 0 1 1 36 12 Z" fill={p.color ?? 'currentColor'} fillOpacity="0.15" />
    {/* 5-point star to the upper-right */}
    <path d="M 44 8 L 46 14 L 52 14 L 47 18 L 49 24 L 44 20 L 39 24 L 41 18 L 36 14 L 42 14 Z" />
  </SVGDefaults>
)

// ---------------------------------------------------------------------------
// Star8 — Khatim Sulaymani 8-point star, common in Islamic illumination.
// ---------------------------------------------------------------------------
export const Star8: React.FC<OrnamentProps> = (p) => (
  <SVGDefaults viewBox="0 0 80 80" {...p}>
    <path d="M 40 6 L 48 24 L 66 18 L 58 36 L 74 44 L 58 52 L 66 70 L 48 64 L 40 80 L 32 64 L 14 70 L 22 52 L 6 44 L 22 36 L 14 18 L 32 24 Z" />
    <circle cx="40" cy="44" r="6" />
    <circle cx="40" cy="44" r="2" fill={p.color ?? 'currentColor'} fillOpacity="0.3" />
  </SVGDefaults>
)

// ---------------------------------------------------------------------------
// HexRosette — a hexagonal rosette / zellige motif. Used as a watermark
// or section accent.
// ---------------------------------------------------------------------------
export const HexRosette: React.FC<OrnamentProps> = (p) => (
  <SVGDefaults viewBox="0 0 80 80" {...p}>
    <path d="M 40 8 L 68 24 L 68 56 L 40 72 L 12 56 L 12 24 Z" />
    <path d="M 40 20 L 56 30 L 56 50 L 40 60 L 24 50 L 24 30 Z" opacity="0.7" />
    {/* Star inside */}
    <path d="M 40 26 L 44 36 L 54 36 L 46 42 L 50 52 L 40 46 L 30 52 L 34 42 L 26 36 L 36 36 Z" opacity="0.85" />
  </SVGDefaults>
)

// ---------------------------------------------------------------------------
// CornerFlourish — small ornament designed for the four corners of cards
// and frames. Pass `rotate` (0/90/180/270) via className or wrap in a
// div with `transform: rotate()`.
// ---------------------------------------------------------------------------
export const CornerFlourish: React.FC<OrnamentProps & { flip?: 'h' | 'v' | 'both' }> = ({
  flip = 'none',
  ...p
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 40 40"
    width={p.size ?? 40}
    height={p.size ?? 40}
    fill="none"
    stroke={p.color ?? 'currentColor'}
    strokeWidth={p.strokeWidth ?? 1.2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={p.className}
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
    {/* A curling arabesque leaf + small dot motif */}
    <path d="M 4 4 Q 4 18, 18 18 Q 30 18, 36 12" />
    <path d="M 4 4 Q 18 4, 18 18" />
    <circle cx="18" cy="18" r="1.6" fill={p.color ?? 'currentColor'} />
    <path d="M 22 14 Q 26 10, 32 10" opacity="0.7" />
    <path d="M 14 22 Q 10 26, 10 32" opacity="0.7" />
  </svg>
)

// ---------------------------------------------------------------------------
// GoldDivider — horizontal rule with a centred diamond/lozenge ornament.
// Drop into any container as a full-width section separator.
// ---------------------------------------------------------------------------
export const GoldDivider: React.FC<{ className?: string; color?: string }> = ({
  className,
  color,
}) => (
  <div
    className={`flex items-center justify-center gap-3 ${className ?? ''}`}
    aria-hidden="true"
  >
    <span
      className="flex-1 h-px"
      style={{
        background: `linear-gradient(90deg, transparent 0%, ${color ?? 'var(--gold-mid)'} 50%, transparent 100%)`,
      }}
    />
    <svg
      width="22"
      height="22"
      viewBox="0 0 22 22"
      fill="none"
      stroke={color ?? 'var(--gold-mid)'}
      strokeWidth="1.2"
      strokeLinejoin="round"
    >
      <path d="M 11 2 L 20 11 L 11 20 L 2 11 Z" />
      <circle cx="11" cy="11" r="2.5" fill={color ?? 'var(--gold-mid)'} fillOpacity="0.3" />
    </svg>
    <span
      className="flex-1 h-px"
      style={{
        background: `linear-gradient(90deg, transparent 0%, ${color ?? 'var(--gold-mid)'} 50%, transparent 100%)`,
      }}
    />
  </div>
)

// ---------------------------------------------------------------------------
// OrnateCard
// ----------------------------------------------------------------------------
// A drop-in replacement for <GlassCard> with a manuscript-inspired frame:
//   • bright parchment surface
//   • gold hairline border
//   • optional corner flourishes (one or all four corners)
//   • optional top accent bar (gold leaf gradient)
//   • optional header ornament (small lantern / star / divider)
//
// Now delegates to <GlassCard> so every OrnateCard across the app picks up
// the frosted-glass surface automatically. The gold ornaments (corners +
// top bar) are preserved via the `ornaments` prop. The `variant="dark"`
// path uses GlassCard's forced-dark glass spec.
// ---------------------------------------------------------------------------

interface OrnateCardProps {
  children: React.ReactNode
  /** Visual variant */
  variant?: 'light' | 'warm' | 'dark'
  /** Show gold leaf accent bar at the top */
  topBar?: boolean
  /** Corner flourishes: which corners get them */
  corners?: 'none' | 'all' | 'top' | 'bottom'
  /** Optional header ornament, centred above the title */
  headerOrnament?: React.ReactNode
  /** Extra className */
  className?: string
}

export const OrnateCard: React.FC<OrnateCardProps> = ({
  children,
  variant = 'light',
  topBar = true,
  corners = 'all',
  headerOrnament,
  className = '',
}) => {
  // `warm` is treated as `light` glass with ornaments on (it was a deeper
  // cream — now a warm gold-bordered glass). `dark` forces the dark-glass
  // spec regardless of the active mode.
  const glassVariant = variant === 'dark' ? 'dark' : 'auto'

  return (
    <GlassCard
      ornaments
      topBar={topBar}
      corners={corners}
      variant={glassVariant}
      headerOrnament={headerOrnament}
      className={className}
    >
      {children}
    </GlassCard>
  )
}

// ============================================================================
// PAGE LAYOUT PRIMITIVES
// ----------------------------------------------------------------------------
// Shared structural pieces every redesigned page composes from. Keeps the
// manuscript treatment consistent (same gold rule, same ornament end-caps,
// same colours) without each page having to re-derive them.
// ============================================================================

// ---------------------------------------------------------------------------
// PageHeader
//   • Manuscript title in Georgia serif
//   • Subtle subtitle / caption
//   • Gold rule trailing off to the right
//   • Optional left ornament (e.g. <CrescentStar />)
//   • Optional right action slot (e.g. "+ Add Habit" button)
// ---------------------------------------------------------------------------
interface PageHeaderProps {
  title: string
  subtitle?: string
  ornament?: React.ReactNode
  actions?: React.ReactNode
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  ornament,
  actions,
}) => (
  <header className="flex items-end justify-between gap-4 mb-6 mt-1 flex-wrap">
    <div className="flex items-end gap-3 min-w-0">
      {ornament && (
        <span
          className="shrink-0 mb-1"
          style={{ color: 'var(--gold-mid)' }}
        >
          {ornament}
        </span>
      )}
      <div className="min-w-0">
        <h1
          className="text-2xl sm:text-3xl font-bold tracking-wide leading-tight"
          style={{
            color: 'var(--text-on-glass)',
            fontFamily: 'Georgia, "Times New Roman", serif',
            textShadow: '0 1px 0 rgba(0,0,0,0.45)',
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            className="text-sm mt-0.5"
            style={{ color: 'var(--text-on-glass)', opacity: 0.7 }}
          >
            {subtitle}
          </p>
        )}
      </div>
      <span
        className="hidden sm:block flex-1 h-px mb-2 min-w-[40px]"
        style={{
          background:
            'linear-gradient(90deg, var(--gold-mid) 0%, transparent 80%)',
        }}
        aria-hidden
      />
    </div>
    {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
  </header>
)

// ---------------------------------------------------------------------------
// ManuscriptSection
//   • Section header (gold rule + diamond divider)
//   • Optional subtitle / instructions
//   • Content area
// ---------------------------------------------------------------------------
interface ManuscriptSectionProps {
  title: string
  subtitle?: string
  children: React.ReactNode
  className?: string
}

export const ManuscriptSection: React.FC<ManuscriptSectionProps> = ({
  title,
  subtitle,
  children,
  className = '',
}) => (
  <section className={`mb-8 ${className}`}>
    <div className="flex items-center gap-3 mb-2">
      <h2
        className="text-lg sm:text-xl font-bold tracking-wide"
        style={{
          color: 'var(--text-on-glass)',
          fontFamily: 'Georgia, "Times New Roman", serif',
          textShadow: '0 1px 0 rgba(0,0,0,0.45)',
        }}
      >
        {title}
      </h2>
      <span
        className="flex-1 h-px"
        style={{
          background:
            'linear-gradient(90deg, var(--gold-mid) 0%, transparent 80%)',
        }}
        aria-hidden
      />
    </div>
    {subtitle && (
      <p
        className="text-sm mb-4"
        style={{ color: 'var(--text-on-glass)', opacity: 0.7 }}
      >
        {subtitle}
      </p>
    )}
    {children}
  </section>
)
