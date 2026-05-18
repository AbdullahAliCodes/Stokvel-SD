import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MemberHealthScore from './MemberHealthScore'

const useMemberHealthScoreMock = vi.fn()

vi.mock('./useMemberHealthScore', () => ({
  useMemberHealthScore: (...args) => useMemberHealthScoreMock(...args),
}))

vi.mock('./ScoreGauge', () => ({
  default: ({ score, grade }) => (
    <div data-testid="score-gauge">
      {score}-{grade}
    </div>
  ),
}))

const excellentPayload = {
  score: 85,
  grade: 'Excellent',
  confidence: 92,
  on_time_rate: 88,
  missed_payments: 0,
  streak_months: 4,
  engagement_score: 76,
  avg_days_late: 1.2,
  model_version: 'rf-v1',
  summaryLine: 'Strong on-time contribution history.',
  last_calculated_at: '2026-04-01T10:00:00.000Z',
  feature_importances: {
    on_time_rate: 0.42,
    streak_months: 0.31,
  },
}

function mockHook(overrides = {}) {
  useMemberHealthScoreMock.mockReturnValue({
    session: { access_token: 'token-1' },
    loading: false,
    refreshing: false,
    error: '',
    payload: excellentPayload,
    refresh: vi.fn(),
    ...overrides,
  })
}

describe('MemberHealthScore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHook()
  })

  it('renders Excellent grade and score from ML payload', () => {
    render(<MemberHealthScore userId="user-1" groupId="group-1" />)

    expect(screen.getByText('Financial health')).toBeInTheDocument()
    expect(screen.getByText('Excellent')).toBeInTheDocument()
    expect(screen.getByTestId('score-gauge')).toHaveTextContent('85-Excellent')
    expect(screen.getByText(/Model confidence:/)).toHaveTextContent('92%')
    expect(screen.getByText(/Strong on-time contribution history/i)).toBeInTheDocument()
    expect(screen.getByText(/88%/)).toBeInTheDocument()
    expect(screen.getByText(/rf-v1/)).toBeInTheDocument()
  })

  it('shows missing ids message when userId or groupId is absent', () => {
    render(<MemberHealthScore userId="" groupId="" />)

    expect(screen.getByText(/Member health score/i)).toBeInTheDocument()
    expect(screen.getByText(/Select an active group/i)).toBeInTheDocument()
  })

  it('shows sign-in prompt when access token is missing', () => {
    mockHook({ session: { access_token: null }, payload: null })

    render(<MemberHealthScore userId="user-1" groupId="group-1" />)

    expect(screen.getByText(/Sign in to load your health score/i)).toBeInTheDocument()
  })

  it('shows note-only state when payload has note', () => {
    mockHook({
      payload: { note: 'Not enough contribution history yet.' },
    })

    render(<MemberHealthScore userId="user-1" groupId="group-1" />)

    expect(screen.getByText(/Score not modeled yet/i)).toBeInTheDocument()
    expect(screen.getByText(/Not enough contribution history yet/i)).toBeInTheDocument()
  })

  it('shows error alert and calls refresh', () => {
    const refresh = vi.fn()
    mockHook({ error: 'Health score unavailable', refresh })

    render(<MemberHealthScore userId="user-1" groupId="group-1" />)

    expect(screen.getByRole('alert')).toHaveTextContent('Health score unavailable')
    fireEvent.click(screen.getByRole('button', { name: 'Refresh score' }))
    expect(refresh).toHaveBeenCalled()
  })

  it('shows loading copy when hook is loading', () => {
    mockHook({ loading: true, payload: null })

    render(<MemberHealthScore userId="user-1" groupId="group-1" />)

    expect(screen.getByText(/Loading your ML reliability score/i)).toBeInTheDocument()
  })
})
