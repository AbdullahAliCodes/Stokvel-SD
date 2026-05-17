import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";
import { GripVertical, Loader2 } from "lucide-react";
import { useSession } from "../context/SessionContext";
import { apiUrl } from "../utils/api";
import {
  btnPrimary,
  btnSecondary,
  cardLight,
  errorBox,
  inputLight,
  pageSubtitle,
  tableHead,
  tableRow,
  tableWrap,
} from "../ui";
import { readViewCache, writeViewCache } from "../utils/viewCache";
import MarketRatesWidget from "../components/MarketRatesWidget";
import PayoutReportPanel from "../components/PayoutReportPanel";
import QuickPayModal from "../components/QuickPayModal";
import ComplianceReportWidget from "../components/ComplianceReportWidget";
import ReportExportActions from "../components/ReportExportActions";

const TARGET_MONTH_RE = /^\d{4}-\d{2}$/;

function formatZAR(n) {
  const num = Number(n);
  if (Number.isNaN(num)) return "R 0";
  return `R ${Math.round(num).toLocaleString("en-ZA")}`;
}

function memberDisplay(p) {
  const first = p?.first_name?.trim();
  const last = p?.last_name?.trim();
  if (first || last) return [first, last].filter(Boolean).join(" ");
  if (p?.full_name) return p.full_name;
  if (p?.email) return p.email.split("@")[0];
  return "Member";
}

function formatGroupRole(role) {
  if (!role) return "Member";
  return (
    String(role).charAt(0).toUpperCase() + String(role).slice(1).toLowerCase()
  );
}

function parseApiError(text) {
  try {
    const json = JSON.parse(text);
    return json.error || text || "Request failed";
  } catch {
    return text || "Request failed";
  }
}

function confirmAction(message) {
  return window.confirm(message);
}

function yyyyMmLocal(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** When API has no open `targetMonth` (gap week), cap ledger / “current” month using local calendar. */
function ledgerReferenceMonth(currentCycle) {
  if (
    currentCycle?.targetMonth &&
    TARGET_MONTH_RE.test(currentCycle.targetMonth)
  ) {
    return currentCycle.targetMonth;
  }
  return yyyyMmLocal();
}

function formatScheduleDate(iso) {
  if (!iso) return "—";
  const t = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(t.getTime())) return String(iso);
  return t.toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function todayIsoLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function payoutHasHappened(payout, todayIso) {
  const scheduled = String(payout?.scheduled_payout_date ?? "").slice(0, 10);
  if (!scheduled) return false;
  return scheduled < todayIso;
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

function memberPaidForMonth(contributions, userId, month) {
  return (contributions ?? []).some(
    (c) =>
      c?.user_id === userId &&
      c?.target_month === month &&
      TARGET_MONTH_RE.test(String(month)),
  );
}

/** Latest contribution row for a member × month (for approval / Paystack row identity). */
function primaryContributionForMonth(contributions, userId, month) {
  const matches = (contributions ?? []).filter(
    (c) =>
      c?.user_id === userId &&
      c?.target_month === month &&
      TARGET_MONTH_RE.test(String(month)),
  );
  if (matches.length === 0) return null;
  return matches.sort((a, b) => {
    const ta = new Date(a.paid_at || 0).getTime();
    const tb = new Date(b.paid_at || 0).getTime();
    return tb - ta;
  })[0];
}

function treasurerApprovalStatus(contribution) {
  if (!contribution) return null;
  const raw = String(
    contribution.treasurer_approval_status || "pending",
  ).toLowerCase();
  if (raw === "approved" || raw === "rejected" || raw === "pending") return raw;
  return "pending";
}

function treasurerApprovalColumnLabel(contribution) {
  if (!contribution) return "N/A";
  const s = treasurerApprovalStatus(contribution);
  if (s === "approved") return "Approved";
  if (s === "rejected") return "Not approved";
  return "Pending";
}

function treasurerApprovalDotClass(contribution) {
  if (!contribution) return "bg-stone-300";
  const s = treasurerApprovalStatus(contribution);
  if (s === "approved") return "bg-emerald-500";
  if (s === "rejected") return "bg-red-500";
  return "bg-amber-400";
}

function memberFlaggedForMonth(missedPayments, userId, month) {
  return (missedPayments ?? []).some(
    (r) =>
      r?.user_id === userId &&
      r?.target_month === month &&
      r?.resolved_at == null &&
      TARGET_MONTH_RE.test(String(month)),
  );
}

export default function Payments() {
  const { stokvel_id } = useParams();
  const { session } = useSession();
  const [stokvel, setStokvel] = useState(null);
  const [membership, setMembership] = useState(null);
  const [members, setMembers] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quickPayOpen, setQuickPayOpen] = useState(false);
  const [totalContribution, setTotalContribution] = useState(0);
  const [contributions, setContributions] = useState([]);
  const [currentCycle, setCurrentCycle] = useState(null);
  const [payouts, setPayouts] = useState([]);
  const [missedPayments, setMissedPayments] = useState([]);
  const [treasurerUserId, setTreasurerUserId] = useState("");
  const [treasurerSaving, setTreasurerSaving] = useState(false);
  const [treasurerError, setTreasurerError] = useState("");
  const [treasurerOk, setTreasurerOk] = useState("");
  const [payoutOrderSaving, setPayoutOrderSaving] = useState(false);
  const [payoutOrderError, setPayoutOrderError] = useState("");
  const [payoutOrderOk, setPayoutOrderOk] = useState("");
  const [upcomingPayoutOrderIds, setUpcomingPayoutOrderIds] = useState([]);
  const [flaggingCandidate, setFlaggingCandidate] = useState(null);
  const [flaggingSubmitting, setFlaggingSubmitting] = useState(false);
  const [ledgerToast, setLedgerToast] = useState("");
  const ledgerToastTimer = useRef(null);
  const [approvalSubmittingId, setApprovalSubmittingId] = useState(null);
  const [approvalError, setApprovalError] = useState("");
  const [payoutsLoading, setPayoutsLoading] = useState(false);
  const [treasurerPayoutRows, setTreasurerPayoutRows] = useState([]);
  const [payoutActionLoadingId, setPayoutActionLoadingId] = useState("");
  const [payoutActionError, setPayoutActionError] = useState("");
  const [payoutActionOk, setPayoutActionOk] = useState("");

  const showLedgerToast = useCallback((msg) => {
    if (ledgerToastTimer.current) clearTimeout(ledgerToastTimer.current);
    setLedgerToast(msg);
    ledgerToastTimer.current = setTimeout(() => {
      setLedgerToast("");
      ledgerToastTimer.current = null;
    }, 4000);
  }, []);

  useEffect(
    () => () => {
      if (ledgerToastTimer.current) clearTimeout(ledgerToastTimer.current);
    },
    [],
  );

  const applyStokvelDetail = useCallback((json) => {
    setMembership(json.membership ?? null);
    setStokvel(json.stokvel ?? null);
    const nextMembers = Array.isArray(json.members) ? json.members : [];
    setMembers(nextMembers);
    setTreasurerUserId(
      nextMembers.find((m) => m.group_role === "treasurer")?.user_id ?? "",
    );
    setTotalContribution(json.totalContribution ?? 0);
    setContributions(
      Array.isArray(json.contributions) ? json.contributions : [],
    );
    setCurrentCycle(json.currentCycle ?? null);
    setPayouts(Array.isArray(json.payouts) ? json.payouts : []);
    setMissedPayments(
      Array.isArray(json.missedPayments) ? json.missedPayments : [],
    );
  }, []);

  const silentReloadDetail = useCallback(async () => {
    if (!session?.access_token || !stokvel_id) return;
    const id = stokvel_id;
    const cacheKey = `stokvel_detail:${session.user.id}:${id}`;
    const res = await fetch(apiUrl(`/api/stokvels/${id}`), {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const text = await res.text();
    if (!res.ok) throw new Error(parseApiError(text));
    const json = JSON.parse(text);
    applyStokvelDetail(json);
    let nextMeetings = [];
    try {
      const meetingsRes = await fetch(apiUrl(`/api/stokvels/${id}/meetings`), {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const meetingsText = await meetingsRes.text();
      if (meetingsRes.ok) {
        const meetingsJson = JSON.parse(meetingsText);
        nextMeetings = Array.isArray(meetingsJson.meetings)
          ? meetingsJson.meetings
          : [];
      }
    } catch {
      /* ignore */
    }
    writeViewCache(cacheKey, {
      membership: json.membership ?? null,
      stokvel: json.stokvel ?? null,
      members: Array.isArray(json.members) ? json.members : [],
      totalContribution: json.totalContribution ?? 0,
      contributions: Array.isArray(json.contributions)
        ? json.contributions
        : [],
      meetings: nextMeetings,
      currentCycle: json.currentCycle ?? null,
      payouts: Array.isArray(json.payouts) ? json.payouts : [],
      missedPayments: Array.isArray(json.missedPayments)
        ? json.missedPayments
        : [],
    });
  }, [
    session?.access_token,
    session?.user?.id,
    stokvel_id,
    applyStokvelDetail,
  ]);

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
        const nextMembers = Array.isArray(cached.members) ? cached.members : [];
        setMembers(nextMembers);
        setTreasurerUserId(
          nextMembers.find((m) => m.group_role === "treasurer")?.user_id ?? "",
        );
        setTotalContribution(cached.totalContribution ?? 0);
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
          let nextMeetings = [];
          let meetingsFromApi = false;
          try {
            const meetingsRes = await fetch(
              apiUrl(`/api/stokvels/${id}/meetings`),
              {
                headers: { Authorization: `Bearer ${session.access_token}` },
              },
            );
            const meetingsText = await meetingsRes.text();
            if (meetingsRes.ok) {
              const meetingsJson = JSON.parse(meetingsText);
              nextMeetings = Array.isArray(meetingsJson.meetings)
                ? meetingsJson.meetings
                : [];
              meetingsFromApi = true;
            }
          } catch {
            /* keep cache fallback */
          }
          if (!meetingsFromApi && Array.isArray(cached?.meetings)) {
            nextMeetings = cached.meetings;
          }
          writeViewCache(cacheKey, {
            membership: json.membership ?? null,
            stokvel: json.stokvel ?? null,
            members: Array.isArray(json.members) ? json.members : [],
            totalContribution: json.totalContribution ?? 0,
            contributions: Array.isArray(json.contributions)
              ? json.contributions
              : [],
            meetings: nextMeetings,
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
        if (!cancelled) {
          setLoading(false);
        }
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
  const memberCount = members.length;
  const monthlyContribution =
    Number(effectiveStokvel?.contribution_amount) || 0;
  const expectedPayout = monthlyContribution * memberCount;
  const stokvelType = String(effectiveStokvel?.type ?? "");
  const isRotatingStokvel = stokvelType === "Rotating";
  const myRole = String(
    members.find((m) => m.user_id === session?.user?.id)?.group_role ??
      membership?.group_role ??
      "",
  ).toLowerCase();
  const canManageTreasurer = ["treasurer", "admin"].includes(myRole);
  const canFlagMissed = ["treasurer", "admin"].includes(myRole);
  const canManagePayoutOrder = ["treasurer", "admin"].includes(myRole);
  const isTreasurerRole = myRole === "treasurer";
  const currentTreasurer =
    members.find((m) => m.group_role === "treasurer") ?? null;
  const currentTreasurerName = currentTreasurer
    ? memberDisplay(currentTreasurer.profiles)
    : "Not assigned";

  const uid = session?.user?.id ?? null;

  const hasPaidCurrentMonth = useMemo(() => {
    const tm = currentCycle?.targetMonth;
    if (!uid || !tm || !TARGET_MONTH_RE.test(tm)) return false;
    return memberPaidForMonth(contributions, uid, tm);
  }, [contributions, currentCycle?.targetMonth, uid]);

  const isScheduledReceiver = useMemo(() => {
    const tm = currentCycle?.targetMonth;
    if (!uid || !tm || !TARGET_MONTH_RE.test(tm)) return false;
    return (payouts ?? []).some(
      (p) => p?.user_id === uid && p?.target_month === tm,
    );
  }, [payouts, currentCycle?.targetMonth, uid]);

  const currentUserHasUnresolvedFlag = useMemo(() => {
    if (!uid) return false;
    return (missedPayments ?? []).some(
      (r) => r?.user_id === uid && r?.resolved_at == null,
    );
  }, [missedPayments, uid]);

  const payWindowAllowsQuickPay =
    (!hasPaidCurrentMonth && Boolean(currentCycle?.inPaymentWindow)) ||
    currentUserHasUnresolvedFlag;

  const quickPayBlockedByRotatingReceiver =
    isRotatingStokvel && isScheduledReceiver;

  const quickPayEnabled =
    isActiveStokvel &&
    payWindowAllowsQuickPay &&
    !quickPayBlockedByRotatingReceiver;

  const quickPayDisabledReason = useMemo(() => {
    if (!isActiveStokvel) return "This stokvel is not active yet.";
    if (quickPayBlockedByRotatingReceiver)
      return "You are receiving the payout this cycle.";
    if (hasPaidCurrentMonth && !currentUserHasUnresolvedFlag)
      return "You have already paid for this cycle.";
    if (!currentCycle?.inPaymentWindow && !currentUserHasUnresolvedFlag)
      return "Outside payment window.";
    return null;
  }, [
    isActiveStokvel,
    quickPayBlockedByRotatingReceiver,
    hasPaidCurrentMonth,
    currentUserHasUnresolvedFlag,
    currentCycle?.inPaymentWindow,
  ]);

  const cycleBannerText = useMemo(() => {
    if (
      currentCycle?.targetMonth &&
      TARGET_MONTH_RE.test(currentCycle.targetMonth)
    ) {
      return `Active cycle: ${currentCycle.targetMonth}`;
    }
    return "No active payment window";
  }, [currentCycle?.targetMonth]);

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

  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) =>
      memberDisplay(a.profiles).localeCompare(memberDisplay(b.profiles), "en"),
    );
  }, [members]);

  const todayIso = useMemo(() => todayIsoLocal(), []);

  const { settledPayouts, upcomingPayouts } = useMemo(() => {
    const settled = [];
    const upcoming = [];
    for (const payout of payouts ?? []) {
      if (payoutHasHappened(payout, todayIso)) settled.push(payout);
      else upcoming.push(payout);
    }
    return { settledPayouts: settled, upcomingPayouts: upcoming };
  }, [payouts, todayIso]);

  useEffect(() => {
    setUpcomingPayoutOrderIds(upcomingPayouts.map((p) => p.id).filter(Boolean));
  }, [upcomingPayouts]);

  const upcomingPayoutsInUiOrder = useMemo(() => {
    if (upcomingPayoutOrderIds.length === 0) return upcomingPayouts;
    const byId = new Map(upcomingPayouts.map((p) => [p.id, p]));
    return upcomingPayoutOrderIds.map((id) => byId.get(id)).filter(Boolean);
  }, [upcomingPayoutOrderIds, upcomingPayouts]);

  const payoutOrderChanged = useMemo(() => {
    const current = upcomingPayouts.map((p) => p.id).filter(Boolean);
    if (current.length !== upcomingPayoutOrderIds.length) return false;
    return current.some((id, i) => id !== upcomingPayoutOrderIds[i]);
  }, [upcomingPayoutOrderIds, upcomingPayouts]);

  async function handleTreasurerSave() {
    if (!session?.access_token || !stokvel_id || !treasurerUserId) return;
    if (!confirmAction("Save this treasurer change for the group?")) return;
    setTreasurerSaving(true);
    setTreasurerError("");
    setTreasurerOk("");
    try {
      const res = await fetch(apiUrl(`/api/stokvels/${stokvel_id}/treasurer`), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ userId: treasurerUserId }),
      });
      const text = await res.text();
      if (!res.ok) {
        throw new Error(parseApiError(text));
      }

      setMembers((prev) =>
        prev.map((m) => ({
          ...m,
          group_role:
            m.user_id === treasurerUserId
              ? "treasurer"
              : m.group_role === "treasurer"
                ? "member"
                : m.group_role,
        })),
      );

      if (session.user?.id) {
        setMembership((prev) => {
          if (!prev) return prev;
          const nextRole =
            session.user.id === treasurerUserId
              ? "treasurer"
              : prev.group_role === "treasurer"
                ? "member"
                : prev.group_role;
          return { ...prev, group_role: nextRole };
        });
      }

      setTreasurerOk("Treasurer updated.");
    } catch (e) {
      setTreasurerError(e.message ?? String(e));
    } finally {
      setTreasurerSaving(false);
    }
  }

  async function submitTreasurerApproval(contributionId, status) {
    if (!session?.access_token || !stokvel_id || !contributionId) return;
    setApprovalError("");
    setApprovalSubmittingId(contributionId);
    try {
      const res = await fetch(
        apiUrl(
          `/api/stokvels/${stokvel_id}/contributions/${contributionId}/treasurer-approval`,
        ),
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ status }),
        },
      );
      const text = await res.text();
      if (!res.ok) throw new Error(parseApiError(text));
      await silentReloadDetail();
      const approvalToasts = {
        approved: "Payment marked as approved.",
        rejected: "Payment marked as not approved.",
        pending: "Approval reset to pending — needs review again.",
      };
      showLedgerToast(approvalToasts[status] ?? "Payment approval updated.");
    } catch (e) {
      const msg = e.message ?? String(e);
      setApprovalError(msg);
      showLedgerToast("");
    } finally {
      setApprovalSubmittingId(null);
    }
  }

  function handleUpcomingPayoutDragEnd(result) {
    if (!result?.destination) return;
    if (result.destination.index === result.source.index) return;
    setUpcomingPayoutOrderIds((items) => {
      const next = Array.from(items);
      const [removed] = next.splice(result.source.index, 1);
      next.splice(result.destination.index, 0, removed);
      return next;
    });
  }

  async function handlePayoutOrderSave() {
    if (!session?.access_token || !stokvel_id || !canManagePayoutOrder) return;
    if (!confirmAction("Save payout order for upcoming disbursements?")) return;
    const payloadOrderIds =
      upcomingPayoutOrderIds.length > 0
        ? upcomingPayoutOrderIds
        : upcomingPayouts.map((p) => p.id).filter(Boolean);
    setPayoutOrderSaving(true);
    setPayoutOrderError("");
    setPayoutOrderOk("");
    try {
      const res = await fetch(
        apiUrl(`/api/stokvels/${stokvel_id}/payout-order`),
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ orderedUpcomingPayoutIds: payloadOrderIds }),
        },
      );
      const text = await res.text();
      if (!res.ok) throw new Error(parseApiError(text));
      await silentReloadDetail();
      setPayoutOrderOk("Upcoming payout order updated.");
    } catch (err) {
      setPayoutOrderError(
        err.message || "Could not update payout order right now.",
      );
    } finally {
      setPayoutOrderSaving(false);
    }
  }

  async function confirmFlagMissedPayment() {
    if (!flaggingCandidate || !session?.access_token || !stokvel_id) return;
    setFlaggingSubmitting(true);
    try {
      const res = await fetch(
        apiUrl(`/api/stokvels/${stokvel_id}/missed-payments`),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            user_id: flaggingCandidate.userId,
            target_month: flaggingCandidate.targetMonth,
          }),
        },
      );
      const text = await res.text();
      let json = {};
      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        json = {};
      }
      if (!res.ok) {
        throw new Error(json.error || text || `HTTP ${res.status}`);
      }
      setFlaggingCandidate(null);
      await silentReloadDetail();
      if (json.alreadyFlagged) {
        showLedgerToast("Already flagged for that month.");
      } else {
        showLedgerToast("Missed payment flagged.");
      }
    } catch (e) {
      setError(e.message ?? String(e));
    } finally {
      setFlaggingSubmitting(false);
    }
  }

  const statCards = [
    { label: "Total contribution", value: formatZAR(totalContribution) },
    { label: "Expected payout", value: formatZAR(expectedPayout) },
    { label: "Monthly contribution", value: formatZAR(monthlyContribution) },
    { label: "Members", value: String(memberCount) },
  ];

  const reportExportSubtitle = useMemo(() => {
    const parts = [groupName, cycleBannerText].filter(Boolean);
    parts.push(`Exported ${new Date().toLocaleString("en-ZA")}`);
    return parts.join(" · ");
  }, [groupName, cycleBannerText]);

  const financeSummaryExport = useMemo(
    () => ({
      headers: ["Metric", "Value"],
      rows: statCards.map((card) => [card.label, card.value]),
    }),
    [statCards],
  );

  const payoutScheduleExport = useMemo(() => {
    const headers = ["Date", "Member", "Expected amount"];
    const rows = (payouts ?? []).map((p) => {
      const prof =
        members.find((m) => m.user_id === p.user_id)?.profiles ?? null;
      return [
        formatScheduleDate(p.scheduled_payout_date),
        memberDisplay(prof),
        formatZAR(expectedPayout),
      ];
    });
    return { headers, rows };
  }, [payouts, members, expectedPayout]);

  const cycleLedgerExportByMonth = useMemo(() => {
    const headers = ["Member", "Status", "Approved?"];
    const byMonth = {};
    for (const month of ledgerMonths) {
      byMonth[month] = sortedMembers.map((m) => {
        const paid = memberPaidForMonth(contributions, m.user_id, month);
        const contrib = primaryContributionForMonth(
          contributions,
          m.user_id,
          month,
        );
        const flagged = memberFlaggedForMonth(missedPayments, m.user_id, month);
        let statusLabel = "Unpaid";
        if (paid) statusLabel = "Paid";
        else if (flagged) statusLabel = "Unpaid (Missed Deadline)";
        return [
          memberDisplay(m.profiles),
          statusLabel,
          treasurerApprovalColumnLabel(contrib),
        ];
      });
    }
    return { headers, byMonth };
  }, [ledgerMonths, sortedMembers, contributions, missedPayments]);

  const cycleLedgerExportAll = useMemo(() => {
    const headers = ["Cycle", "Member", "Status", "Approved?"];
    const rows = [];
    for (const month of ledgerMonths) {
      for (const row of cycleLedgerExportByMonth.byMonth[month] ?? []) {
        rows.push([month, ...row]);
      }
    }
    return { headers, rows };
  }, [ledgerMonths, cycleLedgerExportByMonth]);

  const treasurerPayoutsExport = useMemo(() => {
    const headers = ["Member name", "Payout date", "Status"];
    const rows = (treasurerPayoutRows ?? []).map((row) => {
      const completed = String(row.status || "").toLowerCase() === "completed";
      return [
        memberDisplay(row.profile),
        formatScheduleDate(row.scheduled_payout_date),
        completed ? "completed" : "pending",
      ];
    });
    return { headers, rows };
  }, [treasurerPayoutRows]);

  const fetchTreasurerPayouts = useCallback(async () => {
    if (!session?.access_token || !stokvel_id || !isTreasurerRole) {
      setTreasurerPayoutRows([]);
      return;
    }
    setPayoutsLoading(true);
    setPayoutActionError("");
    try {
      const res = await fetch(apiUrl(`/api/stokvels/${stokvel_id}/payouts`), {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const text = await res.text();
      const json = text ? JSON.parse(text) : {};
      if (!res.ok) throw new Error(json?.error || text || `HTTP ${res.status}`);
      setTreasurerPayoutRows(Array.isArray(json.payouts) ? json.payouts : []);
    } catch (e) {
      setPayoutActionError(e.message ?? String(e));
      setTreasurerPayoutRows([]);
    } finally {
      setPayoutsLoading(false);
    }
  }, [session?.access_token, stokvel_id, isTreasurerRole]);

  useEffect(() => {
    void fetchTreasurerPayouts();
  }, [fetchTreasurerPayouts]);

  async function handleDisbursePayout(row) {
    if (!session?.access_token || !stokvel_id || !row?.id) return;
    setPayoutActionLoadingId(row.id);
    setPayoutActionError("");
    setPayoutActionOk("");
    try {
      const res = await fetch(
        apiUrl(`/api/stokvels/${stokvel_id}/payouts/${row.id}/disburse`),
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        },
      );
      const text = await res.text();
      const json = text ? JSON.parse(text) : {};
      if (!res.ok) throw new Error(json?.error || text || `HTTP ${res.status}`);
      setPayoutActionOk("Payout marked as completed.");
      await fetchTreasurerPayouts();
    } catch (e) {
      setPayoutActionError(e.message ?? String(e));
    } finally {
      setPayoutActionLoadingId("");
    }
  }

  if (!stokvel_id) {
    return null;
  }

  return (
    <div>
      {ledgerToast ? (
        <div
          className="fixed bottom-6 left-1/2 z-60 max-w-md -translate-x-1/2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-900 shadow-lg dark:border-emerald-800 dark:bg-emerald-950/90 dark:text-emerald-100"
          role="status"
        >
          {ledgerToast}
        </div>
      ) : null}

      {membership && stokvelStatus === "rejected" ? (
        <div
          className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200"
          role="status"
        >
          <strong className="font-semibold text-red-900 dark:text-red-100">
            Application rejected.
          </strong>{" "}
          This stokvel is not active (status:{" "}
          <span className="font-mono">rejected</span>). Meeting and treasury
          actions are disabled for this group.
        </div>
      ) : null}
      {membership && stokvelStatus === "pending" ? (
        <div
          className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-100"
          role="status"
        >
          <strong className="font-semibold text-amber-950 dark:text-amber-50">
            Awaiting approval.
          </strong>{" "}
          A platform admin has not activated this stokvel yet. You will see an
          active status here once it is approved.
        </div>
      ) : null}

      <div
        className={`mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between ${
          isActiveStokvel
            ? "rounded-xl border-t-4 border-emerald-700 pt-4"
            : "rounded-xl border-t-4 border-stone-300 pt-4"
        }`}
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-emerald-800 sm:text-3xl">
            <span className="flex items-center gap-2">
              <i className="fa-solid fa-wallet text-emerald-700" aria-hidden />
              Payments &amp; finances
            </span>
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
          ) : null}
          <div className="mt-2 inline-flex items-center gap-2 rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100">
            <span className="font-semibold uppercase tracking-wide">
              Current treasurer
            </span>
            <span className="text-emerald-900 dark:text-emerald-50">
              {currentTreasurerName}
            </span>
          </div>
        </div>
      </div>

      {!session ? (
        <p className="mb-6 text-sm text-stone-500">
          Sign in to view this stokvel.
        </p>
      ) : null}

      {error ? <p className={`mb-6 ${errorBox}`}>{error}</p> : null}

      {session && loading ? (
        <div className="flex justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-green-600" />
        </div>
      ) : null}

      {session && !loading && membership ? (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium text-stone-600 dark:text-stone-300">
              Finance summary
            </p>
            <ReportExportActions
              title="Finance summary"
              subtitle={reportExportSubtitle}
              filenameBase={`${groupName || "stokvel"}_finance_summary`}
              headers={financeSummaryExport.headers}
              rows={financeSummaryExport.rows}
            />
          </div>
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {statCards.map((card) => (
              <div key={card.label} className={`${cardLight} p-4`}>
                <p className="mb-1 text-xs font-semibold uppercase text-stone-500 dark:text-stone-400">
                  {card.label}
                </p>
                <p className="text-xl font-semibold text-stone-800 dark:text-stone-100">
                  {card.value}
                </p>
              </div>
            ))}
          </div>

          <PayoutReportPanel
            stokvelId={stokvel_id}
            accessToken={session?.access_token}
            enabled={Boolean(session && membership)}
          />

          <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-stretch">
            <div className="h-full">
              <MarketRatesWidget
                memberMonthlyContribution={monthlyContribution}
                className="h-full"
              />
            </div>
            <div className="flex h-full flex-col gap-4">
              <div className={`${cardLight} p-4`}>
                <span className="text-sm font-bold text-stone-800 dark:text-stone-100">
                  Quick Pay
                </span>
                <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">
                  {cycleBannerText}
                </p>
                <button
                  type="button"
                  disabled={!quickPayEnabled}
                  onClick={() => quickPayEnabled && setQuickPayOpen(true)}
                  className={`${btnPrimary} mt-3 w-full py-2.5 text-base disabled:cursor-not-allowed disabled:opacity-40`}
                >
                  {monthlyContribution > 0
                    ? `Pay monthly contribution (${formatZAR(monthlyContribution)})`
                    : "Pay monthly contribution"}
                </button>
                {!quickPayEnabled && quickPayDisabledReason ? (
                  <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                    {quickPayDisabledReason}
                  </p>
                ) : null}
              </div>

              <section className={`${cardLight} min-h-0 flex-1 p-4`}>
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2 border-b border-stone-200 pb-2 dark:border-slate-700">
                  <h3 className="text-lg font-bold text-emerald-800 dark:text-emerald-300">
                    Payout schedule
                  </h3>
                  <ReportExportActions
                    title="Payout schedule"
                    subtitle={reportExportSubtitle}
                    filenameBase={`${groupName || "stokvel"}_payout_schedule`}
                    headers={payoutScheduleExport.headers}
                    rows={payoutScheduleExport.rows}
                  />
                </div>
                <p className="mb-3 text-xs text-stone-500 dark:text-stone-400">
                  Scheduled payouts from the group roster (amount ≈ pool for
                  that cycle).
                </p>
                {canManagePayoutOrder ? (
                  <p className="mb-3 text-xs text-stone-600 dark:text-stone-300">
                    Treasurers can reorder upcoming payouts only. Completed
                    payouts are locked.
                  </p>
                ) : null}
                <div className={tableWrap}>
                  <table className="w-full min-w-[280px] text-left text-sm text-stone-800 dark:text-stone-100">
                    <thead>
                      <tr className={tableHead}>
                        <th className="p-3">Date</th>
                        <th className="p-3">Member</th>
                        <th className="p-3">Expected amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr className={tableRow}>
                          <td colSpan={3} className="p-6">
                            <div className="flex justify-center">
                              <Loader2 className="h-8 w-8 animate-spin text-green-600" />
                            </div>
                          </td>
                        </tr>
                      ) : payouts.length === 0 ? (
                        <tr className={tableRow}>
                          <td
                            colSpan={3}
                            className="p-6 text-center text-stone-500 italic"
                          >
                            No payout schedule yet.
                          </td>
                        </tr>
                      ) : (
                        payouts.map((p) => {
                          const prof =
                            members.find((m) => m.user_id === p.user_id)
                              ?.profiles ?? null;
                          return (
                            <tr
                              key={p.id ?? `${p.user_id}-${p.target_month}`}
                              className={tableRow}
                            >
                              <td className="p-3 whitespace-nowrap">
                                {formatScheduleDate(p.scheduled_payout_date)}
                              </td>
                              <td className="p-3">{memberDisplay(prof)}</td>
                              <td className="p-3">
                                {formatZAR(expectedPayout)}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                {canManagePayoutOrder && upcomingPayouts.length > 1 ? (
                  <div className="mt-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
                      Reorder upcoming disbursements
                    </p>
                    <DragDropContext onDragEnd={handleUpcomingPayoutDragEnd}>
                      <Droppable droppableId="payments-upcoming-payout-order">
                        {(droppableProvided) => (
                          <ul
                            ref={droppableProvided.innerRef}
                            {...droppableProvided.droppableProps}
                            className="flex flex-col gap-2 rounded-lg border border-stone-200 bg-stone-50/80 p-2"
                          >
                            {upcomingPayoutsInUiOrder.map((payout, index) => {
                              const prof =
                                members.find(
                                  (m) => m.user_id === payout.user_id,
                                )?.profiles ?? null;
                              return (
                                <Draggable
                                  key={payout.id}
                                  draggableId={String(payout.id)}
                                  index={index}
                                >
                                  {(dragProvided, snapshot) => (
                                    <li
                                      ref={dragProvided.innerRef}
                                      {...dragProvided.draggableProps}
                                      className={`flex items-center gap-3 rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm shadow-sm dark:border-slate-600 dark:bg-slate-900 ${
                                        snapshot.isDragging
                                          ? "ring-2 ring-emerald-500/40"
                                          : ""
                                      }`}
                                    >
                                      <button
                                        type="button"
                                        className="touch-none rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700 dark:text-stone-500 dark:hover:bg-slate-800 dark:hover:text-stone-200"
                                        aria-label="Drag payout to reorder"
                                        {...dragProvided.dragHandleProps}
                                      >
                                        <GripVertical className="h-4 w-4" />
                                      </button>
                                      <div className="min-w-0 flex-1">
                                        <p className="truncate font-medium text-stone-900 dark:text-stone-100">
                                          {memberDisplay(prof)}
                                        </p>
                                        <p className="truncate text-xs text-stone-600 dark:text-stone-300">
                                          {formatScheduleDate(
                                            payout.scheduled_payout_date,
                                          )}
                                        </p>
                                      </div>
                                    </li>
                                  )}
                                </Draggable>
                              );
                            })}
                            {droppableProvided.placeholder}
                          </ul>
                        )}
                      </Droppable>
                    </DragDropContext>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        className={`${btnPrimary} px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50`}
                        disabled={payoutOrderSaving}
                        onClick={() => void handlePayoutOrderSave()}
                      >
                        {payoutOrderSaving
                          ? "Saving order…"
                          : "Save upcoming payout order"}
                      </button>
                      {!payoutOrderChanged ? (
                        <span className="text-xs text-stone-500 dark:text-stone-400">
                          No changes yet.
                        </span>
                      ) : null}
                    </div>
                    {settledPayouts.length > 0 ? (
                      <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
                        {settledPayouts.length} completed payout
                        {settledPayouts.length === 1 ? "" : "s"} locked.
                      </p>
                    ) : null}
                    {payoutOrderError ? (
                      <p className="mt-2 text-xs text-red-700 dark:text-red-300">
                        {payoutOrderError}
                      </p>
                    ) : null}
                    {payoutOrderOk ? (
                      <p className="mt-2 text-xs text-emerald-800 dark:text-emerald-200">
                        {payoutOrderOk}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </section>
            </div>
          </div>

          {/* ---- Contribution Compliance Report ---- */}
          <div className="mt-10">
            <ComplianceReportWidget
              members={members}
              contributions={contributions}
              missedPayments={missedPayments}
              ledgerMonths={ledgerMonths}
            />
          </div>

          <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="order-1 space-y-8 lg:col-span-2">
              <section>
                <div className="mb-4 flex flex-wrap items-start justify-between gap-2 border-b border-stone-200 pb-2 dark:border-slate-700">
                  <h3 className="text-lg font-bold text-emerald-800 dark:text-emerald-300">
                    Cycle ledger
                  </h3>
                  <ReportExportActions
                    title="Cycle ledger (all cycles)"
                    subtitle={reportExportSubtitle}
                    filenameBase={`${groupName || "stokvel"}_cycle_ledger_all`}
                    headers={cycleLedgerExportAll.headers}
                    rows={cycleLedgerExportAll.rows}
                    disabled={ledgerMonths.length === 0}
                  />
                </div>
                {approvalError ? (
                  <p className={`mb-4 text-sm ${errorBox}`} role="alert">
                    {approvalError}
                  </p>
                ) : null}
                {ledgerMonths.length === 0 ? (
                  <p className="text-sm italic text-stone-500 dark:text-stone-400">
                    No contribution cycles recorded yet.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    {ledgerMonths.map((month) => {
                      const isPastMonth = month < refMonth;
                      return (
                        <div
                          key={month}
                          className={`${cardLight} overflow-hidden`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 bg-stone-50/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/40">
                            <h4 className="text-sm font-bold text-stone-800 dark:text-stone-100">
                              {month}
                            </h4>
                            <ReportExportActions
                              title={`Cycle ledger — ${month}`}
                              subtitle={reportExportSubtitle}
                              filenameBase={`${groupName || "stokvel"}_cycle_ledger_${month}`}
                              headers={cycleLedgerExportByMonth.headers}
                              rows={
                                cycleLedgerExportByMonth.byMonth[month] ?? []
                              }
                            />
                          </div>
                          <div className={tableWrap}>
                            <table className="w-full min-w-[320px] text-left text-sm text-stone-800 dark:text-stone-100">
                              <thead>
                                <tr className={tableHead}>
                                  <th className="p-3">Member</th>
                                  <th className="p-3">Status</th>
                                  <th className="p-3">Approved?</th>
                                  {canFlagMissed ? (
                                    <th className="min-w-[10rem] p-3 text-right">
                                      Action
                                    </th>
                                  ) : null}
                                </tr>
                              </thead>
                              <tbody>
                                {sortedMembers.map((m) => {
                                  const paid = memberPaidForMonth(
                                    contributions,
                                    m.user_id,
                                    month,
                                  );
                                  const contrib = primaryContributionForMonth(
                                    contributions,
                                    m.user_id,
                                    month,
                                  );
                                  const flagged = memberFlaggedForMonth(
                                    missedPayments,
                                    m.user_id,
                                    month,
                                  );
                                  let statusKey = "unpaid";
                                  let statusLabel = "Unpaid";
                                  let dotClass = "bg-stone-400";
                                  if (paid) {
                                    statusKey = "paid";
                                    statusLabel = "Paid";
                                    dotClass = "bg-emerald-500";
                                  } else if (flagged) {
                                    statusKey = "flagged";
                                    statusLabel = "Unpaid (Missed Deadline)";
                                    dotClass = "bg-red-500";
                                  }
                                  const showFlag =
                                    canFlagMissed &&
                                    isPastMonth &&
                                    statusKey === "unpaid" &&
                                    m.user_id !== uid;
                                  const approvalState =
                                    paid && contrib?.id
                                      ? treasurerApprovalStatus(contrib)
                                      : null;
                                  const showPaidApprovalControls =
                                    canFlagMissed &&
                                    paid &&
                                    contrib?.id &&
                                    approvalState;
                                  const busy =
                                    approvalSubmittingId === contrib?.id;
                                  const memberNm = memberDisplay(m.profiles);
                                  return (
                                    <tr
                                      key={`${month}-${m.user_id}`}
                                      className={tableRow}
                                    >
                                      <td className="p-3">
                                        {memberDisplay(m.profiles)}
                                      </td>
                                      <td className="p-3">
                                        <span className="inline-flex items-center gap-2">
                                          <span
                                            className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${dotClass}`}
                                            aria-hidden
                                          />
                                          <span>{statusLabel}</span>
                                        </span>
                                      </td>
                                      <td className="p-3">
                                        <span className="inline-flex items-center gap-2">
                                          <span
                                            className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${treasurerApprovalDotClass(contrib)}`}
                                            aria-hidden
                                          />
                                          <span>
                                            {treasurerApprovalColumnLabel(
                                              contrib,
                                            )}
                                          </span>
                                        </span>
                                      </td>
                                      {canFlagMissed ? (
                                        <td className="p-3 text-right">
                                          {showPaidApprovalControls ? (
                                            <span className="inline-flex max-w-[11rem] flex-wrap items-center justify-end gap-1 sm:max-w-none">
                                              {approvalState === "pending" ? (
                                                <>
                                                  <button
                                                    type="button"
                                                    disabled={busy}
                                                    className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-base leading-none hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-800 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/50"
                                                    title="Approve — funds received in bank"
                                                    aria-label={`Approve payment for ${memberNm}`}
                                                    onClick={() =>
                                                      submitTreasurerApproval(
                                                        contrib.id,
                                                        "approved",
                                                      )
                                                    }
                                                  >
                                                    ✅
                                                  </button>
                                                  <button
                                                    type="button"
                                                    disabled={busy}
                                                    className="rounded border border-red-200 bg-red-50 px-2 py-1 text-base leading-none hover:bg-red-100 disabled:opacity-50 dark:border-red-900 dark:bg-red-950/40 dark:hover:bg-red-900/40"
                                                    title="Not approved — did not reflect in bank"
                                                    aria-label={`Reject payment confirmation for ${memberNm}`}
                                                    onClick={() =>
                                                      submitTreasurerApproval(
                                                        contrib.id,
                                                        "rejected",
                                                      )
                                                    }
                                                  >
                                                    ❌
                                                  </button>
                                                </>
                                              ) : null}
                                              {approvalState === "approved" ? (
                                                <>
                                                  <button
                                                    type="button"
                                                    disabled={busy}
                                                    className="rounded border border-red-200 bg-red-50 px-2 py-1 text-base leading-none hover:bg-red-100 disabled:opacity-50 dark:border-red-900 dark:bg-red-950/40 dark:hover:bg-red-900/40"
                                                    title="Mark as not approved — did not reflect in bank"
                                                    aria-label={`Mark payment as not approved for ${memberNm}`}
                                                    onClick={() =>
                                                      submitTreasurerApproval(
                                                        contrib.id,
                                                        "rejected",
                                                      )
                                                    }
                                                  >
                                                    ❌
                                                  </button>
                                                  <button
                                                    type="button"
                                                    disabled={busy}
                                                    className="rounded border border-stone-300 bg-stone-100 px-2 py-1 text-sm font-medium leading-none text-stone-800 hover:bg-stone-200 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-stone-100 dark:hover:bg-slate-700"
                                                    title="Reset to pending — needs another bank review"
                                                    aria-label={`Reset approval to pending for ${memberNm}`}
                                                    onClick={() =>
                                                      submitTreasurerApproval(
                                                        contrib.id,
                                                        "pending",
                                                      )
                                                    }
                                                  >
                                                    ↺
                                                  </button>
                                                </>
                                              ) : null}
                                              {approvalState === "rejected" ? (
                                                <>
                                                  <button
                                                    type="button"
                                                    disabled={busy}
                                                    className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-base leading-none hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-800 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/50"
                                                    title="Approve — funds received in bank"
                                                    aria-label={`Approve payment for ${memberNm}`}
                                                    onClick={() =>
                                                      submitTreasurerApproval(
                                                        contrib.id,
                                                        "approved",
                                                      )
                                                    }
                                                  >
                                                    ✅
                                                  </button>
                                                  <button
                                                    type="button"
                                                    disabled={busy}
                                                    className="rounded border border-stone-300 bg-stone-100 px-2 py-1 text-sm font-medium leading-none text-stone-800 hover:bg-stone-200 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-stone-100 dark:hover:bg-slate-700"
                                                    title="Reset to pending — needs another bank review"
                                                    aria-label={`Reset approval to pending for ${memberNm}`}
                                                    onClick={() =>
                                                      submitTreasurerApproval(
                                                        contrib.id,
                                                        "pending",
                                                      )
                                                    }
                                                  >
                                                    ↺
                                                  </button>
                                                </>
                                              ) : null}
                                            </span>
                                          ) : showFlag ? (
                                            <button
                                              type="button"
                                              className="text-xs font-semibold text-amber-800 underline-offset-2 hover:underline dark:text-amber-300"
                                              onClick={() =>
                                                setFlaggingCandidate({
                                                  userId: m.user_id,
                                                  targetMonth: month,
                                                  memberName: memberDisplay(
                                                    m.profiles,
                                                  ),
                                                })
                                              }
                                            >
                                              Flag
                                            </button>
                                          ) : (
                                            <span className="text-xs text-stone-400">
                                              —
                                            </span>
                                          )}
                                        </td>
                                      ) : null}
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {isTreasurerRole ? (
                <section className={`${cardLight} w-full p-4`}>
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-2 border-b border-stone-200 pb-2 dark:border-slate-700">
                    <h3 className="text-lg font-bold text-emerald-800 dark:text-emerald-300">
                      Payouts (Treasurer)
                    </h3>
                    <ReportExportActions
                      title="Payouts (Treasurer)"
                      subtitle={reportExportSubtitle}
                      filenameBase={`${groupName || "stokvel"}_treasurer_payouts`}
                      headers={treasurerPayoutsExport.headers}
                      rows={treasurerPayoutsExport.rows}
                      disabled={payoutsLoading}
                    />
                  </div>
                  {payoutActionError ? (
                    <p className="mb-2 text-xs text-red-700 dark:text-red-300">
                      {payoutActionError}
                    </p>
                  ) : null}
                  {payoutActionOk ? (
                    <p className="mb-2 text-xs text-emerald-800 dark:text-emerald-200">
                      {payoutActionOk}
                    </p>
                  ) : null}
                  <div className={tableWrap}>
                    <table className="w-full min-w-[520px] table-fixed border-collapse text-left text-sm text-stone-800 dark:text-stone-100">
                      <colgroup>
                        <col className="w-[38%] min-w-0" />
                        <col className="w-[24%]" />
                        <col className="w-[12%]" />
                        <col className="w-[26%]" />
                      </colgroup>
                      <thead>
                        <tr className={tableHead}>
                          <th className="p-3 text-left align-middle">
                            Member name
                          </th>
                          <th className="p-3 text-left align-middle">
                            Payout date
                          </th>
                          <th className="p-3 text-left align-middle">Status</th>
                          <th className="p-3 text-right align-middle">
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {payoutsLoading ? (
                          <tr className={tableRow}>
                            <td
                              colSpan={4}
                              className="p-6 text-center text-stone-500"
                            >
                              Loading payouts…
                            </td>
                          </tr>
                        ) : treasurerPayoutRows.length === 0 ? (
                          <tr className={tableRow}>
                            <td
                              colSpan={4}
                              className="p-6 text-center text-stone-500 italic"
                            >
                              No payout records available.
                            </td>
                          </tr>
                        ) : (
                          treasurerPayoutRows.map((row) => {
                            const fullName = memberDisplay(row.profile);
                            const payoutDate = String(
                              row.scheduled_payout_date || "",
                            ).slice(0, 10);
                            const todayIso = new Date()
                              .toISOString()
                              .slice(0, 10);
                            const completed =
                              String(row.status || "").toLowerCase() ===
                              "completed";
                            const isDisabled =
                              completed || !payoutDate || todayIso < payoutDate;
                            return (
                              <tr key={row.id} className={tableRow}>
                                <td className="p-3 align-middle">{fullName}</td>
                                <td className="p-3 text-left align-middle whitespace-nowrap">
                                  {formatScheduleDate(
                                    row.scheduled_payout_date,
                                  )}
                                </td>
                                <td className="p-3 text-left align-middle capitalize">
                                  {completed ? "completed" : "pending"}
                                </td>
                                <td className="p-3 text-right align-middle">
                                  <button
                                    type="button"
                                    disabled={
                                      isDisabled ||
                                      payoutActionLoadingId === row.id
                                    }
                                    onClick={() =>
                                      void handleDisbursePayout(row)
                                    }
                                    className={`${btnPrimary} px-3 py-1.5 text-xs disabled:opacity-40`}
                                  >
                                    {payoutActionLoadingId === row.id
                                      ? "Processing…"
                                      : "Payout"}
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : null}
            </div>

            <div className="order-2">
              {canManageTreasurer ? (
                <section className="mb-8">
                  <h3 className="mb-4 border-b border-stone-200 pb-2 text-lg font-bold text-emerald-800 dark:border-slate-700 dark:text-emerald-300">
                    Assign treasurer
                  </h3>
                  <div className={`${cardLight} space-y-3 p-4`}>
                    <label className="block text-xs font-semibold uppercase text-stone-500 dark:text-stone-400">
                      Treasurer member
                      <select
                        value={treasurerUserId}
                        onChange={(e) => setTreasurerUserId(e.target.value)}
                        className={`${inputLight} mt-2`}
                      >
                        <option value="">Select member</option>
                        {members.map((m) => (
                          <option key={m.user_id} value={m.user_id}>
                            {memberDisplay(m.profiles)} (
                            {formatGroupRole(m.group_role)})
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      onClick={handleTreasurerSave}
                      disabled={treasurerSaving || !treasurerUserId}
                      className={`${btnPrimary} w-full disabled:cursor-not-allowed disabled:opacity-50`}
                    >
                      {treasurerSaving ? "Saving…" : "Save treasurer"}
                    </button>
                    {treasurerError ? (
                      <p className="text-xs text-red-700 dark:text-red-300">
                        {treasurerError}
                      </p>
                    ) : null}
                    {treasurerOk ? (
                      <p className="text-xs text-emerald-800 dark:text-emerald-200">
                        {treasurerOk}
                      </p>
                    ) : null}
                  </div>
                </section>
              ) : null}
            </div>
          </div>

          {quickPayOpen ? (
            <QuickPayModal
              groupName={groupName}
              stokvelId={stokvel_id}
              session={session}
              monthlyContribution={monthlyContribution}
              onClose={() => setQuickPayOpen(false)}
              onRecordError={(message) =>
                setError(
                  `Payment succeeded, but contribution was not recorded: ${message}`,
                )
              }
              onSuccess={async () => {
                setQuickPayOpen(false);
                try {
                  await silentReloadDetail();
                } catch (e) {
                  setError(e.message ?? String(e));
                }
              }}
            />
          ) : null}

          {flaggingCandidate ? (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="flag-missed-title"
            >
              <div className={`${cardLight} w-full max-w-md p-6`}>
                <h2
                  id="flag-missed-title"
                  className="mb-3 text-lg font-bold text-stone-800 dark:text-stone-100"
                >
                  Flag missed payment?
                </h2>
                <p className="text-sm text-stone-600 dark:text-stone-300">
                  Are you sure you want to flag{" "}
                  <strong className="text-stone-800 dark:text-stone-100">
                    {flaggingCandidate.memberName}
                  </strong>{" "}
                  for missed payment in{" "}
                  <span className="font-mono">
                    {flaggingCandidate.targetMonth}
                  </span>
                  ?
                </p>
                <div className="mt-6 flex gap-3">
                  <button
                    type="button"
                    disabled={flaggingSubmitting}
                    className={`${btnPrimary} flex-1 py-2 text-sm disabled:opacity-50`}
                    onClick={() => void confirmFlagMissedPayment()}
                  >
                    {flaggingSubmitting ? "Saving…" : "Confirm"}
                  </button>
                  <button
                    type="button"
                    disabled={flaggingSubmitting}
                    className={`${btnSecondary} flex-1 py-2 text-sm disabled:opacity-50`}
                    onClick={() => setFlaggingCandidate(null)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
