import {
  checkIsOnTime,
  paymentWindowFromStokvel,
} from './paymentWindow.js'

export const TARGET_MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/

export const COMPLIANCE_STATUS = Object.freeze({
  PAID: 'Paid',
  LATE: 'Late',
  MISSED: 'Missed',
  UNPAID: 'Unpaid',
})

/** @param {string} a @param {string} b */
export function compareMonthKeys(a, b) {
  if (a === b) return 0
  return a < b ? -1 : 1
}

/**
 * @param {Array<{ user_id?: string, target_month?: string, resolved_at?: string | null }>} missedPayments
 * @param {string} userId
 * @param {string} month
 */
export function memberFlaggedForMonth(missedPayments, userId, month) {
  return (missedPayments ?? []).some(
    (r) =>
      r?.user_id === userId &&
      r?.target_month === month &&
      r?.resolved_at == null &&
      TARGET_MONTH_RE.test(String(month)),
  )
}

/**
 * Prefer on-time contribution; else latest `paid_at`.
 *
 * @param {Array<{ user_id?: string, target_month?: string, paid_at?: string }>} contributions
 * @param {string} userId
 * @param {string} month
 * @param {{ startDay: number, endDay: number }} windowConfig
 * @returns {{ row: object, onTime: boolean } | null}
 */
export function pickBestContributionForMonth(
  contributions,
  userId,
  month,
  windowConfig,
) {
  const rows = (contributions ?? []).filter(
    (c) =>
      c?.user_id === userId &&
      c?.target_month === month &&
      TARGET_MONTH_RE.test(String(month)) &&
      c?.paid_at,
  )

  /** @type {{ row: object, onTime: boolean } | null} */
  let best = null

  for (const row of rows) {
    const onTime = checkIsOnTime(row.paid_at, month, windowConfig)
    if (!best) {
      best = { row, onTime }
      continue
    }
    if (onTime && !best.onTime) {
      best = { row, onTime }
      continue
    }
    if (onTime === best.onTime) {
      const prevT = new Date(best.row.paid_at).getTime()
      const nextT = new Date(row.paid_at).getTime()
      if (!Number.isNaN(nextT) && nextT > prevT) {
        best = { row, onTime }
      }
    }
  }

  return best
}

/**
 * @param {{
 *   contributions?: Array<{ user_id?: string, target_month?: string, paid_at?: string }>,
 *   missedPayments?: Array<{ user_id?: string, target_month?: string, resolved_at?: string | null }>,
 *   userId: string,
 *   month: string,
 *   refMonth: string | null,
 *   windowConfig: { startDay: number, endDay: number },
 * }} params
 * @returns {'Paid' | 'Late' | 'Missed' | 'Unpaid'}
 */
export function resolveMemberMonthStatus({
  contributions,
  missedPayments,
  userId,
  month,
  refMonth,
  windowConfig,
}) {
  const picked = pickBestContributionForMonth(
    contributions,
    userId,
    month,
    windowConfig,
  )
  if (picked) {
    return picked.onTime ? COMPLIANCE_STATUS.PAID : COMPLIANCE_STATUS.LATE
  }

  if (memberFlaggedForMonth(missedPayments, userId, month)) {
    return COMPLIANCE_STATUS.MISSED
  }

  if (refMonth && TARGET_MONTH_RE.test(refMonth) && compareMonthKeys(month, refMonth) < 0) {
    return COMPLIANCE_STATUS.MISSED
  }

  return COMPLIANCE_STATUS.UNPAID
}

/**
 * Weighted compliance: Paid = 1, Late = 0.5, Missed/Unpaid = 0.
 *
 * @param {Array<'Paid' | 'Late' | 'Missed' | 'Unpaid'>} statuses
 */
export function computeWeightedCompliancePct(statuses) {
  if (!statuses?.length) return 0
  let score = 0
  for (const status of statuses) {
    if (status === COMPLIANCE_STATUS.PAID) score += 1
    else if (status === COMPLIANCE_STATUS.LATE) score += 0.5
  }
  return Math.round((score / statuses.length) * 100)
}

/**
 * @param {{
 *   members: Array<{ user_id: string }>,
 *   contributions?: Array<object>,
 *   missedPayments?: Array<object>,
 *   month: string,
 *   refMonth: string | null,
 *   paymentWindow?: { payment_window_start_day?: number, payment_window_end_day?: number } | null,
 * }} params
 */
export function aggregateMonthComplianceCounts({
  members,
  contributions,
  missedPayments,
  month,
  refMonth,
  paymentWindow,
}) {
  const windowConfig = paymentWindowFromStokvel(paymentWindow)
  const counts = {
    Paid: 0,
    Late: 0,
    Missed: 0,
    Unpaid: 0,
  }

  for (const m of members) {
    const status = resolveMemberMonthStatus({
      contributions,
      missedPayments,
      userId: m.user_id,
      month,
      refMonth,
      windowConfig,
    })
    counts[status] += 1
  }

  return counts
}

export { paymentWindowFromStokvel }
