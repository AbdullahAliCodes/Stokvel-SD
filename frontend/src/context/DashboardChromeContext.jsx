import { createContext, useCallback, useContext, useMemo, useState } from "react"

const DashboardChromeContext = createContext(null)

export function DashboardChromeProvider({ children }) {
  const [notifications, setNotifications] = useState([])
  const [drawerOpen, setDrawerOpen] = useState(false)

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  )

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }, [])

  const value = useMemo(
    () => ({
      notifications,
      setNotifications,
      drawerOpen,
      setDrawerOpen,
      unreadCount,
      markAllRead,
    }),
    [notifications, drawerOpen, unreadCount, markAllRead],
  )

  return (
    <DashboardChromeContext.Provider value={value}>
      {children}
    </DashboardChromeContext.Provider>
  )
}

export function useDashboardChrome() {
  const ctx = useContext(DashboardChromeContext)
  if (!ctx) {
    return {
      notifications: [],
      setNotifications: () => {},
      drawerOpen: false,
      setDrawerOpen: () => {},
      unreadCount: 0,
      markAllRead: () => {},
    }
  }
  return ctx
}
