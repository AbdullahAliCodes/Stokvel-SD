import { Link, NavLink, Outlet } from 'react-router-dom'
import {
  LayoutDashboard,
  Wallet,
  Calendar,
  LifeBuoy,
  Home,
  LogOut,
  User,
  UserPlus,
} from 'lucide-react'
import { supabase } from '../utils/supabase'

const linkClass = ({ isActive }) =>
  `flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
    isActive
      ? 'bg-emerald-50 font-semibold text-emerald-800'
      : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
  }`

export default function DashboardLayout() {
  return (
    <div className="box-border flex h-dvh min-h-0 w-full flex-col gap-3 overflow-hidden bg-[#F4F5F0] p-3 text-stone-800 md:flex-row md:gap-4 md:p-4">
      <aside className="flex w-full shrink-0 flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm md:h-full md:w-[220px] md:min-w-[220px] md:max-w-[220px]">
        <div className="shrink-0 border-b border-stone-200 p-4">
          <div className="rounded-lg bg-emerald-800 py-2 text-center text-xs font-bold uppercase tracking-wide text-white">
            Member
          </div>
          <p className="mt-3 text-xs font-semibold text-stone-500">Sawubona Stokvel</p>
        </div>
        <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-2">
          <NavLink to="/dashboard" className={linkClass} end>
            <LayoutDashboard className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden />
            Dashboard
          </NavLink>
          <NavLink to="/apply" className={linkClass}>
            <UserPlus className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden />
            Apply to stokvel
          </NavLink>
          <NavLink to="/account" className={linkClass}>
            <User className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden />
            Account
          </NavLink>
          <NavLink to="/my-payout" className={linkClass}>
            <Wallet className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden />
            My Payouts
          </NavLink>
          <NavLink to="/meetings" className={linkClass}>
            <Calendar className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden />
            Meetings
          </NavLink>
          <NavLink to="/support" className={linkClass}>
            <LifeBuoy className="h-4 w-4 shrink-0 text-stone-500" aria-hidden />
            Support
          </NavLink>
        </nav>
        <Link
          to="/home"
          className="mx-2 mb-2 shrink-0 flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-stone-600 transition hover:bg-stone-100 hover:text-stone-900"
        >
          <Home className="h-4 w-4" aria-hidden />
          Back to Home
        </Link>
        <div className="shrink-0 border-t border-stone-200 p-3">
          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-stone-200 bg-stone-50 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-100"
            onClick={() => supabase.auth.signOut()}
          >
            <LogOut className="h-4 w-4" aria-hidden />
            Log Out
          </button>
        </div>
      </aside>
      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-y-contain rounded-2xl border border-stone-200 bg-white p-6 shadow-sm md:p-8">
        <Outlet />
      </main>
    </div>
  )
}
