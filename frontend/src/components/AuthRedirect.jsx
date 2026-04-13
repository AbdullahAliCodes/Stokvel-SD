import { Navigate } from 'react-router-dom'
import { useSession } from '../context/SessionContext'

export default function AuthRedirect() {
  const { session, userRole } = useSession()

  if (!session) {
    return <Navigate to="/auth" replace />
  }

  if (userRole === null || userRole === undefined) {
    return (
      <div className="flex h-screen items-center justify-center p-8 text-gray-500">
        Authenticating...
      </div>
    )
  }

  if (String(userRole).toLowerCase() === 'admin') {
    return <Navigate to="/admin" replace />
  }

  return <Navigate to="/dashboard" replace />
}
