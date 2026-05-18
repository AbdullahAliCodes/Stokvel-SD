import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CustomFinancialReport from './CustomFinancialReport'

const downloadCsvMock = vi.fn()
const downloadPdfMock = vi.fn().mockResolvedValue(undefined)

vi.mock('../utils/reportExport', () => ({
  downloadCsv: (...args) => downloadCsvMock(...args),
  downloadPdf: (...args) => downloadPdfMock(...args),
}))

const USER_A = '11111111-1111-4111-8111-111111111111'
const USER_B = '22222222-2222-4222-8222-222222222222'

function buildMockProps() {
  return {
    effectiveStokvel: { name: 'Test Group', type: 'Rotating', contribution_amount: 100 },
    members: [
      { user_id: USER_A, profiles: { first_name: 'Alice', last_name: 'One' } },
      { user_id: USER_B, profiles: { first_name: 'Bob', last_name: 'Two' } },
    ],
    contributions: [
      {
        user_id: USER_A,
        target_month: '2026-01',
        amount: 100,
        treasurer_approval_status: 'approved',
      },
      {
        user_id: USER_A,
        target_month: '2026-02',
        amount: 100,
        treasurer_approval_status: 'approved',
      },
      {
        user_id: USER_B,
        target_month: '2026-01',
        amount: 100,
        treasurer_approval_status: 'approved',
      },
    ],
    payouts: [
      { user_id: USER_A, target_month: '2026-01' },
      { user_id: USER_B, target_month: '2026-02' },
    ],
    missedPayments: [{ user_id: USER_B, target_month: '2026-02' }],
    ledgerMonths: ['2026-01', '2026-02', '2026-03'],
    fixedPool: null,
    currentUserId: USER_A,
  }
}

function getReportTable() {
  return screen.getByRole('table')
}

describe('CustomFinancialReport (interactive)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('updates derived totals when switching from entire group to a specific member', async () => {
    const user = userEvent.setup()
    render(<CustomFinancialReport {...buildMockProps()} />)

    const janRow = within(getReportTable()).getByRole('row', { name: /2026-01/i })
    const groupCells = within(janRow).getAllByRole('cell')
    expect(groupCells[1]).toHaveTextContent('R 200')

    await user.selectOptions(screen.getByLabelText(/Target view/i), 'member')
    await user.selectOptions(screen.getByLabelText(/^Member$/i), USER_B)

    const memberJanRow = within(getReportTable()).getByRole('row', { name: /2026-01/i })
    const memberCells = within(memberJanRow).getAllByRole('cell')
    expect(memberCells[1]).toHaveTextContent('R 100')
  })

  it('truncates the table when start and end month filters narrow the range', async () => {
    const user = userEvent.setup()
    render(<CustomFinancialReport {...buildMockProps()} />)

    expect(within(getReportTable()).getAllByRole('row').length).toBeGreaterThan(3)

    await user.selectOptions(screen.getByLabelText(/Start month/i), '2026-02')
    await user.selectOptions(screen.getByLabelText(/End month/i), '2026-02')

    const rows = within(getReportTable()).getAllByRole('row')
    const bodyRows = rows.filter((row) => within(row).queryByText(/2026-/))
    expect(bodyRows).toHaveLength(1)
    expect(within(bodyRows[0]).getByText('2026-02')).toBeInTheDocument()
    expect(screen.queryByRole('row', { name: /2026-01/i })).not.toBeInTheDocument()
  })

  it('calls export helpers with filtered member payload', async () => {
    const user = userEvent.setup()
    render(<CustomFinancialReport {...buildMockProps()} />)

    await user.selectOptions(screen.getByLabelText(/Target view/i), 'member')
    await user.selectOptions(screen.getByLabelText(/^Member$/i), USER_A)
    await user.selectOptions(screen.getByLabelText(/Start month/i), '2026-01')
    await user.selectOptions(screen.getByLabelText(/End month/i), '2026-01')

    await user.click(screen.getByRole('button', { name: /Export CSV/i }))

    expect(downloadCsvMock).toHaveBeenCalledTimes(1)
    const [filenameBase, headers, rows] = downloadCsvMock.mock.calls[0]
    expect(filenameBase).toBe('custom_financial_Test Group')
    expect(headers[0]).toBe('Month')
    expect(rows).toHaveLength(1)
    expect(rows[0][0]).toBe('2026-01')
    expect(rows[0][1]).toBe('R 100')

    await user.click(screen.getByRole('button', { name: /Export PDF/i }))

    expect(downloadPdfMock).toHaveBeenCalledTimes(1)
    expect(downloadPdfMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Custom Financial Report',
        subtitle: expect.stringContaining('Personal Ledger: Alice One'),
        headers: expect.arrayContaining(['Month']),
        rows: expect.arrayContaining([expect.arrayContaining(['2026-01'])]),
        filenameBase: 'custom_financial_Test Group',
      }),
    )
  })

  it('shows empty-state copy when ledger months are missing', () => {
    render(
      <CustomFinancialReport
        {...buildMockProps()}
        ledgerMonths={[]}
        contributions={[]}
        payouts={[]}
        missedPayments={[]}
      />,
    )

    expect(screen.getByText(/Not enough ledger data yet/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Export CSV/i })).not.toBeInTheDocument()
  })
})
