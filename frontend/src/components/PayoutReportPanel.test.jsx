import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PayoutReportPanel from './PayoutReportPanel'

vi.mock('../utils/api', () => ({
  apiUrl: (path) => `http://test${path}`,
}))

const sampleReport = {
  my_summary: {
    next_expected: {
      expected_amount: 5000,
      scheduled_payout_date: '2026-05-15',
      target_month: '2026-05',
    },
    total_received_ytd: 12000,
  },
  history: [
    {
      id: 'h1',
      user_id: 'u1',
      target_month: '2026-03',
      scheduled_payout_date: '2026-03-15',
      expected_amount: 5000,
      status: 'completed',
      is_mine: true,
      profile: { first_name: 'Ada', last_name: 'Lovelace' },
    },
  ],
  upcoming_projections: [
    {
      id: 'u1',
      user_id: 'u2',
      target_month: '2026-06',
      scheduled_payout_date: '2026-06-15',
      expected_amount: 4800,
      profile: { first_name: 'Bob' },
    },
  ],
}

describe('PayoutReportPanel', () => {
  const mockFetch = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = mockFetch
    mockFetch.mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ report: sampleReport }),
    })
  })

  it('shows loading spinner while fetching', () => {
    mockFetch.mockImplementation(() => new Promise(() => {}))

    render(
      <PayoutReportPanel stokvelId="stok-1" accessToken="token-1" enabled />,
    )

    expect(screen.getByLabelText('Loading payout report')).toBeInTheDocument()
  })

  it('does not fetch when disabled or missing credentials', async () => {
    const { rerender } = render(
      <PayoutReportPanel stokvelId="stok-1" accessToken="token-1" enabled={false} />,
    )

    await waitFor(() => {
      expect(mockFetch).not.toHaveBeenCalled()
    })

    rerender(<PayoutReportPanel stokvelId="" accessToken="token-1" enabled />)
    await waitFor(() => {
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  it('renders summary cards and payout tables on success', async () => {
    render(
      <PayoutReportPanel stokvelId="stok-1" accessToken="token-1" enabled />,
    )

    expect(
      await screen.findByText('Your next expected payout'),
    ).toBeInTheDocument()
    expect(
      screen.queryByLabelText('Loading payout report'),
    ).not.toBeInTheDocument()
    expect(screen.getAllByText(/R 5[\s\u00a0]?000/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/cycle 2026-05/)).toBeInTheDocument()
    expect(screen.getByText('Total received (YTD)')).toBeInTheDocument()
    expect(screen.getByText(/R 12[\s\u00a0]?000/)).toBeInTheDocument()

    expect(screen.getByText('Payout history')).toBeInTheDocument()
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.getByText('(you)')).toBeInTheDocument()
    expect(screen.getByText('Completed')).toBeInTheDocument()

    expect(screen.getByText('Upcoming projections')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()

    expect(mockFetch).toHaveBeenCalledWith(
      'http://test/api/stokvels/stok-1/payout-report',
      expect.objectContaining({
        headers: { Authorization: 'Bearer token-1' },
      }),
    )
  })

  it('shows empty table messages when history and projections are empty', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          report: {
            my_summary: { total_received_ytd: 0 },
            history: [],
            upcoming_projections: [],
          },
        }),
    })

    render(
      <PayoutReportPanel stokvelId="stok-1" accessToken="token-1" enabled />,
    )

    expect(
      await screen.findByText('No completed or past-due payouts yet.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('No upcoming payouts scheduled.'),
    ).toBeInTheDocument()
    expect(screen.getByText('No upcoming slot assigned to you yet.')).toBeInTheDocument()
  })

  it('shows API error message when fetch fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      text: async () => JSON.stringify({ error: 'Forbidden' }),
    })

    render(
      <PayoutReportPanel stokvelId="stok-1" accessToken="token-1" enabled />,
    )

    expect(await screen.findByText('Forbidden')).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Payout history' }),
    ).not.toBeInTheDocument()
  })
})
