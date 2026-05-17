import { describe, expect, it } from '@jest/globals'
import { buildPayoutReport, isPayoutInHistory, normalizePayoutStatus } from './payoutReport.js'

const viewerId = '11111111-1111-4111-8111-111111111111'

describe('payoutReport', () => {
  it('normalizePayoutStatus treats disbursed rows as completed', () => {
    expect(normalizePayoutStatus({ status: 'pending', disbursed_at: '2026-03-01' })).toBe(
      'completed',
    )
    expect(normalizePayoutStatus({ status: 'completed' })).toBe('completed')
    expect(normalizePayoutStatus({ status: 'pending' })).toBe('pending')
  })

  it('buildPayoutReport splits history vs upcoming and sums YTD for viewer', () => {
    const report = buildPayoutReport({
      stokvel: { contribution_amount: 500 },
      members: [{ user_id: viewerId }, { user_id: 'u2' }],
      profileById: new Map(),
      viewerUserId: viewerId,
      todayIso: '2026-05-16',
      payoutRows: [
        {
          id: 'past',
          user_id: viewerId,
          target_month: '2026-03',
          scheduled_payout_date: '2026-04-01',
          cycle_index: 0,
          status: 'completed',
          disbursed_at: '2026-04-02T10:00:00Z',
        },
        {
          id: 'future',
          user_id: viewerId,
          target_month: '2026-06',
          scheduled_payout_date: '2026-06-20',
          cycle_index: 1,
          status: 'pending',
        },
        {
          id: 'other',
          user_id: 'u2',
          target_month: '2026-05',
          scheduled_payout_date: '2026-05-25',
          cycle_index: 2,
          status: 'pending',
        },
      ],
    })

    expect(report.summary.expected_payout_amount).toBe(1000)
    expect(report.history).toHaveLength(1)
    expect(report.upcoming_projections).toHaveLength(2)
    expect(report.my_summary.total_received_ytd).toBe(1000)
    expect(report.my_summary.next_expected?.scheduled_payout_date).toBe('2026-06-20')
    expect(report.my_summary.next_expected?.expected_amount).toBe(1000)
  })

  it('isPayoutInHistory includes past pending payouts', () => {
    expect(
      isPayoutInHistory(
        { scheduled_payout_date: '2026-01-01', status: 'pending' },
        '2026-05-16',
      ),
    ).toBe(true)
  })
})
