import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import {
  addCalendarMonthsYm,
  applyDemoWindowOverride,
  cyclePayoutDateIso,
  getCurrentPaymentCycle,
  getFirstPayoutCycleMonth,
  getTargetMonthForPaidAt,
  isPaidAtInWindowForTargetMonth,
  generatePayoutSchedule,
  isDemoPaymentWindowDateRange,
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

  it('generatePayoutSchedule Fixed pays all on last cycle month', () => {
    const activation = new Date('2026-03-03T12:00:00+02:00')
    const seq = ['a', 'b']
    const { rows } = generatePayoutSchedule(activation, seq, 4, 'Fixed')
    expect(rows).toHaveLength(2)
    expect(rows[0].target_month).toBe('2026-06')
    expect(rows[1].target_month).toBe('2026-06')
    expect(rows[0].scheduled_payout_date).toBe('2026-06-05')
  })
})

describe('applyDemoWindowOverride (temporary demo — REMOVE with dates.js demo block)', () => {
  const demoStokvel = {
    id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    name: 'Sprint 3 Stokvel',
  }
  const otherStokvel = {
    id: '11111111-2222-3333-4444-555555555555',
    name: 'Other Group',
  }
  const may12Sast = new Date('2026-05-12T12:00:00+02:00')

  beforeEach(() => {
    delete process.env.DEMO_STOKVEL_IDENTIFIER
  })

  afterEach(() => {
    delete process.env.DEMO_STOKVEL_IDENTIFIER
  })

  it('forces in-window for demo group on May 12 2026 SAST (fail-safe name)', () => {
    const base = getCurrentPaymentCycle(may12Sast)
    expect(base.inPaymentWindow).toBe(false)

    const out = applyDemoWindowOverride(base, demoStokvel, may12Sast)
    expect(out).not.toBe(base)
    expect(out.inPaymentWindow).toBe(true)
    expect(out.targetMonth).toBe('2026-05')
    expect(out.isDemoOverride).toBe(true)
  })

  it('returns original cycle for non-demo group on same date', () => {
    const base = getCurrentPaymentCycle(may12Sast)
    const out = applyDemoWindowOverride(base, otherStokvel, may12Sast)
    expect(out).toBe(base)
  })

  it('returns original cycle for demo group outside May 10–15 2026', () => {
    const may9 = new Date('2026-05-09T12:00:00+02:00')
    const base = getCurrentPaymentCycle(may9)
    const out = applyDemoWindowOverride(base, demoStokvel, may9)
    expect(out).toBe(base)
    expect(isDemoPaymentWindowDateRange(may9)).toBe(false)
  })

  it('matches DEMO_STOKVEL_IDENTIFIER to stokvel id when env is set', () => {
    process.env.DEMO_STOKVEL_IDENTIFIER = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
    const base = getCurrentPaymentCycle(may12Sast)
    const out = applyDemoWindowOverride(base, { id: demoStokvel.id, name: 'Renamed' }, may12Sast)
    expect(out.isDemoOverride).toBe(true)
    expect(out.targetMonth).toBe('2026-05')
  })
})
