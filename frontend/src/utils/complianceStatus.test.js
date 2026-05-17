import { describe, expect, it } from 'vitest'
import {
  COMPLIANCE_STATUS,
  computeWeightedCompliancePct,
  pickBestContributionForMonth,
  resolveMemberMonthStatus,
} from './complianceStatus.js'
import { DEFAULT_PAYMENT_WINDOW } from './paymentWindow.js'

const WINDOW = { ...DEFAULT_PAYMENT_WINDOW }
const USER = 'user-a'

describe('complianceStatus', () => {
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
