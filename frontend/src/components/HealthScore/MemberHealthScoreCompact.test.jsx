import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { SessionProvider } from '../../context/SessionContext'
import MemberHealthScoreCompact from './MemberHealthScoreCompact'

vi.mock('../../utils/api', () => ({
  apiUrl: (path) => `http://test${path}`,
}))

function renderCompact(session = null) {
  return render(
    <MemoryRouter>
      <SessionProvider session={session}>
        <MemberHealthScoreCompact userId="u1" groupId="stok-1" />
      </SessionProvider>
    </MemoryRouter>,
  )
}

describe('MemberHealthScoreCompact', () => {
  const mockFetch = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = mockFetch
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
          ok: true,
          text: async () =>
            JSON.stringify({ score: 65, grade: 'Fair', confidence: 70 }),
        }
      }
      throw new Error(`Unhandled fetch: ${u}`)
    })
  })

  it('returns null when userId or groupId is missing', () => {
    const { container } = render(
      <MemoryRouter>
        <SessionProvider session={{ access_token: 't', user: { id: 'u1' } }}>
          <MemberHealthScoreCompact userId="" groupId="stok-1" />
        </SessionProvider>
      </MemoryRouter>,
    )
    expect(container.firstChild).toBeNull()
  })

  it('prompts sign-in when session has no access token', () => {
    renderCompact(null)
    expect(screen.getByText(/Sign in to see your ML health score/i)).toBeInTheDocument()
  })

  it('links to financial health and shows score gauge after load', async () => {
    renderCompact({ access_token: 'token-1', user: { id: 'u1' } })

    const link = await screen.findByRole('link', {
      name: 'View full financial health report',
    })
    expect(link).toHaveAttribute('href', '/group/stok-1/financial-health')
    expect(screen.getByText('65')).toBeInTheDocument()
    expect(screen.getByText('ML health score')).toBeInTheDocument()
  })

  it('shows note-only placeholder when API returns a note', async () => {
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
          ok: true,
          text: async () => JSON.stringify({ note: 'Not enough history yet.' }),
        }
      }
      throw new Error(`Unhandled fetch: ${u}`)
    })

    renderCompact({ access_token: 'token-1', user: { id: 'u1' } })

    await waitFor(() => {
      expect(screen.getByText('—')).toBeInTheDocument()
    })
    expect(screen.getByText('ML health score')).toBeInTheDocument()
  })

  it('shows error alert when fetch fails', async () => {
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
          text: async () => JSON.stringify({ error: 'ML offline' }),
        }
      }
      throw new Error(`Unhandled fetch: ${u}`)
    })

    renderCompact({ access_token: 'token-1', user: { id: 'u1' } })

    expect(await screen.findByRole('alert')).toHaveTextContent('ML offline')
  })
})
