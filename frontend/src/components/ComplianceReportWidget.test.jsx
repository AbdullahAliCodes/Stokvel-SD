import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ComplianceReportWidget from './ComplianceReportWidget'

const showAlertMock = vi.fn().mockResolvedValue(undefined)

vi.mock('../context/ModalContext', () => ({
  useAlert: () => showAlertMock,
}))

vi.mock('html-to-image', () => ({
  toPng: vi.fn().mockResolvedValue('data:image/png;base64,abc'),
}))

vi.mock('jspdf', () => {
  class JsPDF {
    internal = { pageSize: { getWidth: () => 297 } }
    setFontSize = vi.fn()
    setTextColor = vi.fn()
    text = vi.fn()
    addImage = vi.fn()
    save = vi.fn()
  }
  return { jsPDF: JsPDF }
})

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
  beforeEach(() => {
    showAlertMock.mockClear()
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:compliance'),
      revokeObjectURL: vi.fn(),
    })
    class MockImage {
      constructor() {
        this.naturalWidth = 1200
        this.naturalHeight = 600
        queueMicrotask(() => this.onload?.())
      }
      set src(_value) {
        queueMicrotask(() => this.onload?.())
      }
    }
    vi.stubGlobal('Image', MockImage)
  })

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

  it('switches between chart and table views', () => {
    render(
      <ComplianceReportWidget
        members={members}
        contributions={[]}
        missedPayments={[]}
        ledgerMonths={['2026-03']}
        refMonth="2026-04"
        paymentWindow={paymentWindow}
      />,
    )

    expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Table' }))
    expect(screen.queryByTestId('bar-chart')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Chart' }))
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
  })

  it('exports compliance data as CSV', () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    render(
      <ComplianceReportWidget
        members={members}
        contributions={[
          {
            user_id: USER_ID,
            target_month: '2026-03',
            paid_at: '2026-03-03T12:00:00+02:00',
          },
        ]}
        missedPayments={[]}
        ledgerMonths={['2026-03']}
        refMonth="2026-04"
        paymentWindow={paymentWindow}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Export CSV/i }))
    expect(URL.createObjectURL).toHaveBeenCalled()
    expect(clickSpy).toHaveBeenCalled()
    clickSpy.mockRestore()
  })

  it('exports compliance data as PDF when capture succeeds', async () => {
    const { toPng } = await import('html-to-image')
    toPng.mockImplementation(async (_node, options) => {
      const tooltipNode = { classList: { contains: (cls) => cls === 'recharts-tooltip-wrapper' } }
      const keepNode = { classList: { contains: () => false } }
      expect(options.filter(tooltipNode)).toBe(false)
      expect(options.filter(keepNode)).toBe(true)
      return 'data:image/png;base64,abc'
    })

    render(
      <ComplianceReportWidget
        members={members}
        contributions={[]}
        missedPayments={[]}
        ledgerMonths={['2026-03']}
        refMonth="2026-04"
        paymentWindow={paymentWindow}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Export PDF/i }))

    await waitFor(() => expect(toPng).toHaveBeenCalled())
  })

  it('alerts when PDF export fails', async () => {
    const { toPng } = await import('html-to-image')
    toPng.mockRejectedValueOnce(new Error('capture failed'))

    render(
      <ComplianceReportWidget
        members={members}
        contributions={[]}
        missedPayments={[]}
        ledgerMonths={['2026-03']}
        refMonth="2026-04"
        paymentWindow={paymentWindow}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Export PDF/i }))

    await waitFor(() => {
      expect(showAlertMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'PDF export failed' }),
      )
    })
  })

  it('renders member display fallbacks and compliance badge tiers', () => {
    const roster = [
      { user_id: 'u-email', profiles: { email: 'zoe@example.com' } },
      { user_id: 'u-full', profiles: { full_name: 'Full Name' } },
      { user_id: 'u-blank', profiles: {} },
      {
        user_id: USER_ID,
        profiles: { first_name: 'Ada', last_name: 'Member' },
      },
    ]

    render(
      <ComplianceReportWidget
        members={roster}
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
          {
            user_id: 'u-email',
            target_month: '2026-03',
            paid_at: '2026-03-04T12:00:00+02:00',
          },
        ]}
        missedPayments={[]}
        ledgerMonths={['2026-02', '2026-03']}
        refMonth="2026-04"
        paymentWindow={paymentWindow}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Table' }))

    expect(screen.getByText('zoe')).toBeInTheDocument()
    expect(screen.getByText('Full Name')).toBeInTheDocument()
    expect(screen.getAllByText('Member').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Missed').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/\d+%/).length).toBeGreaterThan(0)
  })
})
