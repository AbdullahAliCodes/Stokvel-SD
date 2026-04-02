import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'
import Auth from './components/Auth'

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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-black">
        <p className="text-sm">Loading…</p>
      </div>
    )
  }

  if (!session) {
    return <Auth />
  }

  const email = session.user?.email ?? 'User'

  const testBackendConnection = async () => {
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
  }

  return (
    <div className="min-h-screen bg-white p-8 text-black">
      <div className="mx-auto max-w-lg border border-black p-4">
        <h1 className="mb-6 text-2xl font-semibold">Dashboard</h1>
        <p className="mb-6">Welcome, {email}</p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="bg-black px-4 py-2 text-white hover:bg-gray-800"
            onClick={() => supabase.auth.signOut()}
          >
            Log Out
          </button>
          <button
            type="button"
            className="border border-black bg-white px-4 py-2 text-black hover:bg-gray-200"
            onClick={testBackendConnection}
          >
            Test Secure Backend
          </button>
        </div>
        {backendData != null ? (
          <pre className="mt-4 overflow-auto border border-black bg-gray-100 p-4 text-sm">
            {JSON.stringify(backendData, null, 2)}
          </pre>
        ) : null}
      </div>
    </div>
  )
}
