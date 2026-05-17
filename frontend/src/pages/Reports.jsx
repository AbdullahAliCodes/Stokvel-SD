import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useSession } from "../context/SessionContext";
import { apiUrl } from "../utils/api";
import { cardLight, errorBox } from "../ui";
import { readViewCache, writeViewCache } from "../utils/viewCache";
import PayoutReportPanel from "../components/PayoutReportPanel";
import ComplianceReportWidget from "../components/ComplianceReportWidget";
import CustomFinancialReport from "../components/CustomFinancialReport";
import GroupPageHeader from "../components/GroupPageHeader";

const TARGET_MONTH_RE = /^\d{4}-\d{2}$/;

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
  const [fixedPool, setFixedPool] = useState(null);

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
    setFixedPool(json.fixedPool ?? null);
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
        setFixedPool(cached.fixedPool ?? null);
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
            fixedPool: json.fixedPool ?? null,
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
          setFixedPool(null);
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
    <div className="space-y-8">
      <GroupPageHeader
        title="Reports"
        iconClassName="fa-solid fa-chart-column"
        subtitle={
          groupName ? (
            <>
              <span className="font-medium text-stone-800 dark:text-stone-100">
                {groupName}
              </span>
              {" — "}
              Payout history, projections, compliance, and custom financial
              views.
            </>
          ) : (
            "Payout history, projections, compliance, and custom financial views."
          )
        }
      />

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

          <CustomFinancialReport
            effectiveStokvel={effectiveStokvel}
            members={members}
            contributions={contributions}
            payouts={payouts}
            missedPayments={missedPayments}
            ledgerMonths={ledgerMonths}
            fixedPool={fixedPool}
            currentUserId={session?.user?.id ?? null}
          />
        </>
      ) : null}

      {session && !loading && !membership && !error ? (
        <p
          className={`${cardLight} p-4 text-sm text-stone-600 dark:text-stone-300`}
        >
          You are not a member of this stokvel.
        </p>
      ) : null}
    </div>
  );
}
