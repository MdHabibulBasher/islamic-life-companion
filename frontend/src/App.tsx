import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuth } from './hooks'
import { TopNav } from './components/TopNav'
import { ToastContainer, useToast } from './components/Toast'
import { IslamicOrnamentBG } from './components/IslamicOrnamentBG'
import { Dashboard } from './pages/Dashboard'
import PrayerTrackerPage from './pages/PrayerTracker'
import { Calendar } from './pages/Calendar'
import { TodoPage } from './pages/TodoPage'
import { Login } from './pages/auth/Login'
import { Signup } from './pages/auth/Signup'
import { QuranReader } from './pages/QuranReader'
import { UserSettings } from './pages/Settings'
import { ChallengesPage } from './pages/Challenges'
import { Analytics } from './pages/Analytics'
import { ChallengeDetail } from './pages/ChallengeDetail'
import { Fasting } from './pages/Fasting'
import { useEffect } from 'react'
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

// App Shell — must be rendered INSIDE <Router> so we can call useLocation().
// This component owns the route-aware ornament + sidebar layout.
function AppShell() {
  const location = useLocation()
  // Auth routes get the stronger ornament + warm gradient wash. The check
  // is pathname-based so the effect is instant on navigation.
  const isAuthRoute =
    location.pathname === '/login' || location.pathname === '/signup'

  return (
    <div className="min-h-screen flex flex-col relative">
        {/* Auth-page ornament: stronger wash + warm gradient, sits behind
            the login/signup forms. Rendered only on /login and /signup so
            authenticated pages keep the subtle default wash. */}
        {isAuthRoute && <IslamicOrnamentBG intensity="auth" />}

        {/* Top navigation bar (replaces the old left sidebar). */}
        {!isAuthRoute && <TopNav />}

        {/* Main Content — no background here so the ornament layer (which
            lives at body level) shows through. Cards inside pages paint
            their own opaque white backgrounds, which sit above the
            ornament. */}
        <div className="flex-1 flex flex-col relative">
          {/* Main content scrollable area */}
          <main className="flex-1 overflow-auto relative">
            {/* Subtle ornament behind every authenticated page. */}
            {!isAuthRoute && <IslamicOrnamentBG intensity="default" />}
            {/* Page content — z-10 keeps cards above the ornament layer. */}
            <div className="relative z-10 min-h-full">
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
                path="/todo"
                element={
                  <ProtectedRoute>
                    <TodoPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/prayer-tracker"
                element={
                  <ProtectedRoute>
                    <PrayerTrackerPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/fasting"
                element={
                  <ProtectedRoute>
                    <Fasting />
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
                path="/challenges"
                element={
                  <ProtectedRoute>
                    <ChallengesPage />
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
              {/* Alerts/Notifications page temporarily disabled — redirect to home */}
              <Route
                path="/notifications"
                element={<Navigate to="/" />}
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
            </div>
          </main>
        </div>
      </div>
  )
}

// AppContent — owns the <Router> boundary so that route-aware hooks like
// useLocation() (used by AppShell below) work correctly. Also hosts the
// toast container and the light-mode effect.
function AppContent() {
  const { toasts, removeToast } = useToast()

  useEffect(() => {
    const html = document.documentElement
    // Force light mode
    html.classList.remove('dark')
    localStorage.setItem('theme', 'light')
  }, [])

  return (
    <Router>
      <AppShell />
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
