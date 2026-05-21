import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DashboardGateway from './DashboardGateway'

const {
  navigateMock,
  writeViewCacheMock,
  sessionState,
  userRoleState,
  fetchPayloadState,
  cachedValueState,
} = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  writeViewCacheMock: vi.fn(),
  sessionState: { current: null },
  userRoleState: { current: 'member' },
  fetchPayloadState: { current: null },
  cachedValueState: { current: null },
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}))

vi.mock('../context/SessionContext', () => ({
  useSession: () => ({
    session: sessionState.current,
    userRole: userRoleState.current,
  }),
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
  stokvelStatusOf: (membership) =>
    String(membership?.stokvels?.status ?? membership?.status ?? '').toLowerCase(),
}))

describe('DashboardGateway', () => {
  beforeEach(() => {
    navigateMock.mockReset()
    writeViewCacheMock.mockReset()
    sessionState.current = { user: { id: 'user-1' }, access_token: 'token-1' }
    userRoleState.current = 'member'
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
        { stokvels: { id: 'stokvel-1', name: 'Alpha', status: 'active' } },
        { stokvels: { id: 'stokvel-2', name: 'Zulu', status: 'active' } },
      ],
    }

    render(<DashboardGateway />)

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/group/stokvel-2/dashboard', { replace: true })
    })
  })

  it('routes admins to the admin console without loading memberships', async () => {
    userRoleState.current = 'admin'

    render(<DashboardGateway />)

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/admin/groups', { replace: true })
    })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('waits for role resolution before routing members', async () => {
    userRoleState.current = 'loading'

    render(<DashboardGateway />)

    await waitFor(() => expect(screen.getByText('Finding your stokvel…')).toBeInTheDocument())
    expect(navigateMock).not.toHaveBeenCalled()
  })

  it('routes to the first active group alphabetically when last_stokvel_id is missing', async () => {
    fetchPayloadState.current = {
      memberships: [
        { stokvels: { id: 'stokvel-z', name: 'Zulu', status: 'active' } },
        { stokvels: { id: 'stokvel-a', name: 'Alpha', status: 'active' } },
      ],
    }

    render(<DashboardGateway />)

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/group/stokvel-a/dashboard', { replace: true })
    })
  })

  it('ignores a stale last_stokvel_id and picks the first active membership', async () => {
    localStorage.setItem('last_stokvel_id', 'gone-stokvel')
    fetchPayloadState.current = {
      memberships: [{ stokvels: { id: 'stokvel-a', name: 'Alpha', status: 'active' } }],
    }

    render(<DashboardGateway />)

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/group/stokvel-a/dashboard', { replace: true })
    })
  })

  it('uses cached memberships when the network request fails', async () => {
    cachedValueState.current = {
      memberships: [{ stokvels: { id: 'cached-1', name: 'Cached', status: 'active' } }],
    }
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        text: async () => 'network down',
      }),
    )

    render(<DashboardGateway />)

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/group/cached-1/dashboard', { replace: true })
    })
  })

  it('routes to onboarding when active memberships have no stokvel id', async () => {
    fetchPayloadState.current = {
      memberships: [{ stokvels: { name: 'Broken row', status: 'active' } }],
    }

    render(<DashboardGateway />)

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/onboarding', { replace: true })
    })
  })

  it('routes to onboarding when fetch fails and there is no cache', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        text: async () => 'network down',
      }),
    )

    render(<DashboardGateway />)

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/onboarding', { replace: true })
    })
  })
})
