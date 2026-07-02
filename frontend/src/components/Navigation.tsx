import { useAuth } from '../hooks'
import { Link } from 'react-router-dom'
import { Menu, LogOut, Home, Settings, Bell, Target } from 'lucide-react'
import { useState } from 'react'

export const Navigation = () => {
  const { isAuthenticated, logout } = useAuth()
  const [showMenu, setShowMenu] = useState(false)

  const menuItems = [
    { label: 'Habits', href: '/', icon: Target },
    { label: 'Dashboard', href: '/dashboard', icon: Home },
    { label: 'Prayer Times', href: '/prayer-times', icon: '🕌' },
    { label: 'Tracker', href: '/prayer-tracker', icon: '✅' },
  ]

  return (
    <nav className="bg-white dark:bg-gray-900 shadow-lg sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 text-xl font-bold text-green-600">
            <span className="text-2xl">🕌</span>
            Islamic Life
          </Link>

          {/* Desktop Menu */}
          {isAuthenticated && (
            <div className="hidden md:flex gap-8 items-center">
              {menuItems.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  className="text-gray-700 dark:text-gray-300 hover:text-green-600 transition-colors text-sm font-medium flex items-center gap-1"
                >
                  {typeof item.icon === 'string' ? item.icon : <item.icon size={16} />}
                  {item.label}
                </Link>
              ))}
            </div>
          )}

          {/* Right side items */}
          <div className="flex items-center gap-4">
            {isAuthenticated && (
              <>
                <Link
                  to="/notifications"
                  className="relative p-2 text-gray-700 dark:text-gray-300 hover:text-green-600 transition-colors"
                >
                  <Bell size={20} />
                </Link>
                <Link
                  to="/settings"
                  className="p-2 text-gray-700 dark:text-gray-300 hover:text-green-600 transition-colors"
                >
                  <Settings size={20} />
                </Link>
              </>
            )}

            {!isAuthenticated && (
              <div className="hidden md:flex gap-4">
                <Link
                  to="/login"
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-green-600 transition-colors"
                >
                  Login
                </Link>
                <Link
                  to="/signup"
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Sign Up
                </Link>
              </div>
            )}

            {/* Mobile Menu Button */}
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="md:hidden p-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
            >
              <Menu size={24} />
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {showMenu && (
          <div className="md:hidden pb-4 space-y-2">
            {isAuthenticated && (
              <>
                {menuItems.map((item) => (
                  <Link
                    key={item.href}
                    to={item.href}
                    className="block px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                    onClick={() => setShowMenu(false)}
                  >
                    {typeof item.icon === 'string' ? item.icon : <item.icon size={16} className="inline mr-2" />}
                    {item.label}
                  </Link>
                ))}
                <Link
                  to="/notifications"
                  className="block px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                  onClick={() => setShowMenu(false)}
                >
                  🔔 Notifications
                </Link>
                <Link
                  to="/settings"
                  className="block px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                  onClick={() => setShowMenu(false)}
                >
                  ⚙️ Settings
                </Link>
                <button
                  onClick={() => {
                    logout()
                    setShowMenu(false)
                  }}
                  className="w-full text-left px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg flex items-center gap-2"
                >
                  <LogOut size={16} />
                  Logout
                </button>
              </>
            )}
            {!isAuthenticated && (
              <>
                <Link
                  to="/login"
                  className="block px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                  onClick={() => setShowMenu(false)}
                >
                  Login
                </Link>
                <Link
                  to="/signup"
                  className="block px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  onClick={() => setShowMenu(false)}
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  )
}
