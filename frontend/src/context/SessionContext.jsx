/* eslint-disable react-refresh/only-export-components -- context + hook + provider */
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
} from 'react'

export const SessionContext = createContext(null)

export function SessionProvider({
  children,
  session,
  backendData,
  setBackendData,
  testBackendConnection,
}) {
  const [userRole, setUserRole] = useState(null)

  useEffect(() => {
    if (!session) {
      setUserRole(null)
      return
    }

    setUserRole(null)

    let cancelled = false

    async function fetchMe() {
      try {
        const res = await fetch('/api/me', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })

        const text = await res.text()

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${text}`)
        }

        const data = JSON.parse(text)
        if (!cancelled) {
          setUserRole(data.user?.role ?? 'user')
        }
      } catch (err) {
        console.error('Failed to fetch /api/me for role:', err)
        if (!cancelled) {
          setUserRole('user')
        }
      }
    }

    fetchMe()

    return () => {
      cancelled = true
    }
  }, [session])

  const value = useMemo(
    () => ({
      session,
      userRole,
      backendData,
      setBackendData,
      testBackendConnection,
    }),
    [session, userRole, backendData, setBackendData, testBackendConnection],
  )

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  )
}

export function useSession() {
  const ctx = useContext(SessionContext)
  if (!ctx) {
    throw new Error('useSession must be used within SessionProvider')
  }
  return ctx
}
