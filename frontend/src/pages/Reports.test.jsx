import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Reports from './Reports'

const scrollIntoViewMock = vi.fn()

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

vi.mock('../components/CustomFinancialReport', () => ({
  default: () => <div data-testid="custom-financial-report">CustomFinancialReport</div>,
}))

vi.mock('../components/ComplianceReportWidget', () => ({
  default: () => <div data-testid="compliance-report-widget">ComplianceReportWidget</div>,
}))

vi.mock('../components/GroupPageHeader', () => ({
  default: ({ title, subtitle }) => (
    <header>
      <h1>{title}</h1>
      {subtitle ? <div data-testid="group-header-subtitle">{subtitle}</div> : null}
    </header>
  ),
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

function okPayoutReportJson() {
  return {
    ok: true,
    text: async () =>
      JSON.stringify({
        report: {
          my_summary: { total_received_ytd: 0 },
          history: [],
          upcoming_projections: [],
        },
      }),
  }
}

describe('Reports', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    scrollIntoViewMock.mockReset()
    routerState.params = { stokvel_id: 'stok-1' }
    routerState.hash = ''
    sessionState.current = {
      session: { access_token: 'token-1', user: { id: 'u1' } },
    }
    readViewCacheMock.mockReturnValue(null)
    global.fetch = vi.fn(async (url) => {
      const u = String(url)
      if (u.endsWith('/api/stokvels/stok-1')) return okDetailJson()
      if (u.endsWith('/api/stokvels/stok-1/payout-report')) return okPayoutReportJson()
      throw new Error(`Unhandled fetch: ${url}`)
    })
    vi.spyOn(document, 'getElementById').mockImplementation((id) => {
      if (id === 'scroll-target') {
        return { scrollIntoView: scrollIntoViewMock }
      }
      return null
    })
  })

  it('renders payout and custom financial report panels when membership loads', async () => {
    render(<Reports />)

    expect(screen.getByRole('heading', { name: 'Reports' })).toBeInTheDocument()

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Payout History and Projections' }),
      ).toBeInTheDocument()
    })

    expect(screen.getByTestId('custom-financial-report')).toBeInTheDocument()
    expect(screen.getByTestId('compliance-report-widget')).toBeInTheDocument()
  })

  it('shows sign-in message when session is missing', () => {
    sessionState.current = { session: null }

    render(<Reports />)

    expect(screen.getByText(/Sign in to view reports/i)).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Payout History and Projections' }),
    ).not.toBeInTheDocument()
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

  it('returns null when stokvel_id is missing', () => {
    routerState.params = {}
    const { container } = render(<Reports />)
    expect(container.firstChild).toBeNull()
  })

  it('renders cached membership before the network refresh completes', async () => {
    let resolveDetail
    const detailDeferred = new Promise((resolve) => {
      resolveDetail = resolve
    })

    readViewCacheMock.mockReturnValue({
      membership: { group_role: 'member', stokvels: { id: 'stok-1', name: 'Cached Reports Group' } },
      stokvel: { id: 'stok-1', name: 'Cached Reports Group' },
      members: [],
      contributions: [{ target_month: '2026-02', user_id: 'u1' }],
      currentCycle: { targetMonth: '2026-04' },
      payouts: [],
      missedPayments: [],
      fixedPool: null,
    })

    global.fetch = vi.fn(async (url) => {
      const u = String(url)
      if (u.endsWith('/api/stokvels/stok-1')) return detailDeferred
      if (u.endsWith('/api/stokvels/stok-1/payout-report')) return okPayoutReportJson()
      throw new Error(`Unhandled fetch: ${url}`)
    })

    render(<Reports />)
    expect(await screen.findByText('Cached Reports Group')).toBeInTheDocument()
    expect(screen.getByTestId('custom-financial-report')).toBeInTheDocument()

    resolveDetail(okDetailJson())
    await waitFor(() => expect(screen.getByText('Test Group')).toBeInTheDocument())
    expect(writeViewCacheMock).toHaveBeenCalled()
  })

  it('shows not-a-member message when detail loads without membership', async () => {
    global.fetch = vi.fn(async (url) => {
      const u = String(url)
      if (u.endsWith('/api/stokvels/stok-1')) {
        return {
          ok: true,
          text: async () =>
            JSON.stringify({
              membership: null,
              stokvel: { id: 'stok-1', name: 'Ghost Group' },
              members: [],
              contributions: [],
              payouts: [],
              missedPayments: [],
            }),
        }
      }
      throw new Error(`Unhandled fetch: ${url}`)
    })

    render(<Reports />)

    expect(
      await screen.findByText(/You are not a member of this stokvel/i),
    ).toBeInTheDocument()
    expect(screen.queryByTestId('custom-financial-report')).not.toBeInTheDocument()
  })

  it('scrolls to the hash target after loading', async () => {
    routerState.hash = '#scroll-target'

    render(<Reports />)

    await waitFor(() => {
      expect(screen.getByTestId('compliance-report-widget')).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(scrollIntoViewMock).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'start',
      })
    })
  })

  it('builds ledger months from contributions, payouts, and missed payments', async () => {
    global.fetch = vi.fn(async (url) => {
      const u = String(url)
      if (u.endsWith('/api/stokvels/stok-1')) {
        return {
          ok: true,
          text: async () =>
            JSON.stringify({
              membership: { group_role: 'member', stokvels: { id: 'stok-1', name: 'Ledger Group' } },
              stokvel: { id: 'stok-1', name: 'Ledger Group' },
              members: [],
              contributions: [{ target_month: '2026-02', user_id: 'u1' }],
              currentCycle: { targetMonth: '2026-04' },
              payouts: [{ target_month: '2026-03', user_id: 'u2' }],
              missedPayments: [{ target_month: '2026-01', user_id: 'u3' }],
              fixedPool: null,
            }),
        }
      }
      if (u.endsWith('/api/stokvels/stok-1/payout-report')) return okPayoutReportJson()
      throw new Error(`Unhandled fetch: ${url}`)
    })

    render(<Reports />)
    expect(await screen.findByText('Ledger Group')).toBeInTheDocument()
    expect(screen.getByTestId('compliance-report-widget')).toBeInTheDocument()
  })

  it('renders the group name in the subtitle once detail has loaded', async () => {
    render(<Reports />)
    const subtitle = await screen.findByTestId('group-header-subtitle')
    expect(subtitle.textContent).toMatch(/Test Group/)
  })

  it('ignores hash scrolling when the hash is empty', async () => {
    routerState.hash = '#'
    render(<Reports />)
    await screen.findByText('Test Group')
    expect(scrollIntoViewMock).not.toHaveBeenCalled()
  })

  it('uses fallback subtitle when group name is not available yet', () => {
    sessionState.current = { session: null }

    render(<Reports />)

    expect(
      screen.getByText(
        /Payout history, projections, compliance, and custom financial views/i,
      ),
    ).toBeInTheDocument()
  })
})
