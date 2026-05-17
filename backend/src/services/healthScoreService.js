/**
 * Member health score: extracts features from Supabase (passed-in client only),
 * calls internal Flask sklearn service, with weighted fallback if ML is down.
 */

import {
  getTargetMonthForPaidAt,
  isPaidAtInWindowForTargetMonth,
} from "../utils/dates.js";

const DAY_MS = 86_400_000;

const ML_PREDICT_URL =
  typeof process.env.ML_HEALTH_PREDICT_URL === "string" &&
  process.env.ML_HEALTH_PREDICT_URL.trim()
    ? process.env.ML_HEALTH_PREDICT_URL.trim()
    : "http://127.0.0.1:5001/predict";

function contributionWindowEndMs(targetMonth) {
  const [ys, ms] = targetMonth.split("-").map(Number);
  return Date.UTC(ys, ms - 1, 5, 21, 59, 59, 999);
}

function gradeFromScore(score) {
  if (score >= 85) return "Excellent";
  if (score >= 65) return "Good";
  if (score >= 45) return "Fair";
  return "At Risk";
}

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

function dedupeContributionsByMonth(rows) {
  /** @type {Map<string, { paid_at: string, target_month: string, onTime: boolean }>} */
  const byMonth = new Map();

  for (const c of rows) {
    const rejected =
      String(c?.treasurer_approval_status ?? "").toLowerCase() === "rejected";
    if (rejected) continue;

    const paidRaw = c?.paid_at;
    if (!paidRaw) continue;

    const tm =
      typeof c?.target_month === "string" && /^\d{4}-\d{2}$/.test(c.target_month)
        ? c.target_month
        : getTargetMonthForPaidAt(paidRaw);

    if (!tm) continue;

    const onTime = isPaidAtInWindowForTargetMonth(paidRaw, tm);
    const prev = byMonth.get(tm);
    if (!prev) {
      byMonth.set(tm, { paid_at: paidRaw, target_month: tm, onTime });
      continue;
    }
    if (onTime && !prev.onTime) {
      byMonth.set(tm, { paid_at: paidRaw, target_month: tm, onTime });
    } else if (onTime === prev.onTime) {
      const prevT = new Date(prev.paid_at).getTime();
      const nextT = new Date(paidRaw).getTime();
      if (!Number.isNaN(nextT) && nextT > prevT) {
        byMonth.set(tm, { paid_at: paidRaw, target_month: tm, onTime });
      }
    }
  }
  return byMonth;
}

function daysLate(paidAt, targetMonth) {
  const t = new Date(paidAt);
  if (Number.isNaN(t.getTime())) return 0;
  const end = contributionWindowEndMs(targetMonth);
  const delta = t.getTime() - end;
  if (delta <= 0) return 0;
  return Math.ceil(delta / DAY_MS);
}

function computeStreakMonths(sortedAscYm, byMonth) {
  let streak = 0;
  for (let i = sortedAscYm.length - 1; i >= 0; i--) {
    const ym = sortedAscYm[i];
    const cell = byMonth.get(ym);
    if (cell?.onTime) streak++;
    else break;
  }
  return streak;
}

function ymFromMeetingDate(meetingDate) {
  const s = String(meetingDate ?? "").slice(0, 10);
  return s.length >= 7 ? s.slice(0, 7) : null;
}

function monthsBetween(joinIso, until = new Date()) {
  const j = new Date(joinIso);
  if (Number.isNaN(j.getTime())) return 1;
  const y = until.getFullYear() - j.getFullYear();
  const m = until.getMonth() - j.getMonth();
  return Math.max(1, y * 12 + m + 1);
}

async function callMlService(featurePayload) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 8000);
  try {
    const res = await fetch(ML_PREDICT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(featurePayload),
      signal: ac.signal,
    });
    const text = await res.text();
    if (!res.ok) return null;
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function weightedFallback(features) {
  const onTimePct = features.on_time_rate * 100;
  const missedPart = Math.max(0, 100 - features.missed_payments * 20);
  const streakPart = Math.min(100, features.streak_months * 10);
  const engagementPct = features.engagement_rate * 100;
  const raw =
    onTimePct * 0.4 +
    missedPart * 0.25 +
    streakPart * 0.2 +
    engagementPct * 0.15;
  const score = round2(Math.min(100, Math.max(0, raw)));
  return {
    score,
    grade: gradeFromScore(score),
    confidence: round2(55),
    feature_importances: null,
    model_version: "fallback",
  };
}

/**
 * @param {string} userId
 * @param {string} groupId
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseClient
 */
export async function calculateHealthScore(userId, groupId, supabaseClient) {
  const todayStr = new Date().toISOString().slice(0, 10);

  const [contribRes, missedRes, meetingsRes, memberRes] = await Promise.all([
    supabaseClient
      .from("contributions")
      .select(
        "paid_at, target_month, treasurer_approval_status, amount, user_id, stokvel_id",
      )
      .eq("stokvel_id", groupId)
      .eq("user_id", userId),
    supabaseClient
      .from("missed_payments")
      .select("id, resolved_at")
      .eq("stokvel_id", groupId)
      .eq("user_id", userId),
    supabaseClient
      .from("meetings")
      .select("id, meeting_date")
      .eq("stokvel_id", groupId),
    supabaseClient
      .from("stokvel_members")
      .select("created_at")
      .eq("stokvel_id", groupId)
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  if (contribRes.error) throw new Error(contribRes.error.message);
  if (missedRes.error) throw new Error(missedRes.error.message);
  if (meetingsRes.error) throw new Error(meetingsRes.error.message);
  if (memberRes.error) throw new Error(memberRes.error.message);

  const rawRows = contribRes.data ?? [];
  const totalContributions = rawRows.filter((c) => {
    if (String(c?.treasurer_approval_status ?? "").toLowerCase() === "rejected")
      return false;
    return Boolean(c?.paid_at);
  }).length;

  const unresolvedMissed = (missedRes.data ?? []).filter((r) => !r?.resolved_at)
    .length;

  const byMonth = dedupeContributionsByMonth(rawRows);
  const countedMonths = [...byMonth.keys()].sort();

  const pastMeetings = (meetingsRes.data ?? []).filter((m) => {
    const d = String(m?.meeting_date ?? "").slice(0, 10);
    return d && d <= todayStr;
  });

  const joinYm = memberRes.data?.created_at
    ? String(memberRes.data.created_at).slice(0, 7)
    : "1900-01";

  let engagementRate = 1.0;
  if (pastMeetings.length === 0) {
    engagementRate = 1.0;
  } else {
    const meetingMonthSet = new Set();
    for (const m of pastMeetings) {
      const ym = ymFromMeetingDate(m.meeting_date);
      if (ym && ym >= joinYm) meetingMonthSet.add(ym);
    }
    if (meetingMonthSet.size === 0) {
      engagementRate = 1.0;
    } else {
      let overlap = 0;
      for (const ym of countedMonths) {
        if (ym >= joinYm && meetingMonthSet.has(ym)) overlap++;
      }
      engagementRate = Math.min(1, overlap / meetingMonthSet.size);
    }
  }

  const streakMonths = computeStreakMonths(countedMonths, byMonth);

  let onTimeRateRatio = 0;
  let avgDaysLate = null;
  if (countedMonths.length > 0) {
    let onTimeCount = 0;
    let lateDaysSum = 0;
    let lateCount = 0;
    for (const ym of countedMonths) {
      const cell = byMonth.get(ym);
      if (!cell) continue;
      if (cell.onTime) onTimeCount++;
      else {
        const dl = daysLate(cell.paid_at, ym);
        if (dl > 0) {
          lateDaysSum += dl;
          lateCount++;
        }
      }
    }
    const n = countedMonths.length;
    onTimeRateRatio = onTimeCount / n;
    avgDaysLate =
      lateCount > 0 ? round2(lateDaysSum / lateCount) : round2(0);
  }

  const monthsActive = memberRes.data?.created_at
    ? monthsBetween(memberRes.data.created_at)
    : 1;

  const features = {
    on_time_rate: round2(Math.min(1, Math.max(0, onTimeRateRatio))),
    missed_payments: unresolvedMissed,
    avg_days_late: avgDaysLate != null ? avgDaysLate : 0,
    streak_months: streakMonths,
    engagement_rate: round2(Math.min(1, Math.max(0, engagementRate))),
    months_active: monthsActive,
    total_contributions: totalContributions,
  };

  const insufficientData = countedMonths.length === 0;
  const lowConfidenceFlag = countedMonths.length === 1;

  if (insufficientData) {
    const row = {
      user_id: userId,
      group_id: groupId,
      score: 50,
      grade: "Fair",
      confidence: 0,
      on_time_rate: null,
      missed_payments: unresolvedMissed,
      avg_days_late: null,
      streak_months: 0,
      engagement_score: round2(features.engagement_rate * 100),
      model_version: "nodata",
      last_calculated_at: new Date().toISOString(),
    };
    return {
      row,
      meta: {
        insufficientData: true,
        lowConfidence: false,
        summaryLine: "",
        onTimeMonths: null,
        totalTrackedMonths: null,
        feature_importances: null,
        note: "Not enough data yet",
      },
    };
  }

  const ml = await callMlService(features);
  let prediction;

  if (ml && typeof ml.score === "number" && ml.grade) {
    prediction = {
      score: round2(ml.score),
      grade: ml.grade,
      confidence:
        typeof ml.confidence === "number"
          ? round2(ml.confidence)
          : round2(50),
      feature_importances:
        ml.feature_importances && typeof ml.feature_importances === "object"
          ? ml.feature_importances
          : null,
      model_version: "v1",
    };
  } else {
    prediction = weightedFallback(features);
  }

  const onTimePctDisplay = round2(onTimeRateRatio * 100);
  const onTimeCount = countedMonths.filter((ym) => byMonth.get(ym)?.onTime)
    .length;
  const n = countedMonths.length;

  let summaryLine = `You've paid on time ${onTimeCount} of ${n} month${n === 1 ? "" : "s"} tracked — ${
    onTimeCount >= n - 1 ? "great consistency!" : "there's room to tighten timing."
  }`;
  if (lowConfidenceFlag) {
    summaryLine +=
      " This is based on only one month of activity — your score will stabilize as you contribute more.";
  }
  if (unresolvedMissed > 0) {
    summaryLine += ` You have ${unresolvedMissed} unresolved missed-payment flag${unresolvedMissed === 1 ? "" : "s"} — settle those with your treasurer if needed.`;
  }

  const row = {
    user_id: userId,
    group_id: groupId,
    score: prediction.score,
    grade: prediction.grade,
    confidence: prediction.confidence,
    on_time_rate: onTimePctDisplay,
    missed_payments: unresolvedMissed,
    avg_days_late: avgDaysLate,
    streak_months: streakMonths,
    engagement_score: round2(features.engagement_rate * 100),
    model_version: prediction.model_version,
    last_calculated_at: new Date().toISOString(),
  };

  return {
    row,
    meta: {
      insufficientData: false,
      lowConfidence: lowConfidenceFlag,
      summaryLine,
      onTimeMonths: onTimeCount,
      totalTrackedMonths: n,
      feature_importances: prediction.feature_importances,
      note: null,
    },
  };
}
