import { describe, expect, it } from 'vitest'
import {
  COMPLIANCE_STATUS,
  aggregateMonthComplianceCounts,
  compareMonthKeys,
  computeWeightedCompliancePct,
  memberFlaggedForMonth,
  pickBestContributionForMonth,
  resolveMemberMonthStatus,
} from './complianceStatus.js'
import { DEFAULT_PAYMENT_WINDOW } from './paymentWindow.js'

const WINDOW = { ...DEFAULT_PAYMENT_WINDOW }
const USER = 'user-a'

describe('complianceStatus', () => {
  it('compareMonthKeys orders yyyy-mm chronologically', () => {
    expect(compareMonthKeys('2026-01', '2026-02')).toBeLessThan(0)
    expect(compareMonthKeys('2026-03', '2026-03')).toBe(0)
    expect(compareMonthKeys('2026-05', '2026-04')).toBeGreaterThan(0)
  })

  it('aggregateMonthComplianceCounts tallies member statuses for a month', () => {
    const counts = aggregateMonthComplianceCounts({
      members: [{ user_id: USER }, { user_id: 'user-b' }],
      contributions: [
        {
          user_id: USER,
          target_month: '2026-03',
          paid_at: '2026-03-03T12:00:00+02:00',
        },
      ],
      missedPayments: [],
      month: '2026-03',
      refMonth: '2026-04',
      paymentWindow: {
        payment_window_start_day: 25,
        payment_window_end_day: 5,
      },
    })
    expect(counts.Paid).toBe(1)
    expect(counts.Missed).toBe(1)
  })

  it('resolveMemberMonthStatus: on-time payment', () => {
    const status = resolveMemberMonthStatus({
      contributions: [
        {
          user_id: USER,
          target_month: '2026-03',
          paid_at: '2026-03-03T12:00:00+02:00',
        },
      ],
      missedPayments: [],
      userId: USER,
      month: '2026-03',
      refMonth: '2026-04',
      windowConfig: WINDOW,
    })
    expect(status).toBe(COMPLIANCE_STATUS.PAID)
  })

  it('resolveMemberMonthStatus: late payment in gap', () => {
    const status = resolveMemberMonthStatus({
      contributions: [
        {
          user_id: USER,
          target_month: '2026-03',
          paid_at: '2026-03-10T12:00:00+02:00',
        },
      ],
      missedPayments: [],
      userId: USER,
      month: '2026-03',
      refMonth: '2026-04',
      windowConfig: WINDOW,
    })
    expect(status).toBe(COMPLIANCE_STATUS.LATE)
  })

  it('resolveMemberMonthStatus: past month without payment is Missed', () => {
    expect(
      resolveMemberMonthStatus({
        contributions: [],
        missedPayments: [],
        userId: USER,
        month: '2026-02',
        refMonth: '2026-04',
        windowConfig: WINDOW,
      }),
    ).toBe(COMPLIANCE_STATUS.MISSED)
  })

  it('resolveMemberMonthStatus: current month without payment is Unpaid', () => {
    expect(
      resolveMemberMonthStatus({
        contributions: [],
        missedPayments: [],
        userId: USER,
        month: '2026-04',
        refMonth: '2026-04',
        windowConfig: WINDOW,
      }),
    ).toBe(COMPLIANCE_STATUS.UNPAID)
  })

  it('pickBestContributionForMonth prefers the later on-time payment when both qualify', () => {
    const picked = pickBestContributionForMonth(
      [
        {
          user_id: USER,
          target_month: '2026-03',
          paid_at: '2026-03-04T12:00:00+02:00',
        },
        {
          user_id: USER,
          target_month: '2026-03',
          paid_at: '2026-03-05T12:00:00+02:00',
        },
      ],
      USER,
      '2026-03',
      WINDOW,
    )
    expect(picked?.onTime).toBe(true)
    expect(picked?.row.paid_at).toContain('2026-03-05')
  })

  it('pickBestContributionForMonth prefers on-time row', () => {
    const picked = pickBestContributionForMonth(
      [
        {
          user_id: USER,
          target_month: '2026-03',
          paid_at: '2026-03-10T12:00:00+02:00',
        },
        {
          user_id: USER,
          target_month: '2026-03',
          paid_at: '2026-03-04T12:00:00+02:00',
        },
      ],
      USER,
      '2026-03',
      WINDOW,
    )
    expect(picked?.onTime).toBe(true)
    expect(picked?.row.paid_at).toContain('2026-03-04')
  })

  it('pickBestContributionForMonth returns null when no matching rows exist', () => {
    expect(pickBestContributionForMonth([], USER, '2026-03', WINDOW)).toBeNull()
  })

  it('memberFlaggedForMonth ignores resolved flags', () => {
    expect(
      memberFlaggedForMonth(
        [{ user_id: USER, target_month: '2026-03', resolved_at: '2026-04-01' }],
        USER,
        '2026-03',
      ),
    ).toBe(false)
  })

  it('pickBestContributionForMonth keeps the later paid_at when both are late', () => {
    const picked = pickBestContributionForMonth(
      [
        {
          user_id: USER,
          target_month: '2026-03',
          paid_at: '2026-03-10T12:00:00+02:00',
        },
        {
          user_id: USER,
          target_month: '2026-03',
          paid_at: '2026-03-15T12:00:00+02:00',
        },
      ],
      USER,
      '2026-03',
      WINDOW,
    )
    expect(picked?.onTime).toBe(false)
    expect(picked?.row.paid_at).toContain('2026-03-15')
  })

  it('resolveMemberMonthStatus returns Missed when an unresolved flag exists', () => {
    expect(
      resolveMemberMonthStatus({
        contributions: [],
        missedPayments: [
          { user_id: USER, target_month: '2026-03', resolved_at: null },
        ],
        userId: USER,
        month: '2026-03',
        refMonth: '2026-04',
        windowConfig: WINDOW,
      }),
    ).toBe(COMPLIANCE_STATUS.MISSED)
    expect(
      memberFlaggedForMonth(
        [{ user_id: USER, target_month: '2026-03', resolved_at: null }],
        USER,
        '2026-03',
      ),
    ).toBe(true)
    expect(memberFlaggedForMonth([], USER, '2026-03')).toBe(false)
  })

  it('computeWeightedCompliancePct returns zero for an empty status list', () => {
    expect(computeWeightedCompliancePct([])).toBe(0)
  })

  it('computeWeightedCompliancePct applies half credit for Late', () => {
    expect(
      computeWeightedCompliancePct([
        COMPLIANCE_STATUS.PAID,
        COMPLIANCE_STATUS.LATE,
        COMPLIANCE_STATUS.MISSED,
        COMPLIANCE_STATUS.UNPAID,
      ]),
    ).toBe(38)
  })
})
