import { Navigate, Outlet } from 'react-router-dom'
import { useSession } from '../context/SessionContext'

export default function RequireAdmin() {
  const { userRole } = useSession()

  if (userRole === null || userRole === undefined) {
    return <div className="p-8">Loading authorization...</div>
  }

  if (userRole !== 'admin') {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
