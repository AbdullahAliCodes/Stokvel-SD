import { describe, expect, it } from 'vitest'
import {
  checkIsOnTime,
  DEFAULT_PAYMENT_WINDOW,
  getCurrentPaymentCycle,
  isPaidAtInWindowForTargetMonth,
  normalizePaymentWindow,
  paymentWindowFromStokvel,
  zonedYmdParts,
} from './paymentWindow.js'

describe('paymentWindow (SAST, mirrors backend)', () => {
  it('DEFAULT_PAYMENT_WINDOW matches backend', () => {
    expect(DEFAULT_PAYMENT_WINDOW).toEqual({ startDay: 25, endDay: 5 })
  })

  it('getCurrentPaymentCycle: March 3 is in-window for 2026-03', () => {
    const r = getCurrentPaymentCycle(new Date('2026-03-03T12:00:00+02:00'))
    expect(r.inPaymentWindow).toBe(true)
    expect(r.targetMonth).toBe('2026-03')
  })

  it('getCurrentPaymentCycle: March 15 is gap', () => {
    const r = getCurrentPaymentCycle(new Date('2026-03-15T12:00:00+02:00'))
    expect(r.inPaymentWindow).toBe(false)
    expect(r.targetMonth).toBeNull()
  })

  it('normalizePaymentWindow falls back when days are invalid', () => {
    expect(normalizePaymentWindow({ startDay: 0, endDay: 40 })).toEqual(
      DEFAULT_PAYMENT_WINDOW,
    )
    expect(paymentWindowFromStokvel({ payment_window_start_day: 99 })).toEqual(
      DEFAULT_PAYMENT_WINDOW,
    )
  })

  it('zonedYmdParts reads calendar fields in SAST', () => {
    expect(zonedYmdParts(new Date('2026-03-03T12:00:00+02:00'))).toEqual({
      year: 2026,
      month: 3,
      day: 3,
    })
    expect(zonedYmdParts('2026-03-03T12:00:00+02:00')).toEqual({
      year: 2026,
      month: 3,
      day: 3,
    })
  })

  it('getCurrentPaymentCycle rolls target month forward after start day in a wrap window', () => {
    const r = getCurrentPaymentCycle(new Date('2026-12-28T12:00:00+02:00'), {
      startDay: 25,
      endDay: 5,
    })
    expect(r.inPaymentWindow).toBe(true)
    expect(r.targetMonth).toBe('2027-01')
  })

  it('getCurrentPaymentCycle returns the current month before start day in a wrap window', () => {
    const r = getCurrentPaymentCycle(new Date('2026-12-03T12:00:00+02:00'), {
      startDay: 25,
      endDay: 5,
    })
    expect(r.inPaymentWindow).toBe(true)
    expect(r.targetMonth).toBe('2026-12')
  })

  it('getCurrentPaymentCycle uses a same-calendar-month window when start <= end', () => {
    const r = getCurrentPaymentCycle(new Date('2026-06-10T12:00:00+02:00'), {
      startDay: 5,
      endDay: 20,
    })
    expect(r.inPaymentWindow).toBe(true)
    expect(r.targetMonth).toBe('2026-06')
  })

  it('getCurrentPaymentCycle is outside the window when the day is before start in a same-month window', () => {
    const r = getCurrentPaymentCycle(new Date('2026-06-02T12:00:00+02:00'), {
      startDay: 5,
      endDay: 20,
    })
    expect(r.inPaymentWindow).toBe(false)
    expect(r.targetMonth).toBeNull()
  })

  it('isPaidAtInWindowForTargetMonth returns false for invalid target months', () => {
    expect(
      isPaidAtInWindowForTargetMonth(new Date('2026-03-03T12:00:00+02:00'), 'bad-month'),
    ).toBe(false)
  })

  it('isPaidAtInWindowForTargetMonth distinguishes on-time vs late', () => {
    expect(
      isPaidAtInWindowForTargetMonth(
        new Date('2026-03-03T12:00:00+02:00'),
        '2026-03',
      ),
    ).toBe(true)
    expect(
      isPaidAtInWindowForTargetMonth(
        new Date('2026-03-10T12:00:00+02:00'),
        '2026-03',
      ),
    ).toBe(false)
    expect(
      checkIsOnTime(new Date('2026-03-03T12:00:00+02:00'), '2026-03'),
    ).toBe(true)
  })
})
