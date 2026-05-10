import { formatInTimeZone } from 'date-fns-tz'

/** All stokvel payment-cycle logic uses South African standard time. */
export const SAST_TZ = 'Africa/Johannesburg'

/**
 * @param {Date | string | number} date
 * @returns {{ year: number, month: number, day: number }}
 */
export function zonedYmdParts(date) {
  const d = date instanceof Date ? date : new Date(date)
  const ymd = formatInTimeZone(d, SAST_TZ, 'yyyy-MM-dd')
  const [y, m, day] = ymd.split('-').map(Number)
  return { year: y, month: m, day }
}

/* ============================================================================
 * DEMO PAYMENT WINDOW OVERRIDE — REMOVE ENTIRE BLOCK AFTER SPRINT 3 DEMO (May 2026)
 * Isolated: does not change getCurrentPaymentCycle / global SAST rules unless
 * applyDemoWindowOverride() is called explicitly by routes.
 * ============================================================================ */

/** Fail-safe match when `process.env.DEMO_STOKVEL_IDENTIFIER` is unset (name-only). */
const DEMO_PAYMENT_WINDOW_FAILSAFE_NAME = 'Sprint 3 Stokvel'

const DEMO_TARGET_MONTH = '2026-05'
const DEMO_YEAR = 2026
const DEMO_MONTH = 5
const DEMO_DAY_START = 10
const DEMO_DAY_END = 15

/**
 * @param {unknown} stokvelRef string, or `{ id, name }` for env UUID/name matching without route-side literals.
 */
function matchesDemoStokvelIdentifier(stokvelRef) {
  const env =
    typeof process !== 'undefined' && process.env?.DEMO_STOKVEL_IDENTIFIER != null
      ? String(process.env.DEMO_STOKVEL_IDENTIFIER).trim()
      : ''
  if (env) {
    if (stokvelRef && typeof stokvelRef === 'object') {
      const id = stokvelRef.id != null ? String(stokvelRef.id).trim() : ''
      const name = stokvelRef.name != null ? String(stokvelRef.name).trim() : ''
      return id === env || name === env
    }
    return String(stokvelRef ?? '').trim() === env
  }
  const nameOnly =
    stokvelRef && typeof stokvelRef === 'object'
      ? String(stokvelRef.name ?? '').trim()
      : String(stokvelRef ?? '').trim()
  return nameOnly === DEMO_PAYMENT_WINDOW_FAILSAFE_NAME
}

/**
 * True when `date` falls (inclusive) on calendar days 10–15 May 2026 in SAST.
 *
 * @param {Date | string | number} date
 */
export function isDemoPaymentWindowDateRange(date = new Date()) {
  const { year, month, day } = zonedYmdParts(date)
  return (
    year === DEMO_YEAR &&
    month === DEMO_MONTH &&
    day >= DEMO_DAY_START &&
    day <= DEMO_DAY_END
  )
}

/**
 * Temporary demo-only: optionally rewires `cycle` for one stokvel + May 10–15 2026 SAST.
 *
 * @param {{ targetMonth?: string | null, inPaymentWindow?: boolean }} cycle
 * @param {string | { id?: string, name?: string }} stokvelNameOrId
 * @param {Date} [currentDate]
 * @returns {typeof cycle & { isDemoOverride?: boolean }}
 */
export function applyDemoWindowOverride(cycle, stokvelNameOrId, currentDate = new Date()) {
  if (!matchesDemoStokvelIdentifier(stokvelNameOrId) || !isDemoPaymentWindowDateRange(currentDate)) {
    return cycle
  }

  const base = cycle && typeof cycle === 'object' ? cycle : {}
  return {
    ...base,
    inPaymentWindow: true,
    targetMonth: DEMO_TARGET_MONTH,
    isDemoOverride: true,
  }
}

/** END DEMO PAYMENT WINDOW OVERRIDE ========================================= */

/**
 * Cycle `YYYY-MM`: payments accepted from the 25th of the previous calendar month
 * through the 5th of month MM (inclusive), in SAST.
 *
 * @returns {{ targetMonth: string | null, inPaymentWindow: boolean }}
 */
export function getCurrentPaymentCycle(date = new Date()) {
  const { year: y, month: m, day: d } = zonedYmdParts(date)

  if (d >= 6 && d <= 24) {
    return { targetMonth: null, inPaymentWindow: false }
  }

  if (d >= 25) {
    let nm = m + 1
    let ny = y
    if (nm > 12) {
      nm = 1
      ny += 1
    }
    const targetMonth = `${ny}-${String(nm).padStart(2, '0')}`
    return { targetMonth, inPaymentWindow: true }
  }

  const targetMonth = `${y}-${String(m).padStart(2, '0')}`
  return { targetMonth, inPaymentWindow: true }
}

/**
 * Which contribution cycle a Paystack settlement instant maps to (SAST calendar).
 * In the 6th–24th gap, attributes to the cycle that just ended on the 5th of the current month (late payment).
 *
 * @param {Date | string | number} date
 * @returns {string | null} `YYYY-MM` or null if `date` is invalid
 */
export function getTargetMonthForPaidAt(date = new Date()) {
  const t = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(t.getTime())) return null

  const { year: y, month: m, day: d } = zonedYmdParts(t)

  if (d >= 6 && d <= 24) {
    return `${y}-${String(m).padStart(2, '0')}`
  }

  const c = getCurrentPaymentCycle(t)
  return c.targetMonth
}

/**
 * True if `paidAt` falls inside the regular payment window for `targetMonth` (SAST).
 *
 * @param {Date | string | number} paidAt
 * @param {string} targetMonth `YYYY-MM`
 */
export function isPaidAtInWindowForTargetMonth(paidAt, targetMonth) {
  const t = paidAt instanceof Date ? paidAt : new Date(paidAt)
  if (!targetMonth || !/^\d{4}-\d{2}$/.test(targetMonth)) return false
  const c = getCurrentPaymentCycle(t)
  return Boolean(c.inPaymentWindow && c.targetMonth === targetMonth)
}

/**
 * First cycle month for new payout rows: current open window if activation lands in-window,
 * otherwise the next cycle (first window beginning on or after the gap).
 *
 * @param {Date | string | number} activationDate
 * @returns {string | null}
 */
export function getFirstPayoutCycleMonth(activationDate = new Date()) {
  const t = activationDate instanceof Date ? activationDate : new Date(activationDate)
  if (Number.isNaN(t.getTime())) return null

  const c = getCurrentPaymentCycle(t)
  if (c.inPaymentWindow && c.targetMonth) {
    return c.targetMonth
  }

  const { year: y, month: m } = zonedYmdParts(t)
  let nm = m + 1
  let ny = y
  if (nm > 12) {
    nm = 1
    ny += 1
  }
  return `${ny}-${String(nm).padStart(2, '0')}`
}

/**
 * @param {string} ym `YYYY-MM`
 * @param {number} delta
 * @returns {string}
 */
export function addCalendarMonthsYm(ym, delta) {
  const [ys, ms] = ym.split('-').map(Number)
  if (!Number.isFinite(ys) || !Number.isFinite(ms)) {
    throw new Error(`Invalid YYYY-MM: ${ym}`)
  }
  const idx = ys * 12 + (ms - 1) + delta
  const y2 = Math.floor(idx / 12)
  const m2 = (idx % 12) + 1
  return `${y2}-${String(m2).padStart(2, '0')}`
}

/**
 * Nominal payout calendar day for a cycle (5th of the labelled month), ISO date.
 *
 * @param {string} ym `YYYY-MM`
 */
export function cyclePayoutDateIso(ym) {
  const [y, m] = ym.split('-').map(Number)
  return `${y}-${String(m).padStart(2, '0')}-05`
}

/**
 * @typedef {{ user_id: string, target_month: string, scheduled_payout_date: string, cycle_index: number }} PayoutScheduleRow
 *
 * @param {Date | string | number} activationDate
 * @param {string[]} payoutSequence User UUIDs in payout order
 * @param {number} cycleLength
 * @param {string} type Stokvel type: `Rotating` or `Fixed`
 * @returns {{ rows: PayoutScheduleRow[], firstCycleMonth: string | null }}
 */
export function generatePayoutSchedule(
  activationDate,
  payoutSequence,
  cycleLength,
  type,
) {
  const seq = (Array.isArray(payoutSequence) ? payoutSequence : []).filter(
    (id) => typeof id === 'string' && id.length > 0,
  )
  const len = Math.min(seq.length, cycleLength)
  const firstCycleMonth = getFirstPayoutCycleMonth(activationDate)
  if (!firstCycleMonth || len < 1) {
    return { rows: [], firstCycleMonth }
  }

  const typ = String(type || 'Rotating')
  const rows = []

  if (typ === 'Fixed') {
    const lastYm = addCalendarMonthsYm(firstCycleMonth, cycleLength - 1)
    const scheduled = cyclePayoutDateIso(lastYm)
    for (let i = 0; i < len; i++) {
      rows.push({
        user_id: seq[i],
        target_month: lastYm,
        scheduled_payout_date: scheduled,
        cycle_index: i,
      })
    }
    return { rows, firstCycleMonth }
  }

  for (let i = 0; i < len; i++) {
    const target_month = addCalendarMonthsYm(firstCycleMonth, i)
    rows.push({
      user_id: seq[i],
      target_month,
      scheduled_payout_date: cyclePayoutDateIso(target_month),
      cycle_index: i,
    })
  }
  return { rows, firstCycleMonth }
}
