/** @param {string} todayIso YYYY-MM-DD (SAST calendar day) */
export function payoutHasHappenedOnDate(scheduledPayoutDate, todayIso) {
  const scheduled = String(scheduledPayoutDate ?? "").slice(0, 10);
  if (!scheduled) return false;
  return scheduled < todayIso;
}

export function normalizePayoutStatus(payout) {
  if (
    String(payout?.status ?? "").toLowerCase() === "completed" ||
    payout?.disbursed_at
  ) {
    return "completed";
  }
  return "pending";
}

export function isPayoutInHistory(payout, todayIso) {
  if (normalizePayoutStatus(payout) === "completed") return true;
  return payoutHasHappenedOnDate(payout?.scheduled_payout_date, todayIso);
}

function sortPayoutRows(a, b) {
  const da = String(a.scheduled_payout_date ?? "");
  const db = String(b.scheduled_payout_date ?? "");
  if (da !== db) return da < db ? -1 : da > db ? 1 : 0;
  return (Number(a.cycle_index) || 0) - (Number(b.cycle_index) || 0);
}

function profileForUser(profileById, members, userId) {
  const fromMap = profileById?.get?.(userId);
  if (fromMap) return fromMap;
  const member = (members ?? []).find((m) => m.user_id === userId);
  return member?.profiles ?? null;
}

function yearFromIsoDate(iso) {
  const s = String(iso ?? "").slice(0, 10);
  const y = parseInt(s.slice(0, 4), 10);
  return Number.isFinite(y) ? y : null;
}

/** Member payout history & upcoming projections (pool = contribution × member count, or Fixed projection). */
export function buildPayoutReport({
  stokvel,
  payoutRows,
  members,
  profileById,
  viewerUserId,
  todayIso,
  fixedPoolProjection = null,
}) {
  const memberCount = (members ?? []).length;
  const monthlyContribution = Number(stokvel?.contribution_amount) || 0;
  const expectedPayoutAmount =
    fixedPoolProjection?.expected_payout_per_member != null
      ? fixedPoolProjection.expected_payout_per_member
      : monthlyContribution * memberCount;
  const currentYear = parseInt(String(todayIso).slice(0, 4), 10);

  const enrich = (p) => {
    const prof = profileForUser(profileById, members, p.user_id);
    const isMine = viewerUserId != null && p.user_id === viewerUserId;
    return {
      id: p.id,
      user_id: p.user_id,
      target_month: p.target_month,
      scheduled_payout_date: p.scheduled_payout_date,
      cycle_index: p.cycle_index,
      status: normalizePayoutStatus(p),
      disbursed_at: p.disbursed_at ?? null,
      is_mine: isMine,
      expected_amount: expectedPayoutAmount,
      profile: prof
        ? {
            first_name: prof.first_name ?? "",
            last_name: prof.last_name ?? "",
          }
        : null,
    };
  };

  const history = [];
  const upcomingProjections = [];

  for (const p of (payoutRows ?? []).slice().sort(sortPayoutRows)) {
    const row = enrich(p);
    if (isPayoutInHistory(p, todayIso)) history.push(row);
    else upcomingProjections.push(row);
  }

  const myHistory = history.filter((r) => r.is_mine);
  const myUpcoming = upcomingProjections.filter((r) => r.is_mine);
  const myNextRow = myUpcoming[0] ?? null;

  let totalReceivedYtd = 0;
  for (const row of myHistory) {
    if (row.status !== "completed") continue;
    const yr = yearFromIsoDate(row.disbursed_at || row.scheduled_payout_date);
    if (yr === currentYear) totalReceivedYtd += expectedPayoutAmount;
  }

  return {
    summary: {
      monthly_contribution: monthlyContribution,
      member_count: memberCount,
      expected_payout_amount: expectedPayoutAmount,
      fixed_pool: fixedPoolProjection,
    },
    my_summary: {
      next_expected: myNextRow
        ? {
            scheduled_payout_date: myNextRow.scheduled_payout_date,
            target_month: myNextRow.target_month,
            expected_amount: myNextRow.expected_amount,
            status: myNextRow.status,
          }
        : null,
      total_received_ytd: totalReceivedYtd,
    },
    history,
    upcoming_projections: upcomingProjections,
    my_history: myHistory,
    my_upcoming: myUpcoming,
  };
}
