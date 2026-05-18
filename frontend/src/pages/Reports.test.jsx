import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Reports from './Reports'

const { routerState, sessionState } = vi.hoisted(() => ({
  routerState: {
    params: { stokvel_id: 'stok-1' },
    hash: '',
  },
  sessionState: {
    current: { session: { access_token: 'token-1', user: { id: 'u1' } } },
  },
}))

const readViewCacheMock = vi.fn()
const writeViewCacheMock = vi.fn()

vi.mock('react-router-dom', () => ({
  useParams: () => routerState.params,
  useLocation: () => ({ hash: routerState.hash }),
}))

vi.mock('../context/SessionContext', () => ({
  useSession: () => sessionState.current,
}))

vi.mock('../utils/api', () => ({
  apiUrl: (path) => `http://test${path}`,
}))

vi.mock('../utils/viewCache', () => ({
  readViewCache: (...args) => readViewCacheMock(...args),
  writeViewCache: (...args) => writeViewCacheMock(...args),
}))

vi.mock('../components/PayoutReportPanel', () => ({
  default: ({ stokvelId, enabled }) => (
    <div data-testid="payout-report-panel" data-stokvel-id={stokvelId} data-enabled={String(enabled)}>
      PayoutReportPanel
    </div>
  ),
}))

vi.mock('../components/CustomFinancialReport', () => ({
  default: () => <div data-testid="custom-financial-report">CustomFinancialReport</div>,
}))

vi.mock('../components/ComplianceReportWidget', () => ({
  default: () => <div data-testid="compliance-report-widget">ComplianceReportWidget</div>,
}))

vi.mock('../components/GroupPageHeader', () => ({
  default: ({ title }) => <h1>{title}</h1>,
}))

function okDetailJson() {
  return {
    ok: true,
    text: async () =>
      JSON.stringify({
        membership: { group_role: 'member', stokvels: { id: 'stok-1', name: 'Test Group' } },
        stokvel: { id: 'stok-1', name: 'Test Group' },
        members: [],
        contributions: [],
        currentCycle: { targetMonth: '2026-04' },
        payouts: [],
        missedPayments: [],
        fixedPool: null,
      }),
  }
}

describe('Reports', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    routerState.params = { stokvel_id: 'stok-1' }
    routerState.hash = ''
    sessionState.current = {
      session: { access_token: 'token-1', user: { id: 'u1' } },
    }
    readViewCacheMock.mockReturnValue(null)
    global.fetch = vi.fn(async (url) => {
      if (String(url).endsWith('/api/stokvels/stok-1')) return okDetailJson()
      throw new Error(`Unhandled fetch: ${url}`)
    })
  })

  it('renders payout and custom financial report panels when membership loads', async () => {
    render(<Reports />)

    expect(screen.getByRole('heading', { name: 'Reports' })).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByTestId('payout-report-panel')).toBeInTheDocument()
    })

    expect(screen.getByTestId('custom-financial-report')).toBeInTheDocument()
    expect(screen.getByTestId('compliance-report-widget')).toBeInTheDocument()
    expect(screen.getByTestId('payout-report-panel')).toHaveAttribute('data-stokvel-id', 'stok-1')
    expect(screen.getByTestId('payout-report-panel')).toHaveAttribute('data-enabled', 'true')
  })

  it('shows sign-in message when session is missing', () => {
    sessionState.current = { session: null }

    render(<Reports />)

    expect(screen.getByText(/Sign in to view reports/i)).toBeInTheDocument()
    expect(screen.queryByTestId('payout-report-panel')).not.toBeInTheDocument()
  })

  it('shows error when stokvel fetch fails', async () => {
    global.fetch = vi.fn(async () => ({
      ok: false,
      text: async () => 'Server error',
    }))

    render(<Reports />)

    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('custom-financial-report')).not.toBeInTheDocument()
  })
})
