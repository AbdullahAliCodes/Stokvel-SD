import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FinancialHealth from './FinancialHealth'

const { routerState, sessionState } = vi.hoisted(() => ({
  routerState: { stokvel_id: 'stok-1' },
  sessionState: {
    current: {
      session: { access_token: 'token-1', user: { id: 'user-1' } },
    },
  },
}))

const readViewCacheMock = vi.fn()

vi.mock('react-router-dom', () => ({
  useParams: () => routerState,
}))

vi.mock('../context/SessionContext', () => ({
  useSession: () => sessionState.current,
}))

vi.mock('../utils/api', () => ({
  apiUrl: (path) => `http://test${path}`,
}))

vi.mock('../utils/viewCache', () => ({
  readViewCache: (...args) => readViewCacheMock(...args),
}))

vi.mock('../components/GroupPageHeader', () => ({
  default: ({ title, subtitle }) => (
    <header>
      <h1>{title}</h1>
      {subtitle ? <p data-testid="subtitle">{subtitle}</p> : null}
    </header>
  ),
}))

vi.mock('../components/HealthScore/MemberHealthScore', () => ({
  default: ({ userId, groupId }) => (
    <div data-testid="member-health-score" data-user-id={userId} data-group-id={groupId}>
      MemberHealthScore
    </div>
  ),
}))

function renderPage() {
  return render(<FinancialHealth />)
}

describe('FinancialHealth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    routerState.stokvel_id = 'stok-1'
    sessionState.current = {
      session: { access_token: 'token-1', user: { id: 'user-1' } },
    }
    readViewCacheMock.mockReturnValue(null)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        text: async () =>
          JSON.stringify({ stokvel: { name: 'Alpha Stokvel' } }),
      })),
    )
  })

  it('renders page title and member health score when signed in', () => {
    readViewCacheMock.mockReturnValue({
      stokvel: { name: 'Cached Group' },
    })

    renderPage()

    expect(screen.getByRole('heading', { name: 'Financial Health' })).toBeInTheDocument()
    expect(screen.getByTestId('member-health-score')).toHaveAttribute('data-user-id', 'user-1')
    expect(screen.getByTestId('member-health-score')).toHaveAttribute('data-group-id', 'stok-1')
    expect(screen.getByText(/Cached Group/)).toBeInTheDocument()
  })

  it('prompts sign-in when session has no user', () => {
    sessionState.current = { session: null }

    renderPage()

    expect(screen.getByRole('heading', { name: 'Financial Health' })).toBeInTheDocument()
    expect(screen.getByText(/Sign in to view your financial health score/i)).toBeInTheDocument()
    expect(screen.queryByTestId('member-health-score')).not.toBeInTheDocument()
  })

  it('returns null when stokvel_id is missing', () => {
    routerState.stokvel_id = undefined

    const { container } = renderPage()

    expect(container).toBeEmptyDOMElement()
  })
})
