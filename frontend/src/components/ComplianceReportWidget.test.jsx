import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ComplianceReportWidget from './ComplianceReportWidget'

vi.mock('../context/ModalContext', () => ({
  useAlert: () => vi.fn().mockResolvedValue(undefined),
}))

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
  BarChart: ({ children }) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
}))

const USER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'

const members = [
  {
    user_id: USER_ID,
    profiles: { first_name: 'Ada', last_name: 'Member' },
  },
]

const paymentWindow = {
  payment_window_start_day: 25,
  payment_window_end_day: 5,
}

describe('ComplianceReportWidget', () => {
  it('renders Paid, Late, and Missed badges in table view', () => {
    render(
      <ComplianceReportWidget
        members={members}
        contributions={[
          {
            user_id: USER_ID,
            target_month: '2026-03',
            paid_at: '2026-03-03T12:00:00+02:00',
          },
          {
            user_id: USER_ID,
            target_month: '2026-02',
            paid_at: '2026-03-10T12:00:00+02:00',
          },
        ]}
        missedPayments={[]}
        ledgerMonths={['2026-01', '2026-02', '2026-03']}
        refMonth="2026-04"
        paymentWindow={paymentWindow}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Table' }))

    expect(screen.getByText('Ada Member')).toBeInTheDocument()
    expect(screen.getAllByText('Paid').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Late').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Missed').length).toBeGreaterThanOrEqual(1)
  })

  it('shows empty state when ledgerMonths is empty', () => {
    render(
      <ComplianceReportWidget
        members={members}
        contributions={[]}
        missedPayments={[]}
        ledgerMonths={[]}
        refMonth="2026-04"
        paymentWindow={paymentWindow}
      />,
    )

    expect(screen.getByText(/No compliance data yet/i)).toBeInTheDocument()
  })
})
