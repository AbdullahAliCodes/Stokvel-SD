import { Navigate, Outlet } from 'react-router-dom'

export default function RequireAuth({ session }) {
  if (!session) {
    return <Navigate to="/auth" replace />
  }
  return <Outlet />
}
