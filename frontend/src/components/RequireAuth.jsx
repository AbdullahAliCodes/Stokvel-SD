import { Navigate, Outlet } from 'react-router-dom'

export default function RequireAuth({ session, authReady }) {
  if (!authReady) {
    return <Outlet />
  }
  if (!session) {
    return <Navigate to="/auth" replace />
  }
  return <Outlet />
}
