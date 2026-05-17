/**
 * Live Fixed-stokvel pool projection (simple interest on approved principal).
 * Not persisted to the ledger — computed on read for API responses.
 */

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
 * e.g. Jan→Jan = 1, Jan→Mar = 3.
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

function isApprovedContribution(row) {
  return String(row?.treasurer_approval_status ?? '').toLowerCase() === 'approved'
}

function sumApprovedPrincipal(contributions) {
  let sum = 0
  for (const c of contributions ?? []) {
    if (!isApprovedContribution(c)) continue
    const amt = Number(c.amount)
    if (Number.isFinite(amt)) sum += amt
  }
  return sum
}

function earliestApprovedPaidAt(contributions) {
  let earliest = null
  for (const c of contributions ?? []) {
    if (!isApprovedContribution(c)) continue
    const t = parseDate(c.paid_at)
    if (!t) continue
    if (!earliest || t < earliest) earliest = t
  }
  return earliest
}

/**
 * @typedef {{
 *   pool_principal: number,
 *   pool_interest: number,
 *   pool_total: number,
 *   expected_payout_per_member: number,
 *   current_prime_rate: number,
 *   months_active: number,
 *   as_of: string,
 * }} FixedPoolProjection
 */

/**
 * @param {{
 *   stokvel: { type?: string, created_at?: string, maturity_date?: string | null },
 *   contributions?: Array<{ amount?: number, paid_at?: string, treasurer_approval_status?: string }>,
 *   members?: unknown[],
 *   primeRate: number | null | undefined,
 *   now?: Date,
 * }} params
 * @returns {FixedPoolProjection | null} null when not Fixed or prime rate missing
 */
export function computeFixedPoolProjection({
  stokvel,
  contributions,
  members,
  primeRate,
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

  const pool_principal = round2(sumApprovedPrincipal(contributions))
  const createdAt = parseDate(stokvel.created_at) ?? now
  const firstApproved = earliestApprovedPaidAt(contributions)
  const accrualStart = firstApproved ?? createdAt

  const maturity = parseDate(stokvel.maturity_date)
  const accrualEnd =
    maturity && maturity.getTime() < now.getTime() ? maturity : now

  const months_active = calendarMonthsInclusive(accrualStart, accrualEnd)
  const pool_interest = round2(
    pool_principal * (rate / 100) * (months_active / 12),
  )
  const pool_total = round2(pool_principal + pool_interest)
  const expected_payout_per_member = round2(pool_total / memberCount)

  return {
    pool_principal,
    pool_interest,
    pool_total,
    expected_payout_per_member,
    current_prime_rate: rate,
    months_active,
    as_of: now.toISOString(),
  }
}
