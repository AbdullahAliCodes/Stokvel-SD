import { useState, useEffect, useCallback } from 'react'
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom'
import { supabase } from './utils/supabase'
import { SessionProvider } from './context/SessionContext'
import RequireAuth from './components/RequireAuth'
import RequireAdmin from './components/RequireAdmin'
import Auth from './components/Auth'
import PublicLayout from './layouts/PublicLayout'
import DashboardLayout from './layouts/DashboardLayout'
import AdminLayout from './layouts/AdminLayout'
import Home from './pages/Home'
import Apply from './pages/Apply'
import AdminDashboard from './pages/AdminDashboard'
import AdminPlaceholder from './pages/AdminPlaceholder'
import AdminCreateStokvel from './pages/AdminCreateStokvel'
import AdminGroups from './pages/AdminGroups'
import AdminEditStokvel from './pages/AdminEditStokvel'
import Account from './pages/Account'
import StokvelDashboard from './pages/StokvelDashboard'
import SingleStokvel from './pages/SingleStokvel'
import Meetings from './pages/Meetings'
import MeetingDetails from './pages/MeetingDetails'
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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f172a] text-slate-300">
        <p className="text-sm tracking-wide">Loading…</p>
      </div>
    )
  }

  return (
    <SessionProvider
      session={session}
      backendData={backendData}
      setBackendData={setBackendData}
      testBackendConnection={testBackendConnection}
    >
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
              <Route path="/stokvels/:id" element={<SingleStokvel />} />
              <Route path="/meetings/:id" element={<MeetingDetails />} />
              <Route path="/meetings" element={<Meetings />} />
              <Route path="/apply" element={<Apply />} />
              <Route path="/my-payout" element={<MyPayout />} />
              <Route path="/support" element={<Support />} />
              <Route path="/account" element={<Account />} />
            </Route>

            <Route element={<RequireAdmin />}>
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<AdminDashboard />} />
                <Route path="groups" element={<AdminGroups />} />
                <Route path="groups/:id/edit" element={<AdminEditStokvel />} />
                <Route
                  path="tickets"
                  element={<AdminPlaceholder title="Issue Tickets" />}
                />
                <Route
                  path="reports"
                  element={<AdminPlaceholder title="Reports" />}
                />
                <Route path="create-group" element={<AdminCreateStokvel />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </SessionProvider>
  )
}
