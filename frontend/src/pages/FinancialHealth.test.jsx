import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import FinancialHealth from './FinancialHealth'

const sessionState = vi.hoisted(() => ({
  current: {
    session: {
      access_token: 'token-1',
      user: { id: 'user-1' },
    },
  },
}))

const readViewCacheMock = vi.fn()

vi.mock('../context/SessionContext', () => ({
  useSession: () => sessionState.current,
}))

vi.mock('../utils/viewCache', () => ({
  readViewCache: (...args) => readViewCacheMock(...args),
}))

vi.mock('../utils/api', () => ({
  apiUrl: (path) => `http://test${path}`,
}))

vi.mock('../components/GroupPageHeader', () => ({
  default: ({ title, subtitle }) => (
    <header data-testid="group-page-header">
      <h1>{title}</h1>
      <div>{subtitle}</div>
    </header>
  ),
}))

vi.mock('../components/HealthScore/MemberHealthScore', () => ({
  default: ({ userId, groupId }) => (
    <section data-testid="member-health-score" data-user-id={userId} data-group-id={groupId}>
      Member health score panel
    </section>
  ),
}))

function renderPage(path = '/dashboard/stokvels/stok-1/financial-health') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/dashboard/stokvels/:stokvel_id/financial-health" element={<FinancialHealth />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('FinancialHealth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionState.current = {
      session: {
        access_token: 'token-1',
        user: { id: 'user-1' },
      },
    }
    readViewCacheMock.mockReturnValue(null)
    global.fetch = vi.fn()
  })

  it('renders page title and MemberHealthScore when session is present', () => {
    readViewCacheMock.mockReturnValue({
      stokvel: { name: 'Ubuntu Collective' },
    })

    renderPage()

    expect(screen.getByRole('heading', { name: 'Financial Health' })).toBeInTheDocument()
    expect(screen.getByTestId('member-health-score')).toBeInTheDocument()
    expect(screen.getByTestId('member-health-score')).toHaveAttribute('data-user-id', 'user-1')
    expect(screen.getByTestId('member-health-score')).toHaveAttribute('data-group-id', 'stok-1')
    expect(screen.getByText(/Ubuntu Collective/)).toBeInTheDocument()
  })

  it('loads group name from API when cache is empty', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          stokvel: { name: 'API Group Name' },
        }),
    })

    renderPage()

    await waitFor(() => {
      expect(screen.getByText(/API Group Name/)).toBeInTheDocument()
    })
    expect(global.fetch).toHaveBeenCalledWith(
      'http://test/api/stokvels/stok-1',
      expect.objectContaining({
        headers: { Authorization: 'Bearer token-1' },
      }),
    )
  })

  it('prompts sign-in when session user is missing', () => {
    sessionState.current = { session: null }

    renderPage()

    expect(screen.getByText(/Sign in to view your financial health score/i)).toBeInTheDocument()
    expect(screen.queryByTestId('member-health-score')).not.toBeInTheDocument()
  })

  it('returns null when stokvel_id param is missing', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/financial-health']}>
        <Routes>
          <Route path="/financial-health" element={<FinancialHealth />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(container).toBeEmptyDOMElement()
  })
})
