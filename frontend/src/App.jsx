import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom'
import { supabase } from './utils/supabase'
import { SessionContext } from './context/SessionContext'
import RequireAuth from './components/RequireAuth'
import Auth from './components/Auth'
import PublicLayout from './layouts/PublicLayout'
import DashboardLayout from './layouts/DashboardLayout'
import AdminLayout from './layouts/AdminLayout'
import Home from './pages/Home'
import Apply from './pages/Apply'
import AdminDashboard from './pages/AdminDashboard'
import AdminPlaceholder from './pages/AdminPlaceholder'
import StokvelDashboard from './pages/StokvelDashboard'
import Meetings from './pages/Meetings'
import MyPayout from './pages/MyPayout'
import Support from './pages/Support'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [backendData, setBackendData] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: initial } }) => {
      setSession(initial)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })

    return () => subscription.unsubscribe()
  }, [])

  const testBackendConnection = useCallback(async () => {
    if (!session) {
      setBackendData({ error: 'No session' })
      return
    }
    try {
      const res = await fetch('/api/me', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      const text = await res.text()

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${text}`)
      }

      const data = JSON.parse(text)
      setBackendData(data)
    } catch (err) {
      setBackendData({ error: err.message })
    }
  }, [session])

  const sessionContextValue = useMemo(
    () => ({
      session,
      backendData,
      setBackendData,
      testBackendConnection,
    }),
    [session, backendData, testBackendConnection],
  )

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-black">
        <p className="text-sm">Loading…</p>
      </div>
    )
  }

  return (
    <SessionContext.Provider value={sessionContextValue}>
      <BrowserRouter>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Home />} />
            <Route
              path="/auth"
              element={
                session ? (
                  <Navigate to="/dashboard" replace />
                ) : (
                  <Auth />
                )
              }
            />
          </Route>

          <Route element={<RequireAuth session={session} />}>
            <Route element={<DashboardLayout />}>
              <Route path="/dashboard" element={<StokvelDashboard />} />
              <Route path="/meetings" element={<Meetings />} />
              <Route path="/apply" element={<Apply />} />
              <Route path="/my-payout" element={<MyPayout />} />
              <Route path="/support" element={<Support />} />
            </Route>

            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route
                path="groups"
                element={<AdminPlaceholder title="Active Groups" />}
              />
              <Route
                path="tickets"
                element={<AdminPlaceholder title="Issue Tickets" />}
              />
              <Route
                path="reports"
                element={<AdminPlaceholder title="Reports" />}
              />
              <Route
                path="create-group"
                element={<AdminPlaceholder title="Create Group" />}
              />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </SessionContext.Provider>
  )
}
