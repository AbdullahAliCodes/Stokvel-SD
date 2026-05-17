import { formatInTimeZone } from 'date-fns-tz'

/** All stokvel payment-cycle logic uses South African standard time. */
export const SAST_TZ = 'Africa/Johannesburg'

/** Legacy global window: 25th (prior month) through 5th (target month), SAST. */
export const DEFAULT_PAYMENT_WINDOW = Object.freeze({
  startDay: 25,
  endDay: 5,
})

/**
 * @param {{ startDay?: number, endDay?: number, payment_window_start_day?: number, payment_window_end_day?: number } | null | undefined} raw
 * @returns {{ startDay: number, endDay: number }}
 */
export function normalizePaymentWindow(raw) {
  const startDay = Number(
    raw?.startDay ?? raw?.payment_window_start_day ?? DEFAULT_PAYMENT_WINDOW.startDay,
  )
  const endDay = Number(
    raw?.endDay ?? raw?.payment_window_end_day ?? DEFAULT_PAYMENT_WINDOW.endDay,
  )
  if (
    !Number.isInteger(startDay) ||
    !Number.isInteger(endDay) ||
    startDay < 1 ||
    startDay > 31 ||
    endDay < 1 ||
    endDay > 31
  ) {
    return { ...DEFAULT_PAYMENT_WINDOW }
  }
  return { startDay, endDay }
}

/** @param {{ payment_window_start_day?: number, payment_window_end_day?: number } | null | undefined} stokvel */
export function paymentWindowFromStokvel(stokvel) {
  return normalizePaymentWindow(stokvel)
}

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

/**
 * Cycle `YYYY-MM`: payments accepted within the group's payment window in SAST.
 * Cross-month windows (startDay > endDay): gap is (endDay, startDay) exclusive.
 *
 * @param {Date | string | number} [date]
 * @param {{ startDay?: number, endDay?: number } | null} [windowConfig]
 * @returns {{ targetMonth: string | null, inPaymentWindow: boolean }}
 */
export function getCurrentPaymentCycle(date = new Date(), windowConfig = null) {
  const { startDay: S, endDay: E } = normalizePaymentWindow(windowConfig)
  const { year: y, month: m, day: d } = zonedYmdParts(date)

  const targetMonthCurrent = `${y}-${String(m).padStart(2, '0')}`

  if (S > E) {
    if (d > E && d < S) {
      return { targetMonth: null, inPaymentWindow: false }
    }
    if (d >= S) {
      let nm = m + 1
      let ny = y
      if (nm > 12) {
        nm = 1
        ny += 1
      }
      return {
        targetMonth: `${ny}-${String(nm).padStart(2, '0')}`,
        inPaymentWindow: true,
      }
    }
    return { targetMonth: targetMonthCurrent, inPaymentWindow: true }
  }

  if (d < S || d > E) {
    return { targetMonth: null, inPaymentWindow: false }
  }
  return { targetMonth: targetMonthCurrent, inPaymentWindow: true }
}

/**
 * Which contribution cycle a Paystack settlement instant maps to (SAST calendar).
 * In the gap (cross-month windows), attributes to the cycle that just ended (late payment).
 *
 * @param {Date | string | number} date
 * @param {{ startDay?: number, endDay?: number } | null} [windowConfig]
 * @returns {string | null} `YYYY-MM` or null if `date` is invalid
 */
export function getTargetMonthForPaidAt(date = new Date(), windowConfig = null) {
  const t = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(t.getTime())) return null

  const win = normalizePaymentWindow(windowConfig)
  const { year: y, month: m, day: d } = zonedYmdParts(t)
  const { startDay: S, endDay: E } = win

  if (S > E && d > E && d < S) {
    return `${y}-${String(m).padStart(2, '0')}`
  }

  const c = getCurrentPaymentCycle(t, win)
  return c.targetMonth
}

/**
 * True if `paidAt` falls inside the regular payment window for `targetMonth` (SAST).
 *
 * @param {Date | string | number} paidAt
 * @param {string} targetMonth `YYYY-MM`
 * @param {{ startDay?: number, endDay?: number } | null} [windowConfig]
 */
export function isPaidAtInWindowForTargetMonth(paidAt, targetMonth, windowConfig = null) {
  const t = paidAt instanceof Date ? paidAt : new Date(paidAt)
  if (!targetMonth || !/^\d{4}-\d{2}$/.test(targetMonth)) return false
  const c = getCurrentPaymentCycle(t, windowConfig)
  return Boolean(c.inPaymentWindow && c.targetMonth === targetMonth)
}

/**
 * First cycle month for new payout rows: current open window if activation lands in-window,
 * otherwise the next cycle (first window beginning on or after the gap).
 *
 * @param {Date | string | number} activationDate
 * @param {{ startDay?: number, endDay?: number } | null} [windowConfig]
 * @returns {string | null}
 */
export function getFirstPayoutCycleMonth(activationDate = new Date(), windowConfig = null) {
  const t = activationDate instanceof Date ? activationDate : new Date(activationDate)
  if (Number.isNaN(t.getTime())) return null

  const win = normalizePaymentWindow(windowConfig)
  const c = getCurrentPaymentCycle(t, win)
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
 */

/**
 * @param {Date | string | number} maturityDate
 * @param {string[]} memberIds
 * @returns {{ rows: PayoutScheduleRow[], firstCycleMonth: string | null }}
 */
export function generateInvestmentPayoutSchedule(maturityDate, memberIds) {
  const t = maturityDate instanceof Date ? maturityDate : new Date(maturityDate)
  if (Number.isNaN(t.getTime())) {
    return { rows: [], firstCycleMonth: null }
  }

  const firstCycleMonth = formatInTimeZone(t, SAST_TZ, 'yyyy-MM')
  const scheduled_payout_date = formatInTimeZone(t, SAST_TZ, 'yyyy-MM-dd')
  const seq = (Array.isArray(memberIds) ? memberIds : []).filter(
    (id) => typeof id === 'string' && id.length > 0,
  )

  const rows = seq.map((user_id, cycle_index) => ({
    user_id,
    target_month: firstCycleMonth,
    scheduled_payout_date,
    cycle_index,
  }))

  return { rows, firstCycleMonth }
}

/**
 * @param {Date | string | number} activationDate
 * @param {string[]} payoutSequence User UUIDs in payout order
 * @param {number} cycleLength
 * @param {string} type Stokvel type: `Rotating`, `Fixed`, or `Investment`
 * @param {{ startDay?: number, endDay?: number } | null} [windowConfig]
 * @returns {{ rows: PayoutScheduleRow[], firstCycleMonth: string | null }}
 */
export function generatePayoutSchedule(
  activationDate,
  payoutSequence,
  cycleLength,
  type,
  windowConfig = null,
) {
  const typ = String(type || 'Rotating')

  if (typ === 'Investment') {
    return generateInvestmentPayoutSchedule(activationDate, payoutSequence)
  }

  const seq = (Array.isArray(payoutSequence) ? payoutSequence : []).filter(
    (id) => typeof id === 'string' && id.length > 0,
  )
  const len = Math.min(seq.length, cycleLength)
  const firstCycleMonth = getFirstPayoutCycleMonth(activationDate, windowConfig)
  if (!firstCycleMonth || len < 1) {
    return { rows: [], firstCycleMonth }
  }

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
