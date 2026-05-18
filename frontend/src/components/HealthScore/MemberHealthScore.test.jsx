import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MemberHealthScore from './MemberHealthScore'

const refreshMock = vi.fn()
const useMemberHealthScoreMock = vi.fn()

vi.mock('./useMemberHealthScore', () => ({
  useMemberHealthScore: (...args) => useMemberHealthScoreMock(...args),
}))

vi.mock('./ScoreGauge', () => ({
  default: ({ score, grade }) => (
    <div data-testid="score-gauge" data-score={score} data-grade={grade} />
  ),
}))

function mockHook(overrides = {}) {
  useMemberHealthScoreMock.mockReturnValue({
    session: { access_token: 'token-1' },
    loading: false,
    refreshing: false,
    error: '',
    payload: {
      score: 85,
      grade: 'Excellent',
      confidence: 92,
      on_time_rate: 95,
      missed_payments: 0,
      streak_months: 6,
      engagement_score: 88,
      avg_days_late: 1.2,
      summaryLine: 'Strong on-time contribution history.',
      model_version: 'rf-v1',
      last_calculated_at: '2026-03-01T10:00:00.000Z',
      feature_importances: { on_time_rate: 0.4, streak_months: 0.3 },
    },
    refresh: refreshMock,
    ...overrides,
  })
}

describe('MemberHealthScore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHook()
  })

  it('renders Excellent grade and ML metrics from payload', () => {
    render(<MemberHealthScore userId="user-1" groupId="stok-1" />)

    expect(screen.getByRole('heading', { name: 'Financial health' })).toBeInTheDocument()
    expect(screen.getByText('Excellent')).toBeInTheDocument()
    expect(screen.getByTestId('score-gauge')).toHaveAttribute('data-score', '85')
    expect(screen.getByTestId('score-gauge')).toHaveAttribute('data-grade', 'Excellent')
    expect(screen.getByText(/Model confidence:/)).toBeInTheDocument()
    expect(screen.getByText('92%')).toBeInTheDocument()
    expect(screen.getByText('95%')).toBeInTheDocument()
    expect(screen.getByText(/Strong on-time contribution history/i)).toBeInTheDocument()
    expect(screen.getByText(/Model feature importance/i)).toBeInTheDocument()
  })

  it('calls refresh when Refresh score is clicked', async () => {
    const user = userEvent.setup()
    render(<MemberHealthScore userId="user-1" groupId="stok-1" />)

    await user.click(screen.getByRole('button', { name: 'Refresh score' }))

    expect(refreshMock).toHaveBeenCalledTimes(1)
  })

  it('shows sign-in message when session token is missing', () => {
    mockHook({ session: null })

    render(<MemberHealthScore userId="user-1" groupId="stok-1" />)

    expect(screen.getByText(/Sign in to load your health score/i)).toBeInTheDocument()
  })

  it('asks for userId and groupId when props are missing', () => {
    render(<MemberHealthScore />)

    expect(screen.getByRole('heading', { name: 'Member health score' })).toBeInTheDocument()
    expect(screen.getByText(/Select an active group/i)).toBeInTheDocument()
  })

  it('shows note-only state without gauge', () => {
    mockHook({
      payload: { note: 'Not enough contribution history yet.' },
    })

    render(<MemberHealthScore userId="user-1" groupId="stok-1" />)

    expect(screen.getByText(/Score not modeled yet/i)).toBeInTheDocument()
    expect(screen.getByText(/Not enough contribution history yet/i)).toBeInTheDocument()
    expect(screen.queryByTestId('score-gauge')).not.toBeInTheDocument()
  })
})
