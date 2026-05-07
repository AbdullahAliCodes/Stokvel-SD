import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { SessionProvider, useSession } from './SessionContext'

vi.mock('../utils/api', () => ({
  apiUrl: (path) => path,
}))

function SessionConsumer() {
  const { userRole, session } = useSession()
  return (
    <div>
      <span data-testid="role">{String(userRole)}</span>
      <span data-testid="sid">{session?.user?.id ?? 'none'}</span>
    </div>
  )
}

describe('SessionContext', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('keeps role null when no session is provided', () => {
    render(
      <SessionProvider session={null}>
        <SessionConsumer />
      </SessionProvider>,
    )

    expect(screen.getByTestId('role')).toHaveTextContent('null')
    expect(screen.getByTestId('sid')).toHaveTextContent('none')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('loads role from /api/me and normalizes admin role', async () => {
    fetch.mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ user: { role: 'ADMIN' } }),
    })

    render(
      <SessionProvider session={{ access_token: 'token-1', user: { id: 'u1' } }}>
        <SessionConsumer />
      </SessionProvider>,
    )

    await waitFor(() => expect(screen.getByTestId('role')).toHaveTextContent('admin'))
    expect(fetch).toHaveBeenCalledWith('/api/me', {
      headers: { Authorization: 'Bearer token-1' },
    })
  })

  it('falls back to user role when /api/me fails', async () => {
    fetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'boom',
    })

    render(
      <SessionProvider session={{ access_token: 'token-2', user: { id: 'u2' } }}>
        <SessionConsumer />
      </SessionProvider>,
    )

    await waitFor(() => expect(screen.getByTestId('role')).toHaveTextContent('user'))
  })

  it('throws when useSession is used outside provider', () => {
    function BadConsumer() {
      useSession()
      return null
    }
    expect(() => render(<BadConsumer />)).toThrow(/must be used within SessionProvider/i)
  })
})
