import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { SessionProvider } from '../context/SessionContext'
import FinancialHealth from './FinancialHealth'
import { readViewCache } from '../utils/viewCache'

const { routerState } = vi.hoisted(() => ({
  routerState: { params: { stokvel_id: 'stok-1' } },
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useParams: () => routerState.params,
  }
})

vi.mock('../utils/api', () => ({
  apiUrl: (path) => `http://test${path}`,
}))

vi.mock('../utils/viewCache', () => ({
  readViewCache: vi.fn(() => null),
}))

const session = {
  access_token: 'token-1',
  user: { id: 'u1', email: 'member@test.com' },
}

function renderFinancialHealth() {
  return render(
    <MemoryRouter>
      <SessionProvider session={session}>
        <FinancialHealth />
      </SessionProvider>
    </MemoryRouter>,
  )
}

describe('FinancialHealth', () => {
  const mockFetch = vi.fn()
  const readViewCacheMock = vi.mocked(readViewCache)

  beforeEach(() => {
    vi.clearAllMocks()
    routerState.params = { stokvel_id: 'stok-1' }
    global.fetch = mockFetch
    readViewCacheMock.mockReturnValue(null)
    mockFetch.mockImplementation(async (url, init) => {
      const u = String(url)
      if (u.endsWith('/api/me')) {
        return {
          ok: true,
          text: async () => JSON.stringify({ user: { role: 'member' } }),
        }
      }
      if (u.endsWith('/api/stokvels/stok-1') && init?.method !== 'PATCH') {
        return {
          ok: true,
          text: async () =>
            JSON.stringify({
              stokvel: { name: 'Alpha Group' },
              membership: { stokvels: { name: 'Alpha Group' } },
            }),
        }
      }
      if (u.includes('/health-score/refresh')) {
        return {
          ok: true,
          text: async () =>
            JSON.stringify({
              score: 85,
              grade: 'Excellent',
              confidence: 91,
              summaryLine: 'Refreshed score.',
            }),
        }
      }
      if (u.includes('/health-score')) {
        return {
          ok: true,
          text: async () =>
            JSON.stringify({
              score: 70,
              grade: 'Good',
              confidence: 75,
              summaryLine: 'Steady contributor.',
            }),
        }
      }
      throw new Error(`Unhandled fetch: ${u}`)
    })
  })

  it('returns null when stokvel_id is missing', () => {
    routerState.params = {}
    const { container } = renderFinancialHealth()
    expect(container.firstChild).toBeNull()
  })

  it('renders page header and embeds MemberHealthScore for the signed-in member', async () => {
    renderFinancialHealth()

    expect(
      await screen.findByRole('heading', { name: 'Financial Health' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Alpha Group/)).toBeInTheDocument()
    expect(screen.getByText('Financial health')).toBeInTheDocument()
    expect(await screen.findByText('70')).toBeInTheDocument()
    expect(screen.getByText('Steady contributor.')).toBeInTheDocument()

    expect(mockFetch).toHaveBeenCalledWith(
      'http://test/api/members/u1/health-score?groupId=stok-1',
      expect.objectContaining({
        headers: { Authorization: 'Bearer token-1' },
      }),
    )
  })

  it('uses cached group name without fetching stokvel detail', async () => {
    readViewCacheMock.mockReturnValue({
      stokvel: { name: 'Cached Group' },
      membership: { stokvels: { name: 'Cached Group' } },
    })

    renderFinancialHealth()

    expect(await screen.findByText(/Cached Group/)).toBeInTheDocument()
    expect(
      mockFetch.mock.calls.some(([url]) => String(url).endsWith('/api/stokvels/stok-1')),
    ).toBe(false)
    expect(await screen.findByText('70')).toBeInTheDocument()
  })

  it('refreshes MemberHealthScore via the refresh control', async () => {
    renderFinancialHealth()

    await screen.findByText('70')
    fireEvent.click(screen.getByRole('button', { name: 'Refresh score' }))

    await waitFor(() => {
      expect(screen.getByText('85')).toBeInTheDocument()
    })
    expect(screen.getByText('Excellent')).toBeInTheDocument()
    expect(mockFetch).toHaveBeenCalledWith(
      'http://test/api/members/u1/health-score/refresh?groupId=stok-1',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('shows sign-in prompt when session is missing', () => {
    render(
      <MemoryRouter>
        <SessionProvider session={null}>
          <FinancialHealth />
        </SessionProvider>
      </MemoryRouter>,
    )

    expect(
      screen.getByText(/Sign in to view your financial health score/i),
    ).toBeInTheDocument()
    expect(screen.queryByText('Financial health')).not.toBeInTheDocument()
    expect(
      mockFetch.mock.calls.filter(([url]) => String(url).includes('/health-score')),
    ).toHaveLength(0)
  })
})
