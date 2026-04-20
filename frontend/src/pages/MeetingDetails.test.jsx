import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import MeetingDetails from './MeetingDetails'

const { paramsState } = vi.hoisted(() => ({
  paramsState: {
    current: { meeting_id: undefined, id: undefined, stokvel_id: undefined },
  },
}))

vi.mock('lucide-react', () => ({
  ArrowLeft: () => <span data-testid="arrow-left-icon" aria-hidden />,
}))

vi.mock('react-router-dom', () => ({
  Link: ({ to, children, ...rest }) => (
    <a href={to} data-to={to} {...rest}>
      {children}
    </a>
  ),
  useParams: () => paramsState.current,
}))

function renderMeetingDetails(overrides = {}) {
  paramsState.current = {
    meeting_id: undefined,
    id: undefined,
    stokvel_id: undefined,
    ...overrides,
  }
  render(<MeetingDetails />)
}

describe('MeetingDetails', () => {
  it('renders static meeting content and the edit action', () => {
    renderMeetingDetails({ meeting_id: 'mtg-101', stokvel_id: 'group-9' })

    expect(
      screen.getByRole('heading', { level: 1, name: 'Q1 planning' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Avoille Stokvel')).toBeInTheDocument()
    expect(
      screen.getByText('Saturday, 12 April 2026 — 10:00'),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Opening, review contributions, confirm payout order, AOB\./),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Edit meeting' }),
    ).toBeInTheDocument()
  })

  it('builds the back link with stokvel scope when stokvel_id is present', () => {
    renderMeetingDetails({ meeting_id: 'meeting-22', stokvel_id: 'stok-44' })

    const backLink = screen.getByRole('link', { name: /Back to meetings/i })

    expect(backLink).toHaveAttribute('href', '/group/stok-44/meetings')
  })

  it('falls back to dashboard back link when stokvel_id is missing', () => {
    renderMeetingDetails({ meeting_id: 'meeting-22', stokvel_id: undefined })

    const backLink = screen.getByRole('link', { name: /Back to meetings/i })

    expect(backLink).toHaveAttribute('href', '/dashboard')
  })

  it('uses meeting_id for meeting link and agenda meeting id when both ids are provided', () => {
    renderMeetingDetails({
      meeting_id: 'current-meeting-id',
      id: 'legacy-id-ignored',
      stokvel_id: 'stok-44',
    })

    const locationLink = screen.getByRole('link', {
      name: /https:\/\/meet\.example\.com\/room\/current-meeting-id/i,
    })

    expect(locationLink).toHaveAttribute(
      'href',
      'https://meet.example.com/room/current-meeting-id',
    )
    expect(screen.getByText(/\(Meeting ID:\s*current-meeting-id\)/)).toBeInTheDocument()
  })

  it('uses legacy id when meeting_id is nullish', () => {
    renderMeetingDetails({
      meeting_id: undefined,
      id: 'legacy-meeting-id',
      stokvel_id: 'stok-44',
    })

    const locationLink = screen.getByRole('link', {
      name: /https:\/\/meet\.example\.com\/room\/legacy-meeting-id/i,
    })

    expect(locationLink).toHaveAttribute(
      'href',
      'https://meet.example.com/room/legacy-meeting-id',
    )
    expect(screen.getByText(/\(Meeting ID:\s*legacy-meeting-id\)/)).toBeInTheDocument()
  })

  it("uses 'unknown' URL segment and em dash id when both ids are nullish", () => {
    renderMeetingDetails({
      meeting_id: undefined,
      id: undefined,
      stokvel_id: 'stok-44',
    })

    const locationLink = screen.getByRole('link', {
      name: /https:\/\/meet\.example\.com\/room\/unknown/i,
    })

    expect(locationLink).toHaveAttribute(
      'href',
      'https://meet.example.com/room/unknown',
    )
    expect(screen.getByText(/\(Meeting ID:\s*—\)/)).toBeInTheDocument()
  })

  it('sets external link security attributes correctly', () => {
    renderMeetingDetails({ meeting_id: 'meeting-22', stokvel_id: 'stok-44' })

    const locationLink = screen.getByRole('link', {
      name: /https:\/\/meet\.example\.com\/room\/meeting-22/i,
    })

    expect(locationLink).toHaveAttribute('target', '_blank')
    expect(locationLink).toHaveAttribute('rel', 'noreferrer')
  })
})
