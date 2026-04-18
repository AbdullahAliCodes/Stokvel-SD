import { Navigate, Outlet } from 'react-router-dom'
import { useSession } from '../context/SessionContext'

export default function RequireAdmin() {
  const { userRole } = useSession()

  if (userRole === null || userRole === undefined) {
    return (
      <div className="flex h-dvh items-center justify-center overflow-hidden bg-[#0f172a] text-slate-400">
        <p className="text-sm">Loading authorization…</p>
      </div>
    )
  }

  if (String(userRole || '').toLowerCase() !== 'admin') {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
