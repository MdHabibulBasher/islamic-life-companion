import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuth } from './hooks'
import { Sidebar } from './components/Sidebar'
import { ToastContainer, useToast } from './components/Toast'
import HabitTracker from './pages/HabitTracker'
import { Dashboard } from './pages/Dashboard'
import { PrayerTimes } from './pages/PrayerTimes'
import { Calendar } from './pages/Calendar'
import { TodoPage } from './pages/TodoPage'
import { Login } from './pages/auth/Login'
import { Signup } from './pages/auth/Signup'
import { QuranReader } from './pages/QuranReader'
import { UserSettings } from './pages/Settings'
import { Analytics } from './pages/Analytics'
import { ChallengeDetail } from './pages/ChallengeDetail'
import { Notifications } from './pages/Notifications'
import { useEffect, useState } from 'react'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes (formerly cacheTime)
    },
  },
})

// Protected Route Component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />
}

// Public Route Component
const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuth()
  return !isAuthenticated ? <>{children}</> : <Navigate to="/" />
}

// App Content wrapped with Router
function AppContent() {
  const { toasts, removeToast } = useToast()
  const [isDark] = useState(() => {
    // Force light mode for now
    return false
  })

  useEffect(() => {
    const html = document.documentElement
    // Force light mode
    html.classList.remove('dark')
    localStorage.setItem('theme', 'light')
  }, [])

  return (
    <Router>
      <div className="flex h-screen overflow-hidden bg-cream-50">
        {/* Sidebar */}
        <Sidebar />

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Mobile header spacing */}
          <div className="md:hidden h-16 bg-white dark:bg-slate-900"></div>

          {/* Main content scrollable area */}
          <main className="flex-1 overflow-auto">
            <Routes>
              {/* Public Routes */}
              <Route
                path="/login"
                element={
                  <PublicRoute>
                    <Login />
                  </PublicRoute>
                }
              />
              <Route
                path="/signup"
                element={
                  <PublicRoute>
                    <Signup />
                  </PublicRoute>
                }
              />

              {/* Protected Routes */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/calendar"
                element={
                  <ProtectedRoute>
                    <Calendar />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/habits"
                element={
                  <ProtectedRoute>
                    <HabitTracker />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/todo"
                element={
                  <ProtectedRoute>
                    <TodoPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/prayer-times"
                element={
                  <ProtectedRoute>
                    <PrayerTimes />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/quran"
                element={
                  <ProtectedRoute>
                    <QuranReader />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/analytics"
                element={
                  <ProtectedRoute>
                    <Analytics />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/challenges/:id"
                element={
                  <ProtectedRoute>
                    <ChallengeDetail />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/notifications"
                element={
                  <ProtectedRoute>
                    <Notifications />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <UserSettings />
                  </ProtectedRoute>
                }
              />

              {/* Catch all */}
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </main>
        </div>
      </div>

      <ToastContainer toasts={toasts} onClose={removeToast} />
    </Router>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  )
}

export default App
