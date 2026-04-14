import { NavLink, Outlet } from 'react-router-dom'
import {
  Users,
  ShieldCheck,
  Ticket,
  FileBarChart,
  PlusCircle,
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

export default function AdminLayout() {
  return (
    <div className="flex min-h-[calc(100vh-5rem)] flex-col gap-4 px-4 pb-8 pt-2 text-white md:flex-row md:px-8">
      <aside className="glass flex w-full flex-col border-t-4 border-cyan-500 md:max-w-[240px] md:shrink-0">
        <div className="border-b border-white/10 p-4">
          <div className="rounded bg-cyan-600 py-2 text-center text-xs font-bold uppercase tracking-wide text-white">
            Admin
          </div>
          <p className="mt-3 text-xs font-semibold text-slate-500">Control panel</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
          <span className="px-3 py-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Menu
          </span>
          <NavLink to="/admin/groups" className={linkClass}>
            <Users className="h-4 w-4 shrink-0 text-cyan-400" aria-hidden />
            Group Config
          </NavLink>
          <NavLink to="/admin" className={linkClass} end>
            <ShieldCheck className="h-4 w-4 shrink-0 text-blue-400" aria-hidden />
            User Verifications
          </NavLink>
          <NavLink to="/admin/tickets" className={linkClass}>
            <Ticket className="h-4 w-4 shrink-0 text-red-400" aria-hidden />
            Issue Tickets
          </NavLink>
          <NavLink to="/admin/reports" className={linkClass}>
            <FileBarChart className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
            Logs (CI/CD)
          </NavLink>
          <NavLink to="/admin/create-group" className={linkClass}>
            <PlusCircle className="h-4 w-4 shrink-0 text-white" aria-hidden />
            Create New Group
          </NavLink>
          <NavLink to="/admin/account" className={linkClass}>
            <User className="h-4 w-4 shrink-0 text-violet-400" aria-hidden />
            Account
          </NavLink>
        </nav>
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
      <main className="glass min-w-0 flex-1 border-t-4 border-cyan-500 p-6 md:p-8">
        <Outlet />
      </main>
    </div>
  )
}
