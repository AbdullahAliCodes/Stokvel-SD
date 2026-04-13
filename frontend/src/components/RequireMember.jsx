import { Navigate, Outlet } from 'react-router-dom'
import { useSession } from '../context/SessionContext'

export default function RequireMember() {
  const { userRole } = useSession()

  if (userRole === null || userRole === undefined) {
    return (
      <div className="flex h-screen items-center justify-center p-8 text-gray-500">
        Loading your dashboard...
      </div>
    )
  }

  if (String(userRole).toLowerCase() === 'admin') {
    return <Navigate to="/admin" replace />
  }

  return <Outlet />
}
