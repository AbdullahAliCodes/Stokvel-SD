import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

const mockUnsubscribe = vi.fn()
let sessionState = null

vi.mock('./utils/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(() =>
        Promise.resolve({ data: { session: sessionState } }),
      ),
      onAuthStateChange: vi.fn((callback) => {
        callback('INITIAL_SESSION', sessionState)
        return { data: { subscription: { unsubscribe: mockUnsubscribe } } }
      }),
    },
  },
}))

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionState = null
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify([]),
    })
  })

  function renderAt(pathname) {
    window.history.pushState({}, '', pathname)
    return render(<App />)
  }

  it('renders the public landing route after auth initializes', async () => {
    renderAt('/')

    expect(await screen.findByText('Save together.')).toBeInTheDocument()
    expect(screen.getByText('Grow together.')).toBeInTheDocument()
  })

  it('renders the auth screen on /auth when there is no session', async () => {
    renderAt('/auth')

    expect(
      await screen.findByRole('heading', { name: 'Sign in' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
  })

  it('shows authenticating state on /auth while member role loads', async () => {
    sessionState = {
      access_token: 'member-token',
      user: { id: 'member-1', email: 'member@test.com' },
    }

    global.fetch = vi.fn(
      (url) =>
        new Promise((resolve) => {
          if (String(url).includes('/api/me')) {
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  text: async () =>
                    JSON.stringify({ user: { role: 'member' } }),
                }),
              500,
            )
            return
          }
          resolve({ ok: true, text: async () => JSON.stringify([]) })
        }),
    )

    renderAt('/auth')

    expect(await screen.findByText(/Authenticating/i)).toBeInTheDocument()
  })

  it('routes admins away from /auth once role is resolved', async () => {
    sessionState = {
      access_token: 'admin-token',
      user: { id: 'admin-1', email: 'admin@test.com' },
    }

    global.fetch = vi.fn(async (url) => {
      if (String(url).includes('/api/me')) {
        return {
          ok: true,
          text: async () => JSON.stringify({ user: { role: 'admin' } }),
        }
      }
      return { ok: true, text: async () => JSON.stringify([]) }
    })

    renderAt('/auth')

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Sign in' })).not.toBeInTheDocument()
    })
  })

  it('unsubscribes from auth state changes on unmount', async () => {
    const { unmount } = renderAt('/')
    await screen.findByText('Save together.')
    unmount()
    expect(mockUnsubscribe).toHaveBeenCalled()
  })
})
