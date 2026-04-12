/* eslint-disable react-refresh/only-export-components -- context + hook + provider */
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
} from 'react'
import { apiUrl } from '../utils/api'

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
        const res = await fetch(apiUrl('/api/me'), {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })

        const text = await res.text()

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${text}`)
        }

        const data = JSON.parse(text)
        if (!cancelled) {
          const r = data.user?.role ?? 'user'
          setUserRole(String(r).toLowerCase() === 'admin' ? 'admin' : r)
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
