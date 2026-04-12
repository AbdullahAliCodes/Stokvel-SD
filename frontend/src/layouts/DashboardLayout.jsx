import { Link, NavLink, Outlet } from 'react-router-dom'
import {
  LayoutDashboard,
  Wallet,
  Calendar,
  LifeBuoy,
  Home,
  LogOut,
  User,
} from 'lucide-react'
import { supabase } from '../utils/supabase'

const linkClass = ({ isActive }) =>
  `flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
    isActive
      ? 'bg-slate-800 font-medium text-white'
      : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
  }`

export default function DashboardLayout() {
  return (
    <div className="flex min-h-[calc(100vh-5rem)] flex-col gap-4 px-4 pb-8 pt-2 text-white md:flex-row md:px-8">
      <aside className="glass flex w-full flex-col md:max-w-[220px] md:shrink-0">
        <div className="border-b border-white/10 p-4">
          <div className="rounded bg-blue-600 py-2 text-center text-xs font-bold uppercase tracking-wide text-white">
            Member
          </div>
          <p className="mt-3 text-xs font-semibold text-slate-500">Sawubona Stokvel</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-2">
          <NavLink to="/dashboard" className={linkClass} end>
            <LayoutDashboard className="h-4 w-4 shrink-0 text-blue-400" aria-hidden />
            Dashboard
          </NavLink>
          <NavLink to="/account" className={linkClass}>
            <User className="h-4 w-4 shrink-0 text-violet-400" aria-hidden />
            Account
          </NavLink>
          <NavLink to="/my-payout" className={linkClass}>
            <Wallet className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
            My Payouts
          </NavLink>
          <NavLink to="/meetings" className={linkClass}>
            <Calendar className="h-4 w-4 shrink-0 text-cyan-400" aria-hidden />
            Meetings
          </NavLink>
          <NavLink to="/support" className={linkClass}>
            <LifeBuoy className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
            Support
          </NavLink>
        </nav>
        <Link
          to="/"
          className="mx-2 mb-2 flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-400 transition hover:bg-white/5 hover:text-white"
        >
          <Home className="h-4 w-4" aria-hidden />
          Back to Home
        </Link>
        <div className="border-t border-white/10 p-3">
          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/5 py-2 text-sm text-slate-200 transition hover:bg-white/10"
            onClick={() => supabase.auth.signOut()}
          >
            <LogOut className="h-4 w-4" aria-hidden />
            Log Out
          </button>
        </div>
      </aside>
      <main className="glass min-w-0 flex-1 p-6 md:p-8">
        <Outlet />
      </main>
    </div>
  )
}
