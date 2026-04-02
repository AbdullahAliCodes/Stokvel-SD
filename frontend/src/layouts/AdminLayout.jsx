import { Link, NavLink, Outlet } from 'react-router-dom'
import {
  Users,
  ShieldCheck,
  Ticket,
  FileBarChart,
  PlusCircle,
  Home,
  LogOut,
} from 'lucide-react'
import { supabase } from '../utils/supabase'

const linkClass = ({ isActive }) =>
  `flex items-center gap-2 border-b border-transparent px-3 py-2 text-sm hover:bg-gray-100 ${
    isActive ? 'border-black bg-gray-100 font-medium' : ''
  }`

export default function AdminLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-white text-black md:flex-row">
      <aside className="flex w-full flex-col border-b border-black bg-white md:max-w-[240px] md:border-b-0 md:border-r md:min-h-screen">
        <div className="border-b border-black p-4 text-sm font-semibold">
          Admin
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
          <span className="px-3 py-1 text-xs font-semibold uppercase text-gray-600">
            Menu
          </span>
          <NavLink to="/admin/groups" className={linkClass}>
            <Users className="h-4 w-4 shrink-0" aria-hidden />
            Active Groups
          </NavLink>
          <NavLink to="/admin" className={linkClass} end>
            <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden />
            Group Verifications
          </NavLink>
          <NavLink to="/admin/tickets" className={linkClass}>
            <Ticket className="h-4 w-4 shrink-0" aria-hidden />
            Issue Tickets
          </NavLink>
          <NavLink to="/admin/reports" className={linkClass}>
            <FileBarChart className="h-4 w-4 shrink-0" aria-hidden />
            Reports
          </NavLink>
          <NavLink to="/admin/create-group" className={linkClass}>
            <PlusCircle className="h-4 w-4 shrink-0" aria-hidden />
            CREATE GROUP
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
