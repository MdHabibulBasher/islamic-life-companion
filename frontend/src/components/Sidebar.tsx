import { Link, useLocation } from 'react-router-dom'
import { Menu, LogOut, Home, Settings, Bell, BarChart3, BookOpen, Target, X, Calendar, CheckSquare, Clock } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../hooks'

export const Sidebar = () => {
  const { isAuthenticated, logout } = useAuth()
  const [showMenu, setShowMenu] = useState(false)
  const location = useLocation()

  const menuItems = [
    { label: 'Dashboard', href: '/', icon: Home },
    { label: 'Calendar', href: '/calendar', icon: Calendar },
    { label: 'Habit Tracker', href: '/habits', icon: Target },
    { label: 'To-Do', href: '/todo', icon: CheckSquare },
    { label: 'Prayer Times', href: '/prayer-times', icon: Clock },
    { label: 'Quran', href: '/quran', icon: BookOpen },
  ]

  const isActive = (href: string) => {
    return location.pathname === href || (href === '/' && location.pathname === '/')
  }

  if (!isAuthenticated) {
    return null
  }

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-72 bg-white border-r border-sage-200 h-screen sticky top-0 shadow-soft">
        {/* Header */}
        <div className="p-8 border-b border-sage-200">
          <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition">
            <div className="w-12 h-12 bg-gradient-to-br from-sage-400 to-sage-600 rounded-xl flex items-center justify-center shadow-soft">
              <span className="text-2xl">🕌</span>
            </div>
            <div className="flex flex-col">
              <span className="text-base font-semibold text-sage-800">Islamic Life</span>
              <span className="text-xs text-sage-500">Companion</span>
            </div>
          </Link>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          <div className="text-xs font-semibold text-sage-500 uppercase tracking-wider px-4 py-3">Main</div>
          {menuItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 ${
                isActive(item.href)
                  ? 'bg-mint-100 text-mint-700 font-medium'
                  : 'text-sage-700 hover:bg-sage-50'
              }`}
            >
              <item.icon size={18} className="flex-shrink-0" />
              <span className="text-sm">{item.label}</span>
              {isActive(item.href) && <div className="ml-auto w-1.5 h-1.5 bg-mint-500 rounded-full"></div>}
            </Link>
          ))}
        </nav>

        {/* Bottom Section */}
        <div className="border-t border-sage-200 p-4 space-y-1">
          <div className="text-xs font-semibold text-sage-500 uppercase tracking-wider px-4 py-3">Tools</div>
          <Link
            to="/analytics"
            className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 ${
              isActive('/analytics')
                ? 'bg-sage-100 text-sage-700 font-medium'
                : 'text-sage-700 hover:bg-sage-50'
            }`}
          >
            <BarChart3 size={18} className="flex-shrink-0" />
            <span className="text-sm">Analytics</span>
            {isActive('/analytics') && <div className="ml-auto w-1.5 h-1.5 bg-sage-500 rounded-full"></div>}
          </Link>
          <Link
            to="/notifications"
            className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 ${
              isActive('/notifications')
                ? 'bg-coral-100 text-coral-700 font-medium'
                : 'text-sage-700 hover:bg-sage-50'
            }`}
          >
            <Bell size={18} className="flex-shrink-0" />
            <span className="text-sm">Notifications</span>
            {isActive('/notifications') && <div className="ml-auto w-1.5 h-1.5 bg-coral-500 rounded-full"></div>}
          </Link>
          <Link
            to="/settings"
            className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 ${
              isActive('/settings')
                ? 'bg-sage-100 text-sage-700 font-medium'
                : 'text-sage-700 hover:bg-sage-50'
            }`}
          >
            <Settings size={18} className="flex-shrink-0" />
            <span className="text-sm">Settings</span>
            {isActive('/settings') && <div className="ml-auto w-1.5 h-1.5 bg-sage-500 rounded-full"></div>}
          </Link>
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sage-700 hover:bg-coral-50 hover:text-coral-700 transition-all duration-200 mt-2 border border-sage-200 hover:border-coral-200 text-sm"
          >
            <LogOut size={18} className="flex-shrink-0" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden bg-white text-sage-800 fixed top-0 left-0 right-0 z-50 flex items-center justify-between p-4 shadow-soft border-b border-sage-200">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-10 h-10 bg-gradient-to-br from-sage-400 to-sage-600 rounded-xl flex items-center justify-center">
            <span className="text-xl">🕌</span>
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">Islamic Life</span>
            <span className="text-xs text-sage-500">Companion</span>
          </div>
        </Link>
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="p-2 hover:bg-sage-100 rounded-lg transition"
        >
          {showMenu ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Menu */}
      {showMenu && (
        <div className="md:hidden fixed top-16 left-0 right-0 bg-white shadow-soft z-40 max-h-[calc(100vh-64px)] overflow-y-auto border-b border-sage-200">
          <nav className="p-4 space-y-1">
            <div className="text-xs font-semibold text-sage-500 uppercase tracking-wider px-4 py-3">Main</div>
            {menuItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all ${
                  isActive(item.href)
                    ? 'bg-mint-100 text-mint-700'
                    : 'text-sage-700 hover:bg-sage-50'
                }`}
                onClick={() => setShowMenu(false)}
              >
                <item.icon size={18} />
                <span className="text-sm">{item.label}</span>
              </Link>
            ))}
            <div className="border-t border-sage-200 my-2 pt-2 space-y-1">
              <div className="text-xs font-semibold text-sage-500 uppercase tracking-wider px-4 py-3">Tools</div>
              <Link
                to="/analytics"
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all ${
                  isActive('/analytics')
                    ? 'bg-sage-100 text-sage-700'
                    : 'text-sage-700 hover:bg-sage-50'
                }`}
                onClick={() => setShowMenu(false)}
              >
                <BarChart3 size={18} />
                <span className="text-sm">Analytics</span>
              </Link>
              <Link
                to="/notifications"
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all ${
                  isActive('/notifications')
                    ? 'bg-coral-100 text-coral-700'
                    : 'text-sage-700 hover:bg-sage-50'
                }`}
                onClick={() => setShowMenu(false)}
              >
                <Bell size={18} />
                <span className="text-sm">Notifications</span>
              </Link>
              <Link
                to="/settings"
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all ${
                  isActive('/settings')
                    ? 'bg-sage-100 text-sage-700'
                    : 'text-sage-700 hover:bg-sage-50'
                }`}
                onClick={() => setShowMenu(false)}
              >
                <Settings size={18} />
                <span className="text-sm">Settings</span>
              </Link>
              <button
                onClick={() => {
                  logout()
                  setShowMenu(false)
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sage-700 hover:bg-coral-50 hover:text-coral-700 transition-all mt-2 border border-sage-200 text-sm"
              >
                <LogOut size={18} />
                <span>Logout</span>
              </button>
            </div>
          </nav>
        </div>
      )}
    </>
  )
}
