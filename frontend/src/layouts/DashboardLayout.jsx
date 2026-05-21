import { useEffect, useMemo, useState } from "react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import BrandLogo from "../components/BrandLogo";
import ThemeToggle from "../components/ThemeToggle";
import SkeletonPage from "../components/ui/SkeletonPage";
import {
  LayoutDashboard,
  Wallet,
  Calendar,
  LifeBuoy,
  Home,
  LogOut,
  User,
  UserPlus,
  ClipboardList,
  Settings,
  Shield,
  BarChart3,
  HeartPulse,
  Menu,
  X,
} from "lucide-react";
import { supabase } from "../utils/supabase";
import { useSession } from "../context/SessionContext";
import { apiUrl } from "../utils/api";
import { readViewCache, writeViewCache } from "../utils/viewCache";
import {
  myStokvelsCacheKey,
  stokvelStatusOf,
} from "../utils/stokvelMembership";
const CACHE_TTL_MS = 180000;

const linkClass = ({ isActive }) =>
  `flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
    isActive
      ? "bg-emerald-50 font-semibold text-emerald-800 dark:bg-emerald-900/35 dark:text-emerald-100"
      : "text-stone-600 hover:bg-stone-100 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-slate-800 dark:hover:text-stone-100"
  }`;

function membershipStokvelId(m) {
  if (m?.stokvel_id != null && String(m.stokvel_id).length)
    return String(m.stokvel_id);
  return m?.stokvels?.id != null ? String(m.stokvels.id) : null;
}

function roleBadgeForGroupRole(groupRole) {
  const r = String(groupRole ?? "")
    .trim()
    .toLowerCase();
  if (r === "treasurer")
    return { label: "Treasurer", className: "bg-slate-700 text-white" };
  if (r === "admin")
    return { label: "Admin", className: "bg-amber-700 text-white" };
  return { label: "Member", className: "bg-emerald-800 text-white" };
}

export default function DashboardLayout() {
  const { session, userRole } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const groupPathMatch = location.pathname.match(/^\/group\/([^/]+)/);
  const stokvel_id = groupPathMatch?.[1] ?? undefined;
  const [memberships, setMemberships] = useState(null);
  const [fetchError, setFetchError] = useState(null);
  const [firstName, setFirstName] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const scopedPrefix = stokvel_id ? `/group/${stokvel_id}` : null;

  const closeMobileNav = () => setMobileNavOpen(false);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev || "";
    };
  }, [mobileNavOpen]);

  useEffect(() => {
    if (!session?.user?.id || !session?.access_token) return;

    let cancelled = false;
    const uid = session.user.id;
    const cacheKey = myStokvelsCacheKey(uid);

    async function load() {
      const cached = readViewCache(cacheKey, CACHE_TTL_MS);
      if (cached?.memberships && !cancelled) {
        setMemberships(
          Array.isArray(cached.memberships) ? cached.memberships : [],
        );
      }
      setFetchError(null);
      try {
        const res = await fetch(apiUrl("/api/my-stokvels"), {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const text = await res.text();
        if (!res.ok) {
          throw new Error(text || `HTTP ${res.status}`);
        }
        const json = JSON.parse(text);
        const next = Array.isArray(json.memberships) ? json.memberships : [];
        if (!cancelled) {
          setMemberships(next);
          writeViewCache(cacheKey, { memberships: next });
        }
      } catch (e) {
        if (!cancelled) {
          setFetchError(e.message ?? String(e));
          setMemberships((prev) => (Array.isArray(prev) ? prev : []));
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [session]);

  useEffect(() => {
    if (!session?.access_token) return;

    let cancelled = false;

    async function loadProfile() {
      try {
        const res = await fetch(apiUrl("/api/profile/me"), {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const text = await res.text();
        if (!res.ok) return;
        const data = JSON.parse(text);
        const name = String(data.profile?.firstName ?? "").trim();
        if (!cancelled) setFirstName(name);
      } catch {
        /* non-blocking sidebar label */
      }
    }

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [session?.access_token]);

  const { activeStokvels, pendingOrRejected } = useMemo(() => {
    const list =
      memberships == null ? [] : Array.isArray(memberships) ? memberships : [];
    const active = list.filter((m) => stokvelStatusOf(m) === "active");
    const pendingOrRejected = list.filter((m) => {
      const s = stokvelStatusOf(m);
      return s === "pending" || s === "rejected";
    });
    active.sort((a, b) => {
      const na = String(a?.stokvels?.name ?? "").toLowerCase();
      const nb = String(b?.stokvels?.name ?? "").toLowerCase();
      if (na < nb) return -1;
      if (na > nb) return 1;
      return String(a?.stokvels?.id ?? "").localeCompare(
        String(b?.stokvels?.id ?? ""),
      );
    });
    return { activeStokvels: active, pendingOrRejected };
  }, [memberships]);

  const knownMembershipIds = useMemo(() => {
    const ids = new Set();
    for (const m of memberships == null ? [] : memberships) {
      const sid = membershipStokvelId(m);
      if (sid) ids.add(sid);
    }
    return ids;
  }, [memberships]);

  const selectedMembership = useMemo(() => {
    if (!stokvel_id || memberships == null) return null;
    const sid = String(stokvel_id);
    const list = Array.isArray(memberships) ? memberships : [];
    return list.find((m) => membershipStokvelId(m) === sid) ?? null;
  }, [memberships, stokvel_id]);

  const sidebarRoleBadge = useMemo(() => {
    if (String(userRole || "").toLowerCase() === "admin") {
      return { label: "Admin | Superuser", className: "bg-red-700 text-white" };
    }
    if (!selectedMembership) {
      return { label: "Member", className: "bg-emerald-800 text-white" };
    }
    return roleBadgeForGroupRole(selectedMembership.group_role);
  }, [selectedMembership, userRole]);

  const myGroupRole = useMemo(
    () => String(selectedMembership?.group_role ?? "").trim().toLowerCase(),
    [selectedMembership],
  );
  const effectiveGroupRole =
    String(userRole || "").toLowerCase() === "admin" ? "admin" : myGroupRole;

  useEffect(() => {
    if (memberships === null || !stokvel_id) return;
    if (
      !knownMembershipIds.has(String(stokvel_id)) &&
      String(userRole || "").toLowerCase() !== "admin"
    ) {
      navigate("/dashboard", { replace: true });
      return;
    }
    try {
      localStorage.setItem("last_stokvel_id", String(stokvel_id));
    } catch {
      // ignore
    }
  }, [memberships, stokvel_id, knownMembershipIds, navigate, userRole]);

  const firstActiveId = activeStokvels[0]?.stokvels?.id
    ? String(activeStokvels[0].stokvels.id)
    : null;

  const selectValue = stokvel_id ? String(stokvel_id) : "";

  const handleStokvelSelect = (e) => {
    const v = e.target.value;
    if (!v) return;
    closeMobileNav();
    navigate(`/group/${v}/dashboard`, { replace: false });
  };

  const isScopedPath = /^\/group\/[^/]+/.test(location.pathname);
  const onScopedRoute = Boolean(stokvel_id);
  const blockOutlet =
    memberships !== null &&
    onScopedRoute &&
    !knownMembershipIds.has(String(stokvel_id)) &&
    String(userRole || "").toLowerCase() !== "admin";

  const showMembershipSkeleton = memberships === null && isScopedPath;
  const showMembershipError =
    fetchError && memberships !== null && memberships.length === 0;

  return (
    <div className="box-border flex h-dvh max-h-dvh min-h-0 w-full flex-col gap-3 overflow-hidden bg-[#F4F5F0] p-3 text-stone-800 dark:bg-slate-950 dark:text-stone-100 md:flex-row md:gap-4 md:p-4">
      <header className="flex shrink-0 items-center gap-3 rounded-2xl border border-stone-200 bg-white px-3 py-2.5 shadow-sm dark:border-slate-700 dark:bg-slate-900 md:hidden">
        <button
          type="button"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-stone-200 bg-stone-50 text-stone-700 transition hover:bg-stone-100 dark:border-slate-600 dark:bg-slate-800 dark:text-stone-200 dark:hover:bg-slate-700"
          aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileNavOpen}
          onClick={() => setMobileNavOpen((open) => !open)}
        >
          {mobileNavOpen ? (
            <X className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          ) : (
            <Menu className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <BrandLogo to="/dashboard" imgClassName="h-9 w-auto" />
        </div>
        <div className="flex max-w-[42%] flex-col items-end gap-1 text-right">
          <span
            className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${sidebarRoleBadge.className}`}
          >
            {sidebarRoleBadge.label}
          </span>
          <span className="truncate text-xs font-medium text-stone-600 dark:text-stone-300">
            Welcome back, {firstName || "user"}
          </span>
        </div>
      </header>

      {mobileNavOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          aria-label="Dismiss menu overlay"
          onClick={closeMobileNav}
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-dvh max-h-dvh w-[min(100vw-1.5rem,280px)] max-w-[85vw] flex-col overflow-hidden rounded-r-2xl border border-stone-200 bg-white shadow-lg transition-transform duration-200 ease-out dark:border-slate-700 dark:bg-slate-900 md:static md:z-auto md:h-full md:w-[220px] md:min-w-[220px] md:max-w-[220px] md:rounded-2xl md:shadow-sm md:transition-none ${
          mobileNavOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="shrink-0 border-b border-stone-200 p-3 dark:border-slate-700">
          <label
            htmlFor="stokvel-selector"
            className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400"
          >
            Stokvel
          </label>
          <select
            id="stokvel-selector"
            disabled={memberships === null}
            className="w-full rounded-lg border border-stone-200 bg-stone-50 px-2 py-2 text-sm text-stone-800 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-1 focus:ring-emerald-300 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-stone-100 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/40"
            value={memberships === null ? "" : selectValue}
            onChange={handleStokvelSelect}
          >
            {memberships === null ? (
              <option value="">Loading groups…</option>
            ) : !stokvel_id ? (
              <option value="">Select a Stokvel…</option>
            ) : null}
            {activeStokvels.map((m) => {
              const sid = m?.stokvels?.id;
              if (!sid) return null;
              return (
                <option key={String(sid)} value={String(sid)}>
                  {m?.stokvels?.name ?? "Unnamed group"}
                </option>
              );
            })}
          </select>
        </div>
        <div className="hidden shrink-0 border-b border-stone-200 p-4 dark:border-slate-700 md:block">
          <div
            className={`rounded-lg py-2 text-center text-xs font-bold uppercase tracking-wide ${sidebarRoleBadge.className}`}
          >
            {sidebarRoleBadge.label}
          </div>
          <div className="mt-3 flex justify-center">
            <BrandLogo to="/dashboard" imgClassName="h-10 w-auto md:h-12" />
          </div>
        </div>
        <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-2">
          <NavLink
            to={scopedPrefix ? `${scopedPrefix}/dashboard` : "/dashboard"}
            className={linkClass}
            end
            onClick={closeMobileNav}
          >
            <LayoutDashboard
              className="h-4 w-4 shrink-0 text-emerald-700"
              aria-hidden
            />
            Dashboard
          </NavLink>
          <NavLink
            to={
              scopedPrefix
                ? `${scopedPrefix}/meetings`
                : firstActiveId
                  ? `/group/${firstActiveId}/meetings`
                  : "/dashboard"
            }
            className={linkClass}
            onClick={closeMobileNav}
          >
            <Calendar
              className="h-4 w-4 shrink-0 text-emerald-700"
              aria-hidden
            />
            Meetings
          </NavLink>
          <NavLink
            to={
              scopedPrefix
                ? `${scopedPrefix}/payments`
                : firstActiveId
                  ? `/group/${firstActiveId}/payments`
                  : "/dashboard"
            }
            className={linkClass}
            onClick={closeMobileNav}
          >
            <Wallet className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden />
            Payments
          </NavLink>
          <NavLink
            to={
              scopedPrefix
                ? `${scopedPrefix}/reports`
                : firstActiveId
                  ? `/group/${firstActiveId}/reports`
                  : "/dashboard"
            }
            className={linkClass}
            onClick={closeMobileNav}
          >
            <BarChart3
              className="h-4 w-4 shrink-0 text-emerald-700"
              aria-hidden
            />
            Reports
          </NavLink>
          <NavLink
            to={
              scopedPrefix
                ? `${scopedPrefix}/financial-health`
                : firstActiveId
                  ? `/group/${firstActiveId}/financial-health`
                  : "/dashboard"
            }
            className={linkClass}
            onClick={closeMobileNav}
          >
            <HeartPulse
              className="h-4 w-4 shrink-0 text-emerald-700"
              aria-hidden
            />
            Financial Health
          </NavLink>
          {String(userRole || "").toLowerCase() === "admin" ? (
            <NavLink to="/admin/groups" className={linkClass} onClick={closeMobileNav}>
              <Shield className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden />
              Back to admin
            </NavLink>
          ) : null}
          {effectiveGroupRole === "admin" && scopedPrefix ? (
            <NavLink
              to={`${scopedPrefix}/settings`}
              className={linkClass}
              onClick={closeMobileNav}
            >
              <Settings
                className="h-4 w-4 shrink-0 text-emerald-700"
                aria-hidden
              />
              Settings
            </NavLink>
          ) : null}
        </nav>
        <div className="mx-2 mb-2 flex shrink-0 flex-col gap-1">
          <p className="px-3 pb-1 text-sm font-medium text-stone-600 dark:text-stone-300">
            Welcome back, {firstName || "user"}
          </p>
          <NavLink to="/account" className={linkClass} onClick={closeMobileNav}>
            <User className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden />
            Account
          </NavLink>
          <NavLink to="/support" className={linkClass} onClick={closeMobileNav}>
            <LifeBuoy className="h-4 w-4 shrink-0 text-stone-500" aria-hidden />
            Support
          </NavLink>
          <Link
            to="/apply"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-stone-600 transition hover:bg-stone-100 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-slate-800 dark:hover:text-stone-100"
            onClick={closeMobileNav}
          >
            <UserPlus
              className="h-4 w-4 shrink-0 text-emerald-700"
              aria-hidden
            />
            Apply to stokvel
          </Link>
          {pendingOrRejected.length > 0 ? (
            <NavLink to="/apply" className={linkClass} onClick={closeMobileNav}>
              <ClipboardList
                className="h-4 w-4 shrink-0 text-emerald-700"
                aria-hidden
              />
              My Applications
            </NavLink>
          ) : null}
          <Link
            to="/"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-stone-600 transition hover:bg-stone-100 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-slate-800 dark:hover:text-stone-100"
            onClick={closeMobileNav}
          >
            <Home className="h-4 w-4" aria-hidden />
            Back to Home
          </Link>
        </div>
        <div className="shrink-0 space-y-2 border-t border-stone-200 p-3 dark:border-slate-700">
          <ThemeToggle layout="sidebar" />
          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-stone-200 bg-stone-50 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-100 dark:border-slate-600 dark:bg-slate-800 dark:text-stone-200 dark:hover:bg-slate-700"
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
      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-y-contain rounded-2xl border border-stone-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-stone-100 sm:p-6 md:p-8">
        {blockOutlet ? null : showMembershipSkeleton ? (
          <SkeletonPage />
        ) : showMembershipError ? (
          <div className="flex flex-col items-center justify-center gap-3 p-6 text-center text-stone-600 dark:text-stone-400">
            <p className="text-sm">Could not load your stokvels.</p>
            <button
              type="button"
              className="rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-800 hover:bg-stone-50 dark:border-slate-600 dark:bg-slate-800 dark:text-stone-200 dark:hover:bg-slate-700"
              onClick={() => navigate("/dashboard", { replace: true })}
            >
              Try again
            </button>
          </div>
        ) : (
          <Outlet />
        )}
      </main>
    </div>
  );
}
