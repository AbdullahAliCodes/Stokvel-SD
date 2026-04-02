import { Link, Outlet } from 'react-router-dom'
import { useSession } from '../context/SessionContext'

export default function PublicLayout() {
  const { session } = useSession()

  return (
    <div className="min-h-screen bg-white text-black">
      <nav className="flex items-center justify-between border-b border-black px-4 py-3">
        <Link to="/" className="text-lg font-semibold tracking-tight">
          Sawubona Stokvel
        </Link>
        {!session ? (
          <Link
            to="/auth"
            className="border border-black bg-white px-4 py-2 text-sm hover:bg-gray-100"
          >
            Log In / Sign Up
          </Link>
        ) : (
          <Link
            to="/dashboard"
            className="border border-black bg-white px-4 py-2 text-sm hover:bg-gray-100"
          >
            Dashboard
          </Link>
        )}
      </nav>
      <Outlet />
    </div>
  )
}
