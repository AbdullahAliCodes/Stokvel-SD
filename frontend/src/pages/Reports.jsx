import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useSession } from "../context/SessionContext";
import { apiUrl } from "../utils/api";
import { cardLight, errorBox, pageSubtitle } from "../ui";
import { readViewCache, writeViewCache } from "../utils/viewCache";
import PayoutReportPanel from "../components/PayoutReportPanel";
import ComplianceReportWidget from "../components/ComplianceReportWidget";

const TARGET_MONTH_RE = /^\d{4}-\d{2}$/;

function formatGroupRole(role) {
  if (!role) return "Member";
  return (
    String(role).charAt(0).toUpperCase() + String(role).slice(1).toLowerCase()
  );
}

function yyyyMmLocal(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function ledgerReferenceMonth(currentCycle) {
  if (
    currentCycle?.targetMonth &&
    TARGET_MONTH_RE.test(currentCycle.targetMonth)
  ) {
    return currentCycle.targetMonth;
  }
  return yyyyMmLocal();
}

function collectLedgerMonths({
  contributions,
  missedPayments,
  payouts,
  capMonth,
}) {
  const set = new Set();
  for (const c of contributions ?? []) {
    const m = c?.target_month;
    if (m && TARGET_MONTH_RE.test(m) && m <= capMonth) set.add(m);
  }
  for (const row of missedPayments ?? []) {
    const m = row?.target_month;
    if (m && TARGET_MONTH_RE.test(m) && m <= capMonth) set.add(m);
  }
  for (const row of payouts ?? []) {
    const m = row?.target_month;
    if (m && TARGET_MONTH_RE.test(m) && m <= capMonth) set.add(m);
  }
  return [...set].sort();
}

export default function Reports() {
  const { stokvel_id } = useParams();
  const { hash } = useLocation();
  const { session } = useSession();
  const [stokvel, setStokvel] = useState(null);
  const [membership, setMembership] = useState(null);
  const [members, setMembers] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [contributions, setContributions] = useState([]);
  const [currentCycle, setCurrentCycle] = useState(null);
  const [payouts, setPayouts] = useState([]);
  const [missedPayments, setMissedPayments] = useState([]);

  const applyStokvelDetail = useCallback((json) => {
    setMembership(json.membership ?? null);
    setStokvel(json.stokvel ?? null);
    setMembers(Array.isArray(json.members) ? json.members : []);
    setContributions(
      Array.isArray(json.contributions) ? json.contributions : [],
    );
    setCurrentCycle(json.currentCycle ?? null);
    setPayouts(Array.isArray(json.payouts) ? json.payouts : []);
    setMissedPayments(
      Array.isArray(json.missedPayments) ? json.missedPayments : [],
    );
  }, []);

  useEffect(() => {
    if (!session || !stokvel_id) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const id = stokvel_id;

    async function load() {
      setLoading(true);
      setError(null);
      const cacheKey = `stokvel_detail:${session.user.id}:${id}`;
      const cached = readViewCache(cacheKey, 120000);
      if (cached && !cancelled) {
        setMembership(cached.membership ?? null);
        setStokvel(cached.stokvel ?? null);
        setMembers(Array.isArray(cached.members) ? cached.members : []);
        setContributions(
          Array.isArray(cached.contributions) ? cached.contributions : [],
        );
        setCurrentCycle(cached.currentCycle ?? null);
        setPayouts(Array.isArray(cached.payouts) ? cached.payouts : []);
        setMissedPayments(
          Array.isArray(cached.missedPayments) ? cached.missedPayments : [],
        );
        setLoading(false);
      }
      try {
        const res = await fetch(apiUrl(`/api/stokvels/${id}`), {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const text = await res.text();
        if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
        const json = JSON.parse(text);
        if (!cancelled) {
          applyStokvelDetail(json);
          writeViewCache(cacheKey, {
            membership: json.membership ?? null,
            stokvel: json.stokvel ?? null,
            members: Array.isArray(json.members) ? json.members : [],
            totalContribution: json.totalContribution ?? 0,
            contributions: Array.isArray(json.contributions)
              ? json.contributions
              : [],
            currentCycle: json.currentCycle ?? null,
            payouts: Array.isArray(json.payouts) ? json.payouts : [],
            missedPayments: Array.isArray(json.missedPayments)
              ? json.missedPayments
              : [],
          });
        }
      } catch (e) {
        if (!cancelled) {
          setError(e.message ?? String(e));
          setMembership(null);
          setStokvel(null);
          setMembers([]);
          setCurrentCycle(null);
          setPayouts([]);
          setMissedPayments([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [session, stokvel_id, applyStokvelDetail]);

  const effectiveStokvel = stokvel ?? membership?.stokvels ?? null;
  const groupName = effectiveStokvel?.name;
  const stokvelStatus = String(effectiveStokvel?.status ?? "").toLowerCase();
  const isActiveStokvel = stokvelStatus === "active";

  const refMonth = useMemo(
    () => ledgerReferenceMonth(currentCycle),
    [currentCycle],
  );

  const ledgerMonths = useMemo(
    () =>
      collectLedgerMonths({
        contributions,
        missedPayments,
        payouts,
        capMonth: refMonth,
      }),
    [contributions, missedPayments, payouts, refMonth],
  );

  useEffect(() => {
    if (loading || !hash) return;
    const id = hash.replace(/^#/, "");
    if (!id) return;
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [hash, loading]);

  if (!stokvel_id) return null;

  return (
    <>
      <header
        className={`mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between ${
          isActiveStokvel
            ? "rounded-xl border-t-4 border-emerald-700 pt-4"
            : "rounded-xl border-t-4 border-stone-300 pt-4"
        }`}
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-emerald-800 sm:text-3xl">
            Reports
          </h1>
          {groupName || membership?.group_role ? (
            <p className={`mt-1 ${pageSubtitle}`}>
              {groupName ? (
                <span className="font-medium text-stone-800 dark:text-stone-100">
                  {groupName}
                </span>
              ) : null}
              {stokvelStatus ? (
                <span className="ml-2 capitalize text-stone-500 dark:text-stone-400">
                  · {stokvelStatus}
                </span>
              ) : null}
              {membership?.group_role ? (
                <span className="ml-2 text-stone-500 dark:text-stone-400">
                  · {formatGroupRole(membership.group_role)}
                </span>
              ) : null}
            </p>
          ) : (
            <p className={`mt-1 ${pageSubtitle}`}>
              Payout history, projections, and contribution compliance.
            </p>
          )}
        </div>
      </header>

      {!session ? (
        <p className="mb-6 text-sm text-stone-500">Sign in to view reports.</p>
      ) : null}

      {error ? <p className={`mb-6 ${errorBox}`}>{error}</p> : null}

      {session && loading ? (
        <div className="flex justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-green-600" />
        </div>
      ) : null}

      {session && !loading && membership ? (
        <>
          <PayoutReportPanel
            stokvelId={stokvel_id}
            accessToken={session?.access_token}
            enabled={Boolean(session && membership)}
          />

          <div className="mt-10">
            <ComplianceReportWidget
              members={members}
              contributions={contributions}
              missedPayments={missedPayments}
              ledgerMonths={ledgerMonths}
            />
          </div>
        </>
      ) : null}

      {session && !loading && !membership && !error ? (
        <p className={`${cardLight} p-4 text-sm text-stone-600 dark:text-stone-300`}>
          You are not a member of this stokvel.
        </p>
      ) : null}
    </>
  );
}
