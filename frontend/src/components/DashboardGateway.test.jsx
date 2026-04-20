import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DashboardGateway from './DashboardGateway'

const {
  navigateMock,
  writeViewCacheMock,
  sessionState,
  fetchPayloadState,
  cachedValueState,
} = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  writeViewCacheMock: vi.fn(),
  sessionState: { current: null },
  fetchPayloadState: { current: null },
  cachedValueState: { current: null },
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}))

vi.mock('../context/SessionContext', () => ({
  useSession: () => ({ session: sessionState.current }),
}))

vi.mock('../utils/api', () => ({
  apiUrl: (path) => path,
}))

vi.mock('../utils/viewCache', () => ({
  readViewCache: vi.fn(() => cachedValueState.current),
  writeViewCache: writeViewCacheMock,
}))

vi.mock('../utils/stokvelMembership', () => ({
  myStokvelsCacheKey: () => 'my-stokvels-cache-key',
  stokvelStatusOf: (membership) => membership?.status ?? 'inactive',
}))

describe('DashboardGateway', () => {
  beforeEach(() => {
    navigateMock.mockReset()
    writeViewCacheMock.mockReset()
    sessionState.current = { user: { id: 'user-1' }, access_token: 'token-1' }
    fetchPayloadState.current = { memberships: [] }
    cachedValueState.current = null

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(fetchPayloadState.current),
      }),
    )
    localStorage.clear()
  })

  it('shows loading state while routing user', () => {
    render(<DashboardGateway />)
    expect(screen.getByText('Finding your stokvel…')).toBeInTheDocument()
  })

  it('routes user to onboarding when there are no active memberships', async () => {
    render(<DashboardGateway />)

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/onboarding', { replace: true })
    })
  })

  it('routes user to last viewed dashboard when membership is still active', async () => {
    localStorage.setItem('last_stokvel_id', 'stokvel-2')
    fetchPayloadState.current = {
      memberships: [
        { status: 'active', stokvels: { id: 'stokvel-1', name: 'Alpha' } },
        { status: 'active', stokvels: { id: 'stokvel-2', name: 'Zulu' } },
      ],
    }

    render(<DashboardGateway />)

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/group/stokvel-2/dashboard', { replace: true })
    })
  })
})
