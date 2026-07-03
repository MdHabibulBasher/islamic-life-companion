import { Link, useLocation } from 'react-router-dom'
import {
  LogOut,
  Home,
  Settings,
  BarChart3,
  BookOpen,
  X,
  Calendar,
  CheckSquare,
  Clock,
  Trophy,
  Menu,
  Moon,
} from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../hooks'
import { useLocationSync } from '../hooks/useLocationSync'
import { CompactThemeSwitcher } from './ThemeSwitcher'
import { Star8, GoldDivider } from './IslamicOrnamentBG'
import { LocationPicker } from './LocationPicker'
import Logo from '../assets/Logo.png'

/**
 * TopNav (Royal Manuscript Edition)
 * ----------------------------------
 * Horizontal navigation bar styled as an illuminated manuscript strip:
 *
 *   ┌───────────────────────────────────────────────────────────────────┐
 *   │ ░░░ gold-leaf bar ░░░                                             │
 *   │ 🕌 Brand  ❖  [Dashboard][Habits][Prayer Times]... ❖  [Theme][⎋]│
 *   │ ░░░ gold-leaf bar ░░░                                             │
 *   └───────────────────────────────────────────────────────────────────┘
 *
 * The pill becomes a single parchment surface bordered in gold, with a
 * small 8-point star end-cap on each side. Active link uses the gold-leaf
 * fill so it reads as the illuminated choice.
 *
 * Mobile (<md) collapses into a parchment-coloured dropdown with a
 * manuscript-style group label "Main" / "Tools".
 */
export const TopNav = () => {
  const { isAuthenticated, logout } = useAuth()
  const [showMenu, setShowMenu] = useState(false)
  const location = useLocation()
  const syncLocation = useLocationSync()

  const mainItems = [
    { label: 'Dashboard', href: '/', icon: Home },
    { label: 'Calendar', href: '/calendar', icon: Calendar },
    { label: 'To-Do', href: '/todo', icon: CheckSquare },
    { label: 'Prayer', href: '/prayer-times', icon: Clock },
    { label: 'Tracker', href: '/prayer-tracker', icon: Trophy },
    { label: 'Fasting', href: '/fasting', icon: Moon },
    { label: 'Challenges', href: '/challenges', icon: Trophy },
    { label: 'Quran', href: '/quran', icon: BookOpen },
  ]

  const toolItems = [
    { label: 'Analytics', href: '/analytics', icon: BarChart3 },
    { label: 'Settings', href: '/settings', icon: Settings },
  ]

  const isActive = (href: string) =>
    location.pathname === href || (href === '/' && location.pathname === '/')

  if (!isAuthenticated) return null

  // Active link → gold-leaf pill, with a subtle emerald glow ring.
  // Inactive → muted text on parchment, hover lifts with shadow.
  const navLinkClass = (active: boolean) =>
    `flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
      active
        ? 'bg-[var(--gold-mid)] text-[var(--emerald-deep)] shadow-[0_2px_8px_-2px_rgba(154,107,14,0.45),inset_0_1px_0_rgba(255,255,255,0.55)]'
        : 'text-[var(--gold-deep)] hover:bg-[var(--gold-glow)]/40 hover:text-[var(--emerald-deep)]'
    }`

  // Mobile item rendering: same active treatment, but for full-width rows.
  const navRowClass = (active: boolean) =>
    `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-all ${
      active
        ? 'bg-[var(--gold-mid)] text-[var(--emerald-deep)] font-semibold'
        : 'text-[var(--gold-deep)] hover:bg-[var(--gold-glow)]/30'
    }`

  return (
    <>
      {/* =========================== DESKTOP TOP BAR =========================== */}
      <header
        className="hidden md:block sticky top-0 z-40 backdrop-blur-md shadow-[0_4px_18px_-8px_rgba(0,0,0,0.45)]"
        style={{
          background:
            'linear-gradient(180deg, var(--manuscript-cream) 0%, var(--manuscript-cream-2) 100%)',
          borderBottom: '1px solid var(--gold-mid)',
        }}
      >
        {/* Top gold-leaf accent rule */}
        <div className="h-[2px] accent-bar-gold" />
        <div className="flex items-center justify-between gap-4 px-6 py-2.5">
          {/* Brand */}
          <Link
            to="/"
            className="flex items-center gap-3 hover:opacity-90 transition shrink-0 group"
          >
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center shadow-md transition group-hover:scale-105 overflow-hidden"
              style={{
                background:
                  'linear-gradient(135deg, var(--emerald-deep) 0%, var(--surface-deep-2) 100%)',
                border: '1px solid var(--gold-mid)',
              }}
            >
              <img
                src={Logo}
                alt="Islamic Life Companion"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex flex-col leading-tight">
              <span
                className="text-base font-bold tracking-wide"
                style={{
                  color: 'var(--emerald-deep)',
                  fontFamily: 'Georgia, "Times New Roman", serif',
                }}
              >
                Islamic Life
              </span>
              <span
                className="text-[10px] uppercase tracking-[0.18em] font-semibold"
                style={{ color: 'var(--gold-deep)' }}
              >
                Companion
              </span>
            </div>
          </Link>

          {/* Centred nav pill — gold-bordered parchment */}
          <nav className="flex-1 flex items-center justify-center min-w-0">
            <div
              className="flex items-center gap-1 px-2 py-1.5 rounded-full max-w-full overflow-x-auto shadow-inner"
              style={{
                background:
                  'linear-gradient(180deg, var(--manuscript-cream) 0%, var(--manuscript-cream-2) 100%)',
                border: '1px solid var(--gold-mid)',
              }}
            >
              {/* Left ornament end-cap */}
              <span className="pl-1 pr-0.5 shrink-0" style={{ color: 'var(--gold-mid)' }}>
                <Star8 size={14} />
              </span>
              {mainItems.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  className={`${navLinkClass(isActive(item.href))} shrink-0`}
                >
                  <item.icon size={14} className="flex-shrink-0" />
                  <span className="hidden lg:inline whitespace-nowrap">{item.label}</span>
                </Link>
              ))}
              {/* Gold divider between main and tools */}
              <span
                className="mx-1.5 h-5 w-px shrink-0"
                style={{ background: 'var(--gold-mid)' }}
                aria-hidden
              />
              {toolItems.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  className={`${navLinkClass(isActive(item.href))} shrink-0`}
                >
                  <item.icon size={14} className="flex-shrink-0" />
                  <span className="hidden lg:inline whitespace-nowrap">{item.label}</span>
                </Link>
              ))}
              {/* Right ornament end-cap */}
              <span className="pr-1 pl-0.5 shrink-0" style={{ color: 'var(--gold-mid)' }}>
                <Star8 size={14} />
              </span>
            </div>
          </nav>

          {/* Right side — location + theme switcher + logout */}
          <div className="flex items-center gap-2 shrink-0">
            <LocationPicker compact onLocationChange={syncLocation} />
            <CompactThemeSwitcher />
            <button
              onClick={logout}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition"
              style={{
                color: 'var(--gold-deep)',
                border: '1px solid var(--gold-mid)',
                background:
                  'linear-gradient(180deg, var(--manuscript-cream) 0%, var(--manuscript-cream-2) 100%)',
              }}
              title="Logout"
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--gold-glow)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background =
                  'linear-gradient(180deg, var(--manuscript-cream) 0%, var(--manuscript-cream-2) 100%)'
              }}
            >
              <LogOut size={14} />
              <span className="hidden xl:inline">Logout</span>
            </button>
          </div>
        </div>
        {/* Bottom gold-leaf accent rule */}
        <div className="h-[2px] accent-bar-gold" />
      </header>

      {/* =========================== MOBILE TOP BAR =========================== */}
      <header
        className="md:hidden sticky top-0 z-40 shadow-md"
        style={{
          background:
            'linear-gradient(180deg, var(--manuscript-cream) 0%, var(--manuscript-cream-2) 100%)',
          borderBottom: '1px solid var(--gold-mid)',
        }}
      >
        <div className="h-[2px] accent-bar-gold" />
        <div className="flex items-center justify-between gap-2 px-4 py-2.5">
          <Link to="/" className="flex items-center gap-2.5">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden"
              style={{
                background:
                  'linear-gradient(135deg, var(--emerald-deep) 0%, var(--surface-deep-2) 100%)',
                border: '1px solid var(--gold-mid)',
              }}
            >
              <img
                src={Logo}
                alt="Islamic Life Companion"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex flex-col leading-tight">
              <span
                className="text-sm font-bold"
                style={{ color: 'var(--emerald-deep)' }}
              >
                Islamic Life
              </span>
              <span
                className="text-[9px] uppercase tracking-[0.18em] font-semibold"
                style={{ color: 'var(--gold-deep)' }}
              >
                Companion
              </span>
            </div>
          </Link>
          <div className="flex items-center gap-1.5">
            <LocationPicker compact onLocationChange={syncLocation} />
            <CompactThemeSwitcher />
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 rounded-lg transition"
              style={{
                color: 'var(--gold-deep)',
                border: '1px solid var(--gold-mid)',
                background: 'var(--manuscript-cream)',
              }}
              aria-label={showMenu ? 'Close menu' : 'Open menu'}
            >
              {showMenu ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </header>

      {/* =========================== MOBILE DROPDOWN =========================== */}
      {showMenu && (
        <div
          className="md:hidden sticky top-[64px] z-30 max-h-[calc(100vh-64px)] overflow-y-auto shadow-xl"
          style={{
            background:
              'linear-gradient(180deg, var(--manuscript-cream) 0%, var(--manuscript-cream-2) 100%)',
            borderBottom: '1px solid var(--gold-mid)',
          }}
        >
          <div className="px-3 pt-3">
            <GoldDivider />
          </div>
          <nav className="p-3 space-y-1">
            <div
              className="text-[10px] font-semibold uppercase tracking-[0.18em] px-4 py-2"
              style={{ color: 'var(--gold-deep)' }}
            >
              Main
            </div>
            {mainItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className={navRowClass(isActive(item.href))}
                onClick={() => setShowMenu(false)}
              >
                <item.icon size={16} />
                <span>{item.label}</span>
              </Link>
            ))}
            <div
              className="text-[10px] font-semibold uppercase tracking-[0.18em] px-4 py-2 pt-3 mt-2"
              style={{
                color: 'var(--gold-deep)',
                borderTop: '1px solid var(--gold-mid)',
              }}
            >
              Tools
            </div>
            {toolItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className={navRowClass(isActive(item.href))}
                onClick={() => setShowMenu(false)}
              >
                <item.icon size={16} />
                <span>{item.label}</span>
              </Link>
            ))}
            <button
              onClick={logout}
              className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition mt-2"
              style={{
                color: 'var(--gold-deep)',
                border: '1px solid var(--gold-mid)',
                background: 'var(--manuscript-cream)',
              }}
            >
              <LogOut size={16} />
              <span>Logout</span>
            </button>
          </nav>
        </div>
      )}
    </>
  )
}

export default TopNav
