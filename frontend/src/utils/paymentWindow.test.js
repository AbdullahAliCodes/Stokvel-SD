import { describe, expect, it } from 'vitest'
import {
  checkIsOnTime,
  DEFAULT_PAYMENT_WINDOW,
  getCurrentPaymentCycle,
  isPaidAtInWindowForTargetMonth,
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
