import { useEffect, useMemo, useState } from "react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
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
      ? "bg-emerald-50 font-semibold text-emerald-800"
      : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
  }`;

function membershipStokvelId(m) {
  return m?.stokvels?.id != null ? String(m.stokvels.id) : null;
}

export default function DashboardLayout() {
  const { session } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const groupPathMatch = location.pathname.match(/^\/group\/([^/]+)/);
  const stokvel_id = groupPathMatch?.[1] ?? undefined;
  const [memberships, setMemberships] = useState(null);
  const [fetchError, setFetchError] = useState(null);

  const scopedPrefix = stokvel_id ? `/group/${stokvel_id}` : null;

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

  useEffect(() => {
    if (memberships === null || !stokvel_id) return;
    if (!knownMembershipIds.has(String(stokvel_id))) {
      navigate("/dashboard", { replace: true });
      return;
    }
    try {
      localStorage.setItem("last_stokvel_id", String(stokvel_id));
    } catch {
      // ignore
    }
  }, [memberships, stokvel_id, knownMembershipIds, navigate]);

  const firstActiveId = activeStokvels[0]?.stokvels?.id
    ? String(activeStokvels[0].stokvels.id)
    : null;

  const selectValue = stokvel_id ? String(stokvel_id) : "";

  const handleStokvelSelect = (e) => {
    const v = e.target.value;
    if (!v) return;
    navigate(`/group/${v}/dashboard`, { replace: false });
  };

  const isScopedPath = /^\/group\/[^/]+/.test(location.pathname);
  const onScopedRoute = Boolean(stokvel_id);
  const blockOutlet =
    memberships !== null &&
    onScopedRoute &&
    !knownMembershipIds.has(String(stokvel_id));

  if (memberships === null && isScopedPath) {
    return (
      <div className="flex h-dvh items-center justify-center overflow-hidden bg-[#F4F5F0] text-stone-600">
        <p className="text-sm tracking-wide">Loading your groups…</p>
      </div>
    );
  }

  if (fetchError && memberships !== null && memberships.length === 0) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3 overflow-hidden bg-[#F4F5F0] p-6 text-center text-stone-600">
        <p className="text-sm">Could not load your stokvels.</p>
        <button
          type="button"
          className="rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-800 hover:bg-stone-50"
          onClick={() => navigate("/dashboard", { replace: true })}
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="box-border flex h-dvh min-h-0 w-full flex-col gap-3 overflow-hidden bg-[#F4F5F0] p-3 text-stone-800 md:flex-row md:gap-4 md:p-4">
      <aside className="flex w-full shrink-0 flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm md:h-full md:w-[220px] md:min-w-[220px] md:max-w-[220px]">
        <div className="shrink-0 border-b border-stone-200 p-3">
          <label
            htmlFor="stokvel-selector"
            className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-stone-500"
          >
            Stokvel
          </label>
          <select
            id="stokvel-selector"
            disabled={memberships === null}
            className="w-full rounded-lg border border-stone-200 bg-stone-50 px-2 py-2 text-sm text-stone-800 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-1 focus:ring-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
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
        <div className="shrink-0 border-b border-stone-200 p-4">
          <div className="rounded-lg bg-emerald-800 py-2 text-center text-xs font-bold uppercase tracking-wide text-white">
            Member
          </div>
          <p className="mt-3 text-xs font-semibold text-stone-500">
            Sawubona Stokvel
          </p>
        </div>
        <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-2">
          <NavLink
            to={scopedPrefix ? `${scopedPrefix}/dashboard` : "/dashboard"}
            className={linkClass}
            end
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
          >
            <Calendar
              className="h-4 w-4 shrink-0 text-emerald-700"
              aria-hidden
            />
            Meetings
          </NavLink>
          <NavLink to="/account" className={linkClass}>
            <User className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden />
            Account
          </NavLink>
          <NavLink to="/my-payout" className={linkClass}>
            <Wallet className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden />
            My Payouts
          </NavLink>
          <NavLink to="/support" className={linkClass}>
            <LifeBuoy className="h-4 w-4 shrink-0 text-stone-500" aria-hidden />
            Support
          </NavLink>
        </nav>
        <div className="mx-2 mb-2 flex shrink-0 flex-col gap-1">
          <Link
            to="/apply"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-stone-600 transition hover:bg-stone-100 hover:text-stone-900"
          >
            <UserPlus
              className="h-4 w-4 shrink-0 text-emerald-700"
              aria-hidden
            />
            Apply to stokvel
          </Link>
          {pendingOrRejected.length > 0 ? (
            <NavLink to="/apply" className={linkClass}>
              <ClipboardList
                className="h-4 w-4 shrink-0 text-emerald-700"
                aria-hidden
              />
              My Applications
            </NavLink>
          ) : null}
          <Link
            to="/home"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-stone-600 transition hover:bg-stone-100 hover:text-stone-900"
          >
            <Home className="h-4 w-4" aria-hidden />
            Back to Home
          </Link>
        </div>
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
        {blockOutlet ? null : <Outlet />}
      </main>
    </div>
  );
}
