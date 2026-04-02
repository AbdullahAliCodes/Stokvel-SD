import { createContext, useContext } from 'react'

export const SessionContext = createContext(null)

export function useSession() {
  const ctx = useContext(SessionContext)
  if (!ctx) {
    throw new Error('useSession must be used within SessionContext.Provider')
  }
  return ctx
}
