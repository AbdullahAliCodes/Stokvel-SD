import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'
import Auth from './components/Auth'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

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

  return (
    <div className="min-h-screen bg-white p-8 text-black">
      <div className="mx-auto max-w-lg border border-black p-4">
        <h1 className="mb-6 text-2xl font-semibold">Dashboard</h1>
        <p className="mb-6">Welcome, {email}</p>
        <button
          type="button"
          className="bg-black px-4 py-2 text-white hover:bg-gray-800"
          onClick={() => supabase.auth.signOut()}
        >
          Log Out
        </button>
      </div>
    </div>
  )
}
