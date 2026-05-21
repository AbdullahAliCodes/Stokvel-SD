import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SessionProvider } from '../../context/SessionContext'
import { useMemberHealthScore } from './useMemberHealthScore'

vi.mock('../../utils/api', () => ({
  apiUrl: (path) => `http://test${path}`,
}))

const session = {
  access_token: 'token-1',
  user: { id: 'u1', email: 'u1@test.com' },
}

const healthPayload = {
  score: 78,
  grade: 'Good',
  confidence: 82,
  summaryLine: 'Solid contributor.',
}

function wrapper({ children }) {
  return <SessionProvider session={session}>{children}</SessionProvider>
}

describe('useMemberHealthScore', () => {
  const mockFetch = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = mockFetch
    mockFetch.mockImplementation(async (url, init) => {
      const u = String(url)
      if (u.endsWith('/api/me')) {
        return {
          ok: true,
          text: async () => JSON.stringify({ user: { role: 'member' } }),
        }
      }
      if (u.includes('/health-score/refresh')) {
        return {
          ok: true,
          text: async () =>
            JSON.stringify({ ...healthPayload, score: 80, refreshed: true }),
        }
      }
      if (u.includes('/health-score')) {
        return {
          ok: true,
          text: async () => JSON.stringify(healthPayload),
        }
      }
      throw new Error(`Unhandled fetch: ${u} ${init?.method ?? 'GET'}`)
    })
  })

  it('loads health score payload for the member and group', async () => {
    const { result } = renderHook(
      () => useMemberHealthScore('u1', 'stok-1'),
      { wrapper },
    )

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.payload).toMatchObject({
      score: 78,
      grade: 'Good',
    })
    expect(result.current.error).toBe('')
    expect(mockFetch).toHaveBeenCalledWith(
      'http://test/api/members/u1/health-score?groupId=stok-1',
      expect.objectContaining({
        headers: { Authorization: 'Bearer token-1' },
      }),
    )
  })

  it('sets error when the health-score request fails', async () => {
    mockFetch.mockImplementation(async (url) => {
      const u = String(url)
      if (u.endsWith('/api/me')) {
        return {
          ok: true,
          text: async () => JSON.stringify({ user: { role: 'member' } }),
        }
      }
      if (u.includes('/health-score')) {
        return {
          ok: false,
          text: async () => JSON.stringify({ error: 'Score unavailable' }),
        }
      }
      throw new Error(`Unhandled fetch: ${u}`)
    })

    const { result } = renderHook(
      () => useMemberHealthScore('u1', 'stok-1'),
      { wrapper },
    )

    await waitFor(() => {
      expect(result.current.error).toBe('Score unavailable')
    })
    expect(result.current.payload).toBeNull()
  })

  it('refresh posts to the refresh endpoint and updates payload', async () => {
    const { result } = renderHook(
      () => useMemberHealthScore('u1', 'stok-1'),
      { wrapper },
    )

    await waitFor(() => {
      expect(result.current.payload?.score).toBe(78)
    })

    await act(async () => {
      await result.current.refresh()
    })

    await waitFor(() => {
      expect(result.current.payload?.score).toBe(80)
    })

    expect(mockFetch).toHaveBeenCalledWith(
      'http://test/api/members/u1/health-score/refresh?groupId=stok-1',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('does not fetch when userId or groupId is missing', async () => {
    const { result } = renderHook(
      () => useMemberHealthScore('', 'stok-1'),
      { wrapper },
    )

    await waitFor(() => {
      expect(result.current.canFetch).toBe(false)
    })

    expect(
      mockFetch.mock.calls.filter(([url]) => String(url).includes('/health-score')),
    ).toHaveLength(0)
    expect(result.current.payload).toBeNull()
  })
})
