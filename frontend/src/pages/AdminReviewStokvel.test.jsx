import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import AdminReviewStokvel from './AdminReviewStokvel'
import { SessionContext } from '../context/SessionContext'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: '123' }),
  }
})

vi.mock('../utils/api', () => ({
  apiUrl: (path) => `http://localhost${path}`,
}))

const renderWithProviders = (ui, { session = null } = {}) => {
  return render(
    <MemoryRouter>
      <SessionContext.Provider value={{ session, userRole: 'admin' }}>
        {ui}
      </SessionContext.Provider>
    </MemoryRouter>
  )
}

describe('AdminReviewStokvel', () => {
  const mockFetch = vi.fn()
  global.fetch = mockFetch

  beforeEach(() => {
    vi.clearAllMocks()
  })

  const mockStokvelFull = {
    name: 'New Application',
    status: 'pending',
    contribution_amount: 1500,
    type: 'Rotating',
    payout_strategy: 'Manual',
    cycle_length: 5,
    meeting_frequency: 'Weekly',
    payout_order: 'Alphabetical'
  }

  const mockStokvelPartial = {
    name: null,
    status: null,
    contribution_amount: null,
    type: '',
    payout_strategy: null,
    cycle_length: null,
    meeting_frequency: '',
    payout_order: null
  }

  it('does not fetch if session is missing access_token', () => {
    renderWithProviders(<AdminReviewStokvel />, { session: { user: { id: 1 } } })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('shows loading state initially', () => {
    mockFetch.mockImplementation(() => new Promise(() => {}))
    renderWithProviders(<AdminReviewStokvel />, { session: { access_token: 'fake-token' } })
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('shows not found if API returns null stokvel', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ stokvel: null }),
    })
    renderWithProviders(<AdminReviewStokvel />, { session: { access_token: 'fake-token' } })
    expect(await screen.findByText('Application not found.')).toBeInTheDocument()
  })

  it('handles initial load JSON error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      text: async () => JSON.stringify({ error: 'Load error JSON' }),
    })
    renderWithProviders(<AdminReviewStokvel />, { session: { access_token: 'fake-token' } })
    expect(await screen.findByText('Load error JSON')).toBeInTheDocument()
    expect(screen.getByText('Application not found.')).toBeInTheDocument()
  })

  it('handles initial load text error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      text: async () => 'Load error Text',
    })
    renderWithProviders(<AdminReviewStokvel />, { session: { access_token: 'fake-token' } })
    expect(await screen.findByText('Load error Text')).toBeInTheDocument()
  })

  it('handles initial load network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network fail'))
    renderWithProviders(<AdminReviewStokvel />, { session: { access_token: 'fake-token' } })
    expect(await screen.findByText('Network fail')).toBeInTheDocument()
  })

  it('renders full stokvel details properly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ stokvel: mockStokvelFull }),
    })
    renderWithProviders(<AdminReviewStokvel />, { session: { access_token: 'fake-token' } })
    
    await waitFor(() => {
      expect(screen.getByText('New Application')).toBeInTheDocument()
      expect(screen.getByText('pending')).toBeInTheDocument()
      expect(screen.getByText('R 1500')).toBeInTheDocument()
      expect(screen.getByText('Rotating')).toBeInTheDocument()
      expect(screen.getByText('Manual')).toBeInTheDocument()
      expect(screen.getByText('5')).toBeInTheDocument()
      expect(screen.getByText('Weekly')).toBeInTheDocument()
      expect(screen.getByText('Alphabetical')).toBeInTheDocument()
    })
  })

  it('renders missing partial fields as EM dashes', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ stokvel: mockStokvelPartial }),
    })
    renderWithProviders(<AdminReviewStokvel />, { session: { access_token: 'fake-token' } })
    
    await waitFor(() => {
      // 6 dash fallbacks (name, status, contribution, type, payout_strat, cycle)
      const dashes = screen.getAllByText('—')
      expect(dashes.length).toBeGreaterThanOrEqual(6)
      // Optional fields like frequency and order should not even mount
      expect(screen.queryByText(/Meeting frequency/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/Payout order/i)).not.toBeInTheDocument()
    })
  })

  it('handles approve action successfully and navigates', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ stokvel: mockStokvelFull }),
    })
    renderWithProviders(<AdminReviewStokvel />, { session: { access_token: 'fake-token' } })
    
    const approveBtn = await screen.findByRole('button', { name: 'Approve' })
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ success: true }),
    })

    fireEvent.click(approveBtn)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(mockFetch).toHaveBeenLastCalledWith('http://localhost/api/admin/stokvels/123', expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ status: 'active' })
      }))
      expect(mockNavigate).toHaveBeenCalledWith('/admin/groups', { replace: true })
    })
  })

  it('handles approve error gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ stokvel: mockStokvelFull }),
    })
    renderWithProviders(<AdminReviewStokvel />, { session: { access_token: 'fake-token' } })
    
    const approveBtn = await screen.findByRole('button', { name: 'Approve' })
    
    mockFetch.mockResolvedValueOnce({
      ok: false,
      text: async () => JSON.stringify({ error: 'Approve failure' }),
    })

    fireEvent.click(approveBtn)

    expect(await screen.findByText('Approve failure')).toBeInTheDocument()
  })

  it('handles reject action successfully and navigates', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ stokvel: mockStokvelFull }),
    })
    renderWithProviders(<AdminReviewStokvel />, { session: { access_token: 'fake-token' } })
    
    const rejectBtn = await screen.findByRole('button', { name: 'Reject' })
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ success: true }),
    })

    fireEvent.click(rejectBtn)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(mockFetch).toHaveBeenLastCalledWith('http://localhost/api/admin/stokvels/123', expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ status: 'rejected' })
      }))
      expect(mockNavigate).toHaveBeenCalledWith('/admin/groups', { replace: true })
    })
  })

  it('handles reject error gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ stokvel: mockStokvelFull }),
    })
    renderWithProviders(<AdminReviewStokvel />, { session: { access_token: 'fake-token' } })
    
    const rejectBtn = await screen.findByRole('button', { name: 'Reject' })
    
    mockFetch.mockRejectedValueOnce(new Error('Reject network fail'))

    fireEvent.click(rejectBtn)

    expect(await screen.findByText('Reject network fail')).toBeInTheDocument()
  })

  it('aborts actions if session disappears', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ stokvel: mockStokvelFull }),
    })
    
    const { rerender } = renderWithProviders(<AdminReviewStokvel />, { session: { access_token: 'fake-token' } })
    const rejectBtn = await screen.findByRole('button', { name: 'Reject' })
    
    // Simulate session loss
    render(
      <MemoryRouter>
        <SessionContext.Provider value={{ session: null, userRole: 'admin' }}>
          <AdminReviewStokvel />
        </SessionContext.Provider>
      </MemoryRouter>,
      { container: document.body.firstChild }
    )

    fireEvent.click(rejectBtn)

    expect(mockFetch).toHaveBeenCalledTimes(1) // Only initial load
  })
})
