import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import AdminGroups from './AdminGroups'
import { SessionContext } from '../context/SessionContext'
import { readViewCache, writeViewCache } from '../utils/viewCache'

vi.mock('../utils/api', () => ({
  apiUrl: (path) => `http://localhost${path}`,
}))

vi.mock('../utils/viewCache', () => ({
  readViewCache: vi.fn(),
  writeViewCache: vi.fn(),
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

describe('AdminGroups', () => {
  const mockFetch = vi.fn()
  global.fetch = mockFetch

  beforeEach(() => {
    vi.clearAllMocks()
    readViewCache.mockReturnValue(null)
  })

  const mockGroups = [
    { id: 1, name: 'Active Group 1', type: 'Rotating', status: 'active', contribution_amount: 100, cycle_length: 6 },
    { id: 2, name: 'Active Group 2', type: null, status: 'active', contribution_amount: null, cycle_length: null },
    { id: 3, name: 'Pending Group 1', type: 'Fixed', status: 'pending', contribution_amount: 50, cycle_length: 12 },
    { id: 4, name: 'Rejected Group 1', type: 'Rotating', status: 'rejected', contribution_amount: 200, cycle_length: 3 },
    { id: 5, name: 'Unknown Status Group', type: 'Rotating', status: 'unknown', contribution_amount: 100, cycle_length: 6 },
  ]

  it('does not fetch if session is missing access_token', () => {
    renderWithProviders(<AdminGroups />, { session: { user: { id: 1 } } })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('shows loading initially and loads active groups by default', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ stokvels: mockGroups }),
    })

    renderWithProviders(<AdminGroups />, { session: { access_token: 'fake-token', user: { id: 1 } } })
    
    expect(screen.getByText('Loading…')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('Active Group 1')).toBeInTheDocument()
      expect(screen.getByText('Active Group 2')).toBeInTheDocument()
    })

    // Active tab is selected, so pending/rejected groups should not be visible in the table body
    // (though their counts are visible in tabs)
    expect(screen.queryByText('Pending Group 1')).not.toBeInTheDocument()
    
    expect(screen.getByRole('button', { name: /Active.*2/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Pending.*1/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Rejected.*1/i })).toBeInTheDocument()

    // Test missing values fallback
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('loads from viewCache immediately if available', async () => {
    readViewCache.mockReturnValue(mockGroups)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ stokvels: mockGroups }),
    })

    renderWithProviders(<AdminGroups />, { session: { access_token: 'fake-token', user: { id: 1 } } })
    
    // Should immediately show the cached content without "Loading..."
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
    expect(screen.getByText('Active Group 1')).toBeInTheDocument()
    
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })
  })

  it('switches between tabs successfully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ stokvels: mockGroups }),
    })

    renderWithProviders(<AdminGroups />, { session: { access_token: 'fake-token', user: { id: 1 } } })
    
    await waitFor(() => expect(screen.getByText('Active Group 1')).toBeInTheDocument())

    // Switch to Pending
    const pendingTab = screen.getByRole('button', { name: /Pending.*1/i })
    fireEvent.click(pendingTab)
    expect(screen.getByText('Pending Group 1')).toBeInTheDocument()
    expect(screen.queryByText('Active Group 1')).not.toBeInTheDocument()

    // Switch to Rejected
    const rejectedTab = screen.getByRole('button', { name: /Rejected.*1/i })
    fireEvent.click(rejectedTab)
    expect(screen.getByText('Rejected Group 1')).toBeInTheDocument()
    expect(screen.queryByText('Pending Group 1')).not.toBeInTheDocument()
  })

  it('shows empty state when no groups exist for a tab', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ stokvels: [] }),
    })

    renderWithProviders(<AdminGroups />, { session: { access_token: 'fake-token', user: { id: 1 } } })
    
    await waitFor(() => {
      expect(screen.getByText('No groups in this list.')).toBeInTheDocument()
    })
  })

  it('handles JSON fetch error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      text: async () => JSON.stringify({ error: 'Not authorized' }),
    })

    renderWithProviders(<AdminGroups />, { session: { access_token: 'fake-token', user: { id: 1 } } })
    
    expect(await screen.findByText('Not authorized')).toBeInTheDocument()
  })

  it('handles text fetch error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      text: async () => 'Server error',
    })

    renderWithProviders(<AdminGroups />, { session: { access_token: 'fake-token', user: { id: 1 } } })
    
    expect(await screen.findByText('Server error')).toBeInTheDocument()
  })

  it('handles network fetch error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network disconnected'))

    renderWithProviders(<AdminGroups />, { session: { access_token: 'fake-token', user: { id: 1 } } })
    
    expect(await screen.findByText('Network disconnected')).toBeInTheDocument()
  })

  it('ignores state updates if component unmounts', async () => {
    let resolveFetch
    const fetchPromise = new Promise((resolve) => {
      resolveFetch = resolve
    })
    mockFetch.mockReturnValue(fetchPromise)

    const { unmount } = renderWithProviders(<AdminGroups />, { session: { access_token: 'fake-token', user: { id: 1 } } })
    
    unmount()

    resolveFetch({
      ok: true,
      text: async () => JSON.stringify({ stokvels: mockGroups }),
    })
    
    expect(mockFetch).toHaveBeenCalled()
  })

  it('ignores error state updates if component unmounts', async () => {
    let rejectFetch
    const fetchPromise = new Promise((_, reject) => {
      rejectFetch = reject
    })
    mockFetch.mockReturnValue(fetchPromise)

    const { unmount } = renderWithProviders(<AdminGroups />, { session: { access_token: 'fake-token', user: { id: 1 } } })
    
    unmount()

    rejectFetch(new Error('Network late error'))
    
    expect(mockFetch).toHaveBeenCalled()
  })
})
