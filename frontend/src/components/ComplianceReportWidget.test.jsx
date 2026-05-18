import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ComplianceReportWidget from './ComplianceReportWidget'

const showAlertMock = vi.fn().mockResolvedValue(undefined)
const toPngMock = vi.fn()

vi.mock('../context/ModalContext', () => ({
  useAlert: () => showAlertMock,
}))

vi.mock('html-to-image', () => ({
  toPng: (...args) => toPngMock(...args),
}))

vi.mock('jspdf', () => ({
  jsPDF: vi.fn().mockImplementation(() => ({
    internal: { pageSize: { getWidth: () => 210 } },
    setFontSize: vi.fn(),
    setTextColor: vi.fn(),
    text: vi.fn(),
    addImage: vi.fn(),
    save: vi.fn(),
  })),
}))

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  BarChart: ({ children, data }) => (
    <div data-testid="bar-chart" data-length={data?.length ?? 0}>
      {children}
    </div>
  ),
  Bar: ({ dataKey }) => <div data-testid={`bar-${dataKey}`} />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
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
  beforeEach(() => {
    vi.clearAllMocks()
    toPngMock.mockResolvedValue('data:image/png;base64,ZmFrZQ==')
    showAlertMock.mockResolvedValue(undefined)

    class MockImage {
      constructor() {
        this.naturalWidth = 400
        this.naturalHeight = 200
        queueMicrotask(() => {
          if (this.onload) this.onload()
        })
      }
      set src(_value) {
        /* trigger load via constructor microtask */
      }
    }
    vi.stubGlobal('Image', MockImage)

    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:mock-csv'),
      revokeObjectURL: vi.fn(),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders chart view with mocked Recharts by default', () => {
    render(<ComplianceReportWidget {...defaultProps()} />)

    expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
    expect(screen.getByTestId('bar-chart')).toHaveAttribute('data-length', '3')
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

  it('switches between chart and table views', async () => {
    const user = userEvent.setup()
    render(<ComplianceReportWidget {...defaultProps()} />)

    expect(screen.getByTestId('bar-chart')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Table' }))
    expect(screen.queryByTestId('bar-chart')).not.toBeInTheDocument()
    expect(screen.getByRole('table')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Chart' }))
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
  })

  it('exports CSV without throwing', async () => {
    const user = userEvent.setup()
    const createElementSpy = vi.spyOn(document, 'createElement')

    render(<ComplianceReportWidget {...defaultProps()} />)

    await user.click(screen.getByRole('button', { name: /Export CSV/i }))

    expect(createElementSpy).toHaveBeenCalledWith('a')
    expect(URL.createObjectURL).toHaveBeenCalled()
    createElementSpy.mockRestore()
  })

  it('exports PDF using html-to-image and jsPDF mocks', async () => {
    const user = userEvent.setup()
    const { jsPDF } = await import('jspdf')

    render(<ComplianceReportWidget {...defaultProps()} />)

    await user.click(screen.getByRole('button', { name: /Export PDF/i }))

    await waitFor(() => {
      expect(toPngMock).toHaveBeenCalled()
      expect(jsPDF).toHaveBeenCalled()
    })
  })

  it('shows alert when PDF export fails', async () => {
    const user = userEvent.setup()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    toPngMock.mockRejectedValueOnce(new Error('png failed'))

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

    consoleError.mockRestore()
  })

  it('shows empty state when ledgerMonths is empty', () => {
    render(
      <ComplianceReportWidget
        {...defaultProps({
          ledgerMonths: [],
          contributions: [],
          missedPayments: [],
        })}
      />,
    )

    expect(screen.getByText(/No compliance data yet/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Export CSV/i })).not.toBeInTheDocument()
  })
})
