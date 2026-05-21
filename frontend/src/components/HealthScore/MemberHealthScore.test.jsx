import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SessionProvider } from '../../context/SessionContext'
import MemberHealthScore from './MemberHealthScore'

vi.mock('../../utils/api', () => ({
  apiUrl: (path) => `http://test${path}`,
}))

const session = { access_token: 'token-1', user: { id: 'u1' } }

function renderScore(props = {}) {
  return render(
    <SessionProvider session={session}>
      <MemberHealthScore userId="u1" groupId="stok-1" {...props} />
    </SessionProvider>,
  )
}

describe('MemberHealthScore', () => {
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
            JSON.stringify({
              score: 90,
              grade: 'Excellent',
              confidence: 95,
              summaryLine: 'Refreshed.',
            }),
        }
      }
      if (u.includes('/health-score')) {
        return {
          ok: true,
          text: async () =>
            JSON.stringify({
              score: 72,
              grade: 'Good',
              confidence: 88,
              summaryLine: 'On track.',
              on_time_rate: 92,
              missed_payments: 0,
              streak_months: 4,
              engagement_score: 80,
              avg_days_late: 1,
              model_version: 'rf-v1',
              last_calculated_at: '2026-04-20T10:00:00.000Z',
              feature_importances: { on_time: 0.4, streak: 0.3 },
            }),
        }
      }
      throw new Error(`Unhandled fetch: ${u} ${init?.method ?? 'GET'}`)
    })
  })

  it('shows missing id message when userId or groupId is absent', () => {
    renderScore({ userId: '', groupId: '' })
    expect(screen.getByText(/Select an active group/i)).toBeInTheDocument()
  })

  it('renders score details and metrics after load', async () => {
    renderScore()

    expect(await screen.findByText('Financial health')).toBeInTheDocument()
    expect(screen.getByText('72')).toBeInTheDocument()
    expect(screen.getByText('Good')).toBeInTheDocument()
    expect(screen.getByText('Model confidence:')).toBeInTheDocument()
    expect(screen.getByText('88%')).toBeInTheDocument()
    expect(screen.getByText('On track.')).toBeInTheDocument()
    expect(screen.getByText('92%')).toBeInTheDocument()
    expect(screen.getByText('rf-v1')).toBeInTheDocument()
    expect(screen.getByText('on_time')).toBeInTheDocument()
  })

  it('refreshes score when Refresh score is clicked', async () => {
    renderScore()

    await screen.findByText('72')
    fireEvent.click(screen.getByRole('button', { name: 'Refresh score' }))

    await waitFor(() => {
      expect(screen.getByText('90')).toBeInTheDocument()
    })
    expect(screen.getByText('Excellent')).toBeInTheDocument()
  })

  it('renders note-only state when API returns a note', async () => {
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
            JSON.stringify({ note: 'Need at least 3 months of data.' }),
        }
      }
      throw new Error(`Unhandled fetch: ${u}`)
    })

    renderScore()

    expect(
      await screen.findByText('Score not modeled yet'),
    ).toBeInTheDocument()
    expect(screen.getByText('Need at least 3 months of data.')).toBeInTheDocument()
  })
})
