/**
 * Payment-cycle helpers — mirrors backend/src/utils/dates.js (SAST).
 */

export const SAST_TZ = 'Africa/Johannesburg'

/** @type {{ startDay: number, endDay: number }} */
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
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: SAST_TZ,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(d)

  const year = Number(parts.find((p) => p.type === 'year')?.value)
  const month = Number(parts.find((p) => p.type === 'month')?.value)
  const day = Number(parts.find((p) => p.type === 'day')?.value)
  return { year, month, day }
}

/**
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

/** Alias for compliance UI. */
export function checkIsOnTime(paidAtString, targetMonthStr, windowConfig = null) {
  return isPaidAtInWindowForTargetMonth(paidAtString, targetMonthStr, windowConfig)
}

/**
 * Calendar ISO dates for a cycle's payment window (SAST day-of-month rules).
 *
 * @param {string} targetMonth `YYYY-MM`
 * @param {{ startDay?: number, endDay?: number } | null} [windowConfig]
 * @returns {{ startIso: string, endIso: string } | null}
 */
export function paymentWindowDateRangeForTargetMonth(targetMonth, windowConfig = null) {
  if (!targetMonth || !/^\d{4}-\d{2}$/.test(targetMonth)) return null
  const { startDay: S, endDay: E } = normalizePaymentWindow(windowConfig)
  const [y, m] = targetMonth.split('-').map(Number)
  if (!Number.isFinite(y) || !Number.isFinite(m)) return null

  const pad = (n) => String(n).padStart(2, '0')

  if (S > E) {
    let sm = m - 1
    let sy = y
    if (sm < 1) {
      sm = 12
      sy -= 1
    }
    return {
      startIso: `${sy}-${pad(sm)}-${pad(S)}`,
      endIso: `${y}-${pad(m)}-${pad(E)}`,
    }
  }

  return {
    startIso: `${y}-${pad(m)}-${pad(S)}`,
    endIso: `${y}-${pad(m)}-${pad(E)}`,
  }
}

/**
 * @param {string} iso `YYYY-MM-DD`
 */
function formatIsoDateLabel(iso) {
  const [ys, ms, ds] = iso.split('-').map(Number)
  const d = new Date(Date.UTC(ys, ms - 1, ds, 12, 0, 0))
  return d.toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/**
 * Human-readable payment window for a contribution cycle.
 *
 * @param {string} targetMonth `YYYY-MM`
 * @param {{ startDay?: number, endDay?: number } | null} [windowConfig]
 * @returns {string | null}
 */
export function formatPaymentWindowRangeLabel(targetMonth, windowConfig = null) {
  const range = paymentWindowDateRangeForTargetMonth(targetMonth, windowConfig)
  if (!range) return null
  return `Payment window: ${formatIsoDateLabel(range.startIso)} – ${formatIsoDateLabel(range.endIso)}`
}

/**
 * Fallback when no active cycle month is open (shows configured calendar days).
 *
 * @param {{ startDay?: number, endDay?: number } | null} [windowConfig]
 * @returns {string}
 */
export function formatPaymentWindowDaysLabel(windowConfig = null) {
  const { startDay, endDay } = normalizePaymentWindow(windowConfig)
  return `Payment window: day ${startDay} – day ${endDay} (SAST)`
}
