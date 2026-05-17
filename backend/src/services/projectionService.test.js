import { describe, expect, it } from '@jest/globals'
import {
  calendarMonthsInclusive,
  computeFixedPoolProjection,
} from './projectionService.js'

describe('projectionService', () => {
  it('calendarMonthsInclusive enforces minimum 1 month', () => {
    const a = new Date('2026-01-15T12:00:00Z')
    const b = new Date('2026-01-20T12:00:00Z')
    expect(calendarMonthsInclusive(a, b)).toBe(1)
  })

  it('calendarMonthsInclusive counts span across months', () => {
    const a = new Date('2026-01-01T00:00:00Z')
    const b = new Date('2026-03-31T00:00:00Z')
    expect(calendarMonthsInclusive(a, b)).toBe(3)
  })

  it('computeFixedPoolProjection uses approved principal and simple interest', () => {
    const now = new Date('2026-04-01T12:00:00Z')
    const result = computeFixedPoolProjection({
      stokvel: {
        type: 'Fixed',
        created_at: '2026-01-01T00:00:00Z',
        maturity_date: '2027-01-01T00:00:00Z',
      },
      contributions: [
        {
          amount: 1000,
          paid_at: '2026-02-01T00:00:00Z',
          treasurer_approval_status: 'approved',
        },
        {
          amount: 500,
          paid_at: '2026-03-01T00:00:00Z',
          treasurer_approval_status: 'pending',
        },
      ],
      members: [{}, {}, {}],
      primeRate: 12,
      now,
    })

    expect(result).not.toBeNull()
    expect(result.pool_principal).toBe(1000)
    expect(result.months_active).toBe(3)
    expect(result.pool_interest).toBe(30)
    expect(result.pool_total).toBe(1030)
    expect(result.expected_payout_per_member).toBeCloseTo(1030 / 3, 2)
  })

  it('caps accrual at maturity_date when before now', () => {
    const now = new Date('2026-06-01T00:00:00Z')
    const result = computeFixedPoolProjection({
      stokvel: {
        type: 'Fixed',
        created_at: '2026-01-01T00:00:00Z',
        maturity_date: '2026-03-01T00:00:00Z',
      },
      contributions: [
        {
          amount: 1200,
          paid_at: '2026-01-15T00:00:00Z',
          treasurer_approval_status: 'approved',
        },
      ],
      members: [{}],
      primeRate: 10,
      now,
    })

    expect(result.months_active).toBe(3)
    expect(result.pool_interest).toBe(30)
  })

  it('returns null for Rotating stokvel', () => {
    expect(
      computeFixedPoolProjection({
        stokvel: { type: 'Rotating' },
        contributions: [],
        members: [{}],
        primeRate: 10,
      }),
    ).toBeNull()
  })

  it('returns null when prime rate missing', () => {
    expect(
      computeFixedPoolProjection({
        stokvel: { type: 'Fixed', created_at: '2026-01-01' },
        contributions: [],
        members: [{}],
        primeRate: null,
      }),
    ).toBeNull()
  })
})
