import { describe, expect, it } from '@jest/globals'
import {
  accrueFixedPoolInterestToDate,
  calendarMonthsInclusive,
  computeFixedPoolProjection,
  simulateFixedPoolCompound,
} from './projectionService.js'

const MEMBER_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const MEMBER_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

function fiveMemberMonth(/** @type {string} */ month, /** @type {number} */ amountEach) {
  const ids = [
    MEMBER_A,
    MEMBER_B,
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  ]
  return ids.map((user_id) => ({
    user_id,
    amount: amountEach,
    target_month: month,
    treasurer_approval_status: 'approved',
  }))
}

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

  it('accrueFixedPoolInterestToDate: month1 R5k then month2 R5k at 12% prime', () => {
    const contributions = [
      ...fiveMemberMonth('2026-01', 1000),
      ...fiveMemberMonth('2026-02', 1000),
    ]
    const result = accrueFixedPoolInterestToDate({
      contributions,
      primeRate: 12,
      asOfMonth: '2026-02',
    })
    expect(result.pool_interest_to_date).toBe(150.5)
    expect(result.pool_balance).toBe(10150.5)
    expect(result.months_accrued).toBe(2)
  })

  it('does not accrue interest in months after the last contribution month', () => {
    const contributions = fiveMemberMonth('2026-01', 1000)
    const result = accrueFixedPoolInterestToDate({
      contributions,
      primeRate: 12,
      asOfMonth: '2026-03',
    })
    expect(result.pool_interest_to_date).toBe(50)
    expect(result.months_accrued).toBe(1)
  })

  it('computeFixedPoolProjection estimated_amount_made for viewer', () => {
    const contributions = [
      ...fiveMemberMonth('2026-01', 1000),
      ...fiveMemberMonth('2026-02', 1000),
    ]
    const result = computeFixedPoolProjection({
      stokvel: {
        type: 'Fixed',
        created_at: '2026-01-01T00:00:00Z',
        maturity_date: '2026-07-01T00:00:00Z',
        contribution_amount: 1000,
        cycle_length: 6,
      },
      contributions,
      members: [{}, {}, {}, {}, {}],
      primeRate: 12,
      viewerUserId: MEMBER_A,
      now: new Date('2026-02-28T12:00:00Z'),
    })

    expect(result).not.toBeNull()
    expect(result.member_contributions_to_date).toBe(2000)
    expect(result.pool_interest_to_date).toBe(150.5)
    expect(result.member_interest_share_to_date).toBe(30.1)
    expect(result.estimated_amount_made).toBe(2030.1)
    expect(result.expected_payout_per_member).toBe(6213.54)
  })

  it('computeFixedPoolProjection maturity fields use full cycle', () => {
    const now = new Date('2026-04-01T12:00:00Z')
    const result = computeFixedPoolProjection({
      stokvel: {
        type: 'Fixed',
        created_at: '2026-01-01T00:00:00Z',
        maturity_date: '2026-04-01T00:00:00Z',
        contribution_amount: 500,
        cycle_length: 6,
      },
      contributions: [
        {
          user_id: MEMBER_A,
          amount: 1000,
          target_month: '2026-02',
          treasurer_approval_status: 'approved',
        },
      ],
      members: [{}, {}, {}],
      primeRate: 12,
      now,
    })

    expect(result.expected_principal_per_member).toBe(3000)
    expect(result.expected_payout_per_member).toBe(3106.77)
    expect(result.estimated_amount_made).toBeNull()
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

  it('simulateFixedPoolCompound matches month-by-month pool growth', () => {
    const compound = simulateFixedPoolCompound(
      ['2026-01', '2026-02'],
      () => 5000,
      12,
    )
    expect(compound.pool_interest).toBe(150.5)
    expect(compound.pool_balance).toBe(10150.5)
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
