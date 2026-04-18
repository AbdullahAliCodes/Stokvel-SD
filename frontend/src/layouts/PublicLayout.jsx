import { Link, Outlet } from 'react-router-dom'
import { useSession } from '../context/SessionContext'

export default function PublicLayout() {
  const { session, userRole } = useSession()
  const isAdmin = String(userRole || '').toLowerCase() === 'admin'

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-[#0f172a] text-white">
      <nav className="glass z-10 mx-4 mt-4 shrink-0 flex items-center justify-between rounded-2xl px-4 py-3 md:mx-8">
        <Link
          to={!session ? '/' : isAdmin ? '/admin/groups' : '/home'}
          className="text-lg font-bold tracking-tight text-cyan-400 transition hover:text-cyan-300"
        >
          Sawubona Stokvel
        </Link>
        {!session ? (
          <Link
            to="/auth"
            className="rounded-lg border border-cyan-400/40 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-400/20"
          >
            Log In / Sign Up
          </Link>
        ) : (
          <Link
            to={isAdmin ? '/admin/groups' : '/dashboard'}
            className="rounded-lg border border-blue-400/40 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-300 transition hover:bg-blue-500/20"
          >
            {isAdmin ? 'Admin Dashboard' : 'Dashboard'}
          </Link>
        )}
      </nav>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
        <Outlet />
      </div>
    </div>
  )
}
