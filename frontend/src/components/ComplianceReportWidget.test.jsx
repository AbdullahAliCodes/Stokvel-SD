import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ComplianceReportWidget from './ComplianceReportWidget'

const showAlertMock = vi.fn().mockResolvedValue(undefined)

const { jsPDFMock } = vi.hoisted(() => ({
  jsPDFMock: vi.fn(function MockJsPDF() {
    return {
      internal: { pageSize: { getWidth: () => 297 } },
      setFontSize: vi.fn(),
      setTextColor: vi.fn(),
      text: vi.fn(),
      addImage: vi.fn(),
      save: vi.fn(),
    }
  }),
}))

vi.mock('../context/ModalContext', () => ({
  useAlert: () => showAlertMock,
}))

vi.mock('html-to-image', () => ({
  toPng: vi.fn().mockResolvedValue('data:image/png;base64,AAAA'),
}))

vi.mock('jspdf', () => ({
  jsPDF: jsPDFMock,
}))

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  BarChart: ({ children, data }) => (
    <div data-testid="bar-chart" data-rows={data?.length ?? 0}>
      {children}
    </div>
  ),
  Bar: ({ dataKey }) => <div data-testid={`bar-${dataKey}`} />,
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

function defaultProps(overrides = {}) {
  return {
    members,
    contributions: [
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
    ],
    missedPayments: [],
    ledgerMonths: ['2026-01', '2026-02', '2026-03'],
    refMonth: '2026-04',
    paymentWindow,
    ...overrides,
  }
}

describe('ComplianceReportWidget', () => {
  let anchorClickSpy

  beforeEach(() => {
    vi.clearAllMocks()
    showAlertMock.mockResolvedValue(undefined)

    anchorClickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {})

    vi.stubGlobal(
      'Image',
      class MockImage {
        set src(_value) {
          this.naturalWidth = 400
          this.naturalHeight = 200
          queueMicrotask(() => this.onload?.())
        }
      },
    )

    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:compliance-csv'),
      revokeObjectURL: vi.fn(),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('renders chart view with recharts wrapper by default', () => {
    render(<ComplianceReportWidget {...defaultProps()} />)

    expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
    expect(screen.getByTestId('bar-chart')).toHaveAttribute('data-rows', '3')
    expect(screen.getByTestId('bar-Paid')).toBeInTheDocument()
    expect(screen.getByTestId('bar-Late')).toBeInTheDocument()
    expect(screen.getByTestId('bar-Missed')).toBeInTheDocument()
  })

  it('renders Paid, Late, and Missed badges in table view', () => {
    render(<ComplianceReportWidget {...defaultProps()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Table' }))

    expect(screen.getByText('Ada Member')).toBeInTheDocument()
    expect(screen.getAllByText('Paid').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Late').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Missed').length).toBeGreaterThanOrEqual(1)
  })

  it('exports CSV via download link without leaving the page', async () => {
    const user = userEvent.setup()
    render(<ComplianceReportWidget {...defaultProps()} />)

    await user.click(screen.getByRole('button', { name: /Export CSV/i }))

    expect(URL.createObjectURL).toHaveBeenCalled()
    expect(anchorClickSpy).toHaveBeenCalled()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:compliance-csv')
  })

  it('exports PDF using html-to-image and jsPDF', async () => {
    const user = userEvent.setup()
    const { toPng } = await import('html-to-image')

    render(<ComplianceReportWidget {...defaultProps()} />)

    await user.click(screen.getByRole('button', { name: /Export PDF/i }))

    await waitFor(() => {
      expect(toPng).toHaveBeenCalled()
      expect(jsPDFMock).toHaveBeenCalled()
    })

    const pdfInstance = jsPDFMock.mock.results[0]?.value
    expect(pdfInstance.save).toHaveBeenCalledWith('compliance_report.pdf')
    expect(showAlertMock).not.toHaveBeenCalled()
  })

  it('shows alert when PDF export fails', async () => {
    const user = userEvent.setup()
    const { toPng } = await import('html-to-image')
    toPng.mockRejectedValueOnce(new Error('png failed'))

    render(<ComplianceReportWidget {...defaultProps()} />)

    await user.click(screen.getByRole('button', { name: /Export PDF/i }))

    await waitFor(() => {
      expect(showAlertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          title: 'PDF export failed',
        }),
      )
    })
  })

  it('shows empty state when ledgerMonths is empty', () => {
    render(
      <ComplianceReportWidget
        {...defaultProps({
          ledgerMonths: [],
          contributions: [],
        })}
      />,
    )

    expect(screen.getByText(/No compliance data yet/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Export CSV/i })).not.toBeInTheDocument()
  })
})
