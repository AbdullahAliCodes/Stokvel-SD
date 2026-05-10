import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import { Bell, X } from "lucide-react"
import { Link } from "react-router-dom"
import { useCallback, useState } from "react"
import { useDashboardChrome } from "../../context/DashboardChromeContext"

function dotClass(kind) {
  switch (kind) {
    case "gold":
      return "bg-[#B8860B]"
    case "amber":
      return "bg-amber-500"
    default:
      return "bg-[#2E7D32]"
  }
}

export function DashboardNotificationBell({ className = "" }) {
  const { unreadCount, drawerOpen, setDrawerOpen } = useDashboardChrome()
  const reduced = useReducedMotion()
  const [shaking, setShaking] = useState(false)

  const onBellClick = useCallback(() => {
    if (reduced) {
      setDrawerOpen(true)
      return
    }
    setShaking(true)
    window.setTimeout(() => {
      setShaking(false)
      setDrawerOpen(true)
    }, 380)
  }, [reduced, setDrawerOpen])

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
        onClick={onBellClick}
        className={`stkg-notif-bell stkg-btn flex h-10 w-10 items-center justify-center rounded-full border border-[#E0E8E0] bg-white text-[#1B5E20] transition-colors duration-200 hover:border-[#2E7D32] hover:bg-[#F8FAF8] ${shaking ? "stkg-notif-bell--shake" : ""}`}
      >
        <Bell className="stkg-notif-bell-icon h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
      </button>
      {unreadCount > 0 ? (
        <motion.span
          className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#C62828] px-1 text-[10px] font-semibold text-white"
          initial={reduced ? false : { scale: 0.85 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.32, 1] }}
        >
          {unreadCount > 9 ? "9+" : unreadCount}
        </motion.span>
      ) : null}
      <AnimatePresence>
        {drawerOpen ? (
          <NotificationDrawer onClose={() => setDrawerOpen(false)} />
        ) : null}
      </AnimatePresence>
    </div>
  )
}

function NotificationDrawer({ onClose }) {
  const { notifications, markAllRead } = useDashboardChrome()
  const reduced = useReducedMotion()

  return (
    <>
      <motion.button
        type="button"
        aria-label="Close notifications"
        className="fixed inset-0 z-[1000] bg-[#0A0A0A]/20 backdrop-blur-sm"
        initial={{ opacity: reduced ? 1 : 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: reduced ? 0 : 0.3 }}
        onClick={onClose}
      />
      <motion.aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="notif-drawer-title"
        className="fixed right-0 top-0 z-[1001] flex h-full w-full max-w-md flex-col border-l border-[#E0E8E0] bg-white/92 shadow-[-12px_0_48px_rgba(10,10,10,0.08)] backdrop-blur-md supports-[backdrop-filter]:bg-white/80"
        initial={{ x: reduced ? 0 : "100%" }}
        animate={{ x: 0 }}
        exit={{ x: reduced ? 0 : "100%" }}
        transition={{ duration: reduced ? 0 : 0.45, ease: [0.16, 1, 0.32, 1] }}
      >
        <div className="flex items-center justify-between border-b border-[#E0E8E0] px-6 py-4">
          <h2 id="notif-drawer-title" className="font-serif text-lg text-[#0A0A0A]">
            Alerts
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                markAllRead()
              }}
              className="text-xs font-medium uppercase tracking-[0.1em] text-[#2E7D32] transition-opacity hover:opacity-80"
            >
              Mark all read
            </button>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="rounded-full p-2 text-[#4A4A4A] transition-colors hover:bg-[#F8FAF8]"
            >
              <X className="h-5 w-5" strokeWidth={1.5} />
            </button>
          </div>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {notifications.length === 0 ? (
            <li className="py-12 text-center text-sm text-[#9E9E9E]">No alerts at this time.</li>
          ) : (
            notifications.map((n) => (
              <li
                key={n.id}
                className={`mb-3 rounded-lg border border-[#E0E8E0] bg-white px-4 py-3 transition-opacity duration-300 ${
                  !n.read ? "border-l-[3px] border-l-[#2E7D32]" : ""
                }`}
              >
                <div className="flex gap-3">
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dotClass(n.dot)}`}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-[#0A0A0A]">{n.title}</p>
                    <p className="mt-1 text-sm text-[#4A4A4A]">{n.detail}</p>
                    <p className="mt-2 text-[10px] uppercase tracking-[0.08em] text-[#9E9E9E]">
                      {n.time}
                    </p>
                    {n.actionLabel && n.actionTo ? (
                      <Link
                        to={n.actionTo}
                        className="mt-2 inline-block text-xs font-medium text-[#1B5E20] hover:underline"
                      >
                        {n.actionLabel}
                      </Link>
                    ) : null}
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
      </motion.aside>
    </>
  )
}
