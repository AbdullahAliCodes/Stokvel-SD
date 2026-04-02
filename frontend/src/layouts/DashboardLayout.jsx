import { Link, NavLink, Outlet } from 'react-router-dom'
import {
  LayoutDashboard,
  Wallet,
  Calendar,
  LifeBuoy,
  Home,
  LogOut,
} from 'lucide-react'
import { supabase } from '../utils/supabase'

const linkClass = ({ isActive }) =>
  `flex items-center gap-2 border-b border-transparent px-3 py-2 text-sm hover:bg-gray-100 ${
    isActive ? 'border-black bg-gray-100 font-medium' : ''
  }`

export default function DashboardLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-white text-black md:flex-row">
      <aside className="flex w-full flex-col border-b border-black bg-white md:max-w-[220px] md:border-b-0 md:border-r">
        <div className="border-b border-black p-4 text-sm font-semibold">
          Sawubona Stokvel
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-2">
          <NavLink to="/dashboard" className={linkClass} end>
            <LayoutDashboard className="h-4 w-4 shrink-0" aria-hidden />
            Dashboard
          </NavLink>
          <NavLink to="/my-payout" className={linkClass}>
            <Wallet className="h-4 w-4 shrink-0" aria-hidden />
            My Payout
          </NavLink>
          <NavLink to="/meetings" className={linkClass}>
            <Calendar className="h-4 w-4 shrink-0" aria-hidden />
            Meetings
          </NavLink>
          <NavLink to="/support" className={linkClass}>
            <LifeBuoy className="h-4 w-4 shrink-0" aria-hidden />
            Support
          </NavLink>
        </nav>
        <Link
          to="/"
          className="mb-2 flex items-center gap-3 px-4 py-3 text-gray-600 transition-colors hover:bg-gray-100 hover:text-black"
        >
          <Home size={20} aria-hidden />
          <span className="font-medium">Back to Home</span>
        </Link>
        <div className="border-t border-black p-3">
          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 border border-black bg-white px-3 py-2 text-sm hover:bg-gray-100"
            onClick={() => supabase.auth.signOut()}
          >
            <LogOut className="h-4 w-4" aria-hidden />
            Log Out
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-6">
        <Outlet />
      </main>
    </div>
  )
}
