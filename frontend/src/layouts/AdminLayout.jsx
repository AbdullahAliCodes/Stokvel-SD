import { NavLink, Outlet, useNavigate } from "react-router-dom";
import BrandLogo from "../components/BrandLogo";
import { Users, Ticket, PlusCircle, LogOut, User } from "lucide-react";
import { supabase } from "../utils/supabase";
import { cardLight } from "../ui";

const linkClass = ({ isActive }) =>
  `flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
    isActive
      ? "bg-emerald-100 font-medium text-emerald-900"
      : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
  }`;

export default function AdminLayout() {
  const navigate = useNavigate();

  return (
    <div className="box-border flex h-dvh min-h-0 w-full flex-col gap-3 overflow-hidden bg-[#F4F5F0] p-3 text-stone-800 md:flex-row md:gap-4 md:p-4">
      <aside
        className={`${cardLight} flex w-full shrink-0 flex-col overflow-hidden border-t-4 border-emerald-700 md:h-full md:w-[240px] md:min-w-[240px] md:max-w-[240px]`}
      >
        <div className="shrink-0 border-b border-stone-200 p-4">
          <div className="rounded-lg bg-emerald-800 py-2 text-center text-xs font-bold uppercase tracking-wide text-white">
            Admin
          </div>
          <div className="mt-3 flex justify-center">
            <BrandLogo to="/admin/groups" imgClassName="h-10 w-auto md:h-12" />
          </div>
          <p className="mt-2 text-center text-xs font-semibold text-stone-500">
            Control panel
          </p>
        </div>
        <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-2">
          <span className="px-3 py-1 text-xs font-semibold uppercase tracking-wider text-stone-500">
            Menu
          </span>
          <NavLink to="/admin/groups" className={linkClass}>
            <Users className="h-4 w-4 shrink-0 text-emerald-800" aria-hidden />
            Group Config
          </NavLink>
          <NavLink to="/admin/tickets" className={linkClass}>
            <Ticket className="h-4 w-4 shrink-0 text-red-700" aria-hidden />
            Issue Tickets
          </NavLink>
          <NavLink to="/admin/create-group" className={linkClass}>
            <PlusCircle
              className="h-4 w-4 shrink-0 text-stone-800"
              aria-hidden
            />
            Create New Group
          </NavLink>
          <NavLink to="/admin/account" className={linkClass}>
            <User className="h-4 w-4 shrink-0 text-stone-700" aria-hidden />
            Account
          </NavLink>
        </nav>
        <div className="shrink-0 border-t border-stone-200 p-3">
          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-stone-300 bg-white py-2 text-sm font-medium text-stone-700 shadow-sm transition hover:bg-stone-100"
            onClick={async () => {
              await supabase.auth.signOut();
              navigate("/", { replace: true });
            }}
          >
            <LogOut className="h-4 w-4" aria-hidden />
            Log Out
          </button>
        </div>
      </aside>
      <main
        className={`${cardLight} min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-y-contain border-t-4 border-emerald-700 p-6 md:p-8`}
      >
        <Outlet />
      </main>
    </div>
  );
}
