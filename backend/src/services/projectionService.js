/**
 * Fixed-stokvel pool projections (read-only; not persisted to the ledger).
 * Interest: monthly compound on pool balance at prime ÷ 12 (after each month's inflows).
 */

const TARGET_MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/

function round2(n) {
  return Math.round(Number(n) * 100) / 100
}

function parseDate(raw) {
  if (raw == null || raw === '') return null
  const d = raw instanceof Date ? raw : new Date(raw)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Inclusive calendar months between two instants (minimum 1).
 *
 * @param {Date} start
 * @param {Date} end
 */
export function calendarMonthsInclusive(start, end) {
  if (!(start instanceof Date) || !(end instanceof Date)) return 1
  if (end < start) return 1

  const months =
    (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
  return Math.max(1, months + 1)
}

/** @param {Date} d */
export function monthKeyFromDate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

/** @param {string} a YYYY-MM @param {string} b YYYY-MM */
export function compareMonthKeys(a, b) {
  if (a === b) return 0
  return a < b ? -1 : 1
}

/**
 * @param {string} from YYYY-MM
 * @param {string} to YYYY-MM
 * @returns {string[]}
 */
export function listMonthKeysInclusive(from, to) {
  if (!TARGET_MONTH_RE.test(from) || !TARGET_MONTH_RE.test(to)) return []
  if (compareMonthKeys(from, to) > 0) return []

  const out = []
  let [y, m] = from.split('-').map(Number)
  const [endY, endM] = to.split('-').map(Number)

  while (y < endY || (y === endY && m <= endM)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`)
    m += 1
    if (m > 12) {
      m = 1
      y += 1
    }
  }
  return out
}

/**
 * @param {string} startMonth YYYY-MM
 * @param {number} count
 * @returns {string[]}
 */
export function cycleMonthKeysFromStart(startMonth, count) {
  if (!TARGET_MONTH_RE.test(startMonth) || count < 1) return []

  const months = []
  let [y, m] = startMonth.split('-').map(Number)
  for (let i = 0; i < count; i++) {
    months.push(`${y}-${String(m).padStart(2, '0')}`)
    m += 1
    if (m > 12) {
      m = 1
      y += 1
    }
  }
  return months
}

function isApprovedContribution(row) {
  return String(row?.treasurer_approval_status ?? '').toLowerCase() === 'approved'
}

function normalizeTargetMonth(row) {
  const tm = String(row?.target_month ?? '').trim()
  if (TARGET_MONTH_RE.test(tm)) return tm
  const paid = parseDate(row?.paid_at)
  return paid ? monthKeyFromDate(paid) : null
}

/**
 * @param {Array<{ amount?: number, target_month?: string, paid_at?: string, treasurer_approval_status?: string }>} contributions
 */
function poolInflowByMonth(contributions) {
  /** @type {Record<string, number>} */
  const byMonth = {}
  for (const c of contributions ?? []) {
    if (!isApprovedContribution(c)) continue
    const month = normalizeTargetMonth(c)
    if (!month) continue
    const amt = Number(c.amount)
    if (!Number.isFinite(amt)) continue
    byMonth[month] = round2((byMonth[month] ?? 0) + amt)
  }
  return byMonth
}

/**
 * @param {Array<{ amount?: number, user_id?: string, target_month?: string, paid_at?: string, treasurer_approval_status?: string }>} contributions
 * @param {string} userId
 */
function sumMemberApprovedPrincipal(contributions, userId) {
  let sum = 0
  for (const c of contributions ?? []) {
    if (!isApprovedContribution(c)) continue
    if (String(c.user_id ?? '') !== String(userId)) continue
    const amt = Number(c.amount)
    if (Number.isFinite(amt)) sum += amt
  }
  return round2(sum)
}

function earliestApprovedMonth(contributions) {
  let earliest = null
  for (const c of contributions ?? []) {
    if (!isApprovedContribution(c)) continue
    const month = normalizeTargetMonth(c)
    if (!month) continue
    if (!earliest || compareMonthKeys(month, earliest) < 0) earliest = month
  }
  return earliest
}

/**
 * Monthly compound on pool balance: each month add inflows, then interest = balance × (prime/12).
 *
 * @param {string[]} months YYYY-MM in order
 * @param {(month: string) => number} inflowForMonth
 * @param {number} primeRate annual prime % (e.g. 11.75)
 */
export function simulateFixedPoolCompound(months, inflowForMonth, primeRate) {
  const monthlyRate = Number(primeRate) / 100 / 12
  let balance = 0
  let totalInflow = 0

  for (const month of months) {
    const inflow = round2(inflowForMonth(month))
    if (inflow > 0) {
      totalInflow = round2(totalInflow + inflow)
      balance = round2(balance + inflow)
    }
    if (balance > 0 && monthlyRate > 0) {
      balance = round2(balance * (1 + monthlyRate))
    }
  }

  const pool_interest = round2(balance - totalInflow)
  return {
    pool_balance: balance,
    pool_principal: totalInflow,
    pool_interest,
    months_accrued: months.length,
  }
}

/**
 * To-date compound accrual from approved contributions only.
 *
 * @param {{
 *   contributions?: Array<{ amount?: number, user_id?: string, target_month?: string, paid_at?: string, treasurer_approval_status?: string }>,
 *   primeRate: number,
 *   asOfMonth: string,
 * }} params
 */
export function accrueFixedPoolInterestToDate({ contributions, primeRate, asOfMonth }) {
  const inflowByMonth = poolInflowByMonth(contributions)
  const monthsWithInflow = Object.keys(inflowByMonth)
    .filter((m) => (inflowByMonth[m] ?? 0) > 0)
    .sort()
  if (monthsWithInflow.length === 0 || !TARGET_MONTH_RE.test(asOfMonth)) {
    return {
      pool_interest_to_date: 0,
      pool_balance: 0,
      months_accrued: 0,
    }
  }

  const firstMonth = monthsWithInflow[0]
  const lastInflowMonth = monthsWithInflow[monthsWithInflow.length - 1]
  let endMonth = lastInflowMonth
  if ((inflowByMonth[asOfMonth] ?? 0) > 0) {
    endMonth = compareMonthKeys(asOfMonth, lastInflowMonth) > 0 ? asOfMonth : lastInflowMonth
  }

  const months = listMonthKeysInclusive(firstMonth, endMonth)
  const { pool_balance, pool_interest, months_accrued } = simulateFixedPoolCompound(
    months,
    (month) => inflowByMonth[month] ?? 0,
    primeRate,
  )

  return {
    pool_interest_to_date: pool_interest,
    pool_balance,
    months_accrued,
  }
}

/**
 * Full-cycle maturity projection: each month adds expected pool inflow, compounded monthly.
 */
function projectMaturityPoolCompound({
  stokvel,
  contributions,
  memberCount,
  cycleLength,
  primeRate,
  now,
}) {
  const monthlyContribution = Number(stokvel.contribution_amount) || 0
  const projectedMonthlyInflow = round2(monthlyContribution * memberCount)
  const createdAt = parseDate(stokvel.created_at) ?? now
  const startMonth =
    earliestApprovedMonth(contributions) ?? monthKeyFromDate(createdAt)
  const months = cycleMonthKeysFromStart(startMonth, cycleLength)

  return simulateFixedPoolCompound(
    months,
    () => projectedMonthlyInflow,
    primeRate,
  )
}

/**
 * @typedef {{
 *   pool_principal: number,
 *   pool_interest: number,
 *   pool_total: number,
 *   expected_principal_per_member: number,
 *   expected_interest_per_member: number,
 *   expected_payout_per_member: number,
 *   pool_principal_collected: number,
 *   pool_interest_to_date: number,
 *   member_contributions_to_date: number | null,
 *   member_interest_share_to_date: number | null,
 *   estimated_amount_made: number | null,
 *   current_prime_rate: number,
 *   months_active: number,
 *   cycle_length: number,
 *   as_of: string,
 * }} FixedPoolProjection
 */

/**
 * @param {{
 *   stokvel: {
 *     type?: string,
 *     created_at?: string,
 *     maturity_date?: string | null,
 *     contribution_amount?: number,
 *     cycle_length?: number,
 *   },
 *   contributions?: Array<{ amount?: number, user_id?: string, paid_at?: string, target_month?: string, treasurer_approval_status?: string }>,
 *   members?: unknown[],
 *   primeRate: number | null | undefined,
 *   viewerUserId?: string | null,
 *   now?: Date,
 * }} params
 * @returns {FixedPoolProjection | null}
 */
export function computeFixedPoolProjection({
  stokvel,
  contributions,
  members,
  primeRate,
  viewerUserId = null,
  now = new Date(),
}) {
  if (String(stokvel?.type ?? '') !== 'Fixed') {
    return null
  }

  if (primeRate == null || primeRate === '') {
    return null
  }
  const rate = Number(primeRate)
  if (!Number.isFinite(rate) || rate < 0) {
    return null
  }

  const memberCount = Array.isArray(members) ? members.length : 0
  if (memberCount < 1) {
    return null
  }

  const monthlyContribution = Number(stokvel.contribution_amount) || 0
  const cycleLength = Math.max(1, Number(stokvel.cycle_length) || memberCount)

  const expected_principal_per_member = round2(monthlyContribution * cycleLength)
  const maturitySim = projectMaturityPoolCompound({
    stokvel,
    contributions,
    memberCount,
    cycleLength,
    primeRate: rate,
    now,
  })

  const pool_principal = round2(expected_principal_per_member * memberCount)
  const pool_interest = maturitySim.pool_interest
  const pool_total = maturitySim.pool_balance
  const expected_interest_per_member = round2(pool_interest / memberCount)
  const expected_payout_per_member = round2(
    expected_principal_per_member + expected_interest_per_member,
  )

  const pool_principal_collected = round2(
    Object.values(poolInflowByMonth(contributions)).reduce((s, n) => s + n, 0),
  )

  const asOfMonth = monthKeyFromDate(now)
  const { pool_interest_to_date } = accrueFixedPoolInterestToDate({
    contributions,
    primeRate: rate,
    asOfMonth,
  })

  let member_contributions_to_date = null
  let member_interest_share_to_date = null
  let estimated_amount_made = null

  if (viewerUserId) {
    member_contributions_to_date = sumMemberApprovedPrincipal(
      contributions,
      viewerUserId,
    )
    member_interest_share_to_date = round2(pool_interest_to_date / memberCount)
    estimated_amount_made = round2(
      member_contributions_to_date + member_interest_share_to_date,
    )
  }

  return {
    pool_principal,
    pool_interest,
    pool_total,
    expected_principal_per_member,
    expected_interest_per_member,
    expected_payout_per_member,
    pool_principal_collected,
    pool_interest_to_date,
    member_contributions_to_date,
    member_interest_share_to_date,
    estimated_amount_made,
    current_prime_rate: rate,
    months_active: maturitySim.months_accrued,
    cycle_length: cycleLength,
    as_of: now.toISOString(),
  }
}
