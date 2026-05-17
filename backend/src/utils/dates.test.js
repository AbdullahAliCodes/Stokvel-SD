import { describe, it, expect } from '@jest/globals'
import {
  addCalendarMonthsYm,
  cyclePayoutDateIso,
  DEFAULT_PAYMENT_WINDOW,
  computeFixedMaturityFromCycle,
  getCurrentPaymentCycle,
  getFirstPayoutCycleMonth,
  getTargetMonthForPaidAt,
  isPaidAtInWindowForTargetMonth,
  generateFixedMaturityPayoutSchedule,
  generatePayoutSchedule,
} from './dates.js'

describe('dates.js payment cycles (Africa/Johannesburg)', () => {
  it('getCurrentPaymentCycle: March 3 is in-window for 2026-03', () => {
    const r = getCurrentPaymentCycle(new Date('2026-03-03T12:00:00+02:00'))
    expect(r.inPaymentWindow).toBe(true)
    expect(r.targetMonth).toBe('2026-03')
  })

  it('getCurrentPaymentCycle: March 15 is gap (no window)', () => {
    const r = getCurrentPaymentCycle(new Date('2026-03-15T12:00:00+02:00'))
    expect(r.inPaymentWindow).toBe(false)
    expect(r.targetMonth).toBeNull()
  })

  it('getCurrentPaymentCycle: March 28 is in-window for 2026-04', () => {
    const r = getCurrentPaymentCycle(new Date('2026-03-28T12:00:00+02:00'))
    expect(r.inPaymentWindow).toBe(true)
    expect(r.targetMonth).toBe('2026-04')
  })

  it('getTargetMonthForPaidAt: gap day attributes to same calendar month cycle', () => {
    expect(getTargetMonthForPaidAt(new Date('2026-03-10T12:00:00+02:00'))).toBe('2026-03')
  })

  it('getFirstPayoutCycleMonth: activation in gap advances to next cycle', () => {
    expect(getFirstPayoutCycleMonth(new Date('2026-03-15T12:00:00+02:00'))).toBe('2026-04')
  })

  it('getFirstPayoutCycleMonth: activation inside window uses that cycle', () => {
    expect(getFirstPayoutCycleMonth(new Date('2026-03-03T12:00:00+02:00'))).toBe('2026-03')
  })

  it('isPaidAtInWindowForTargetMonth', () => {
    expect(
      isPaidAtInWindowForTargetMonth(new Date('2026-03-03T12:00:00+02:00'), '2026-03'),
    ).toBe(true)
    expect(
      isPaidAtInWindowForTargetMonth(new Date('2026-03-10T12:00:00+02:00'), '2026-03'),
    ).toBe(false)
  })

  it('addCalendarMonthsYm rolls year', () => {
    expect(addCalendarMonthsYm('2026-11', 2)).toBe('2027-01')
  })

  it('cyclePayoutDateIso', () => {
    expect(cyclePayoutDateIso('2026-04')).toBe('2026-04-05')
  })

  it('generatePayoutSchedule Rotating staggers by month', () => {
    const activation = new Date('2026-03-15T12:00:00+02:00')
    const seq = ['u1', 'u2', 'u3']
    const { rows, firstCycleMonth } = generatePayoutSchedule(activation, seq, 3, 'Rotating')
    expect(firstCycleMonth).toBe('2026-04')
    expect(rows).toHaveLength(3)
    expect(rows[0].target_month).toBe('2026-04')
    expect(rows[1].target_month).toBe('2026-05')
    expect(rows[2].target_month).toBe('2026-06')
    expect(rows[0].user_id).toBe('u1')
  })

  it('getCurrentPaymentCycle uses custom window (25→1)', () => {
    const win = { startDay: 25, endDay: 1 }
    expect(getCurrentPaymentCycle(new Date('2026-03-01T12:00:00+02:00'), win)).toEqual({
      targetMonth: '2026-03',
      inPaymentWindow: true,
    })
    expect(getCurrentPaymentCycle(new Date('2026-03-10T12:00:00+02:00'), win)).toEqual({
      targetMonth: null,
      inPaymentWindow: false,
    })
  })

  it('normalizePaymentWindow falls back to DEFAULT_PAYMENT_WINDOW', () => {
    expect(DEFAULT_PAYMENT_WINDOW).toEqual({ startDay: 25, endDay: 5 })
  })

  it('computeFixedMaturityFromCycle: 6 cycles ends on 5th of 6th month', () => {
    const activation = new Date('2026-03-03T12:00:00+02:00')
    const anchor = computeFixedMaturityFromCycle(activation, 6)
    expect(anchor).not.toBeNull()
    expect(anchor.firstCycleMonth).toBe('2026-03')
    expect(anchor.lastCycleMonth).toBe('2026-08')
    expect(anchor.scheduled_payout_date).toBe('2026-08-05')
  })

  it('generateFixedMaturityPayoutSchedule pays all members on final cycle date', () => {
    const activation = new Date('2026-03-03T12:00:00+02:00')
    const { rows, maturity_date_iso } = generateFixedMaturityPayoutSchedule(
      activation,
      6,
      ['u1', 'u2'],
    )
    expect(rows).toHaveLength(2)
    expect(maturity_date_iso).toBe('2026-08-05')
    expect(rows[0].scheduled_payout_date).toBe('2026-08-05')
    expect(rows[0].target_month).toBe('2026-08')
    expect(rows[1].user_id).toBe('u2')
  })
})
