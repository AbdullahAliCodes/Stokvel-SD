import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import AcceptInvitation from './AcceptInvitation'
import { SessionContext } from '../context/SessionContext'

vi.mock('../utils/api', () => ({
  apiUrl: (path) => `http://localhost${path}`,
}))

const renderWithProviders = (ui, { initialEntries = ['/accept-invitation'], session = null } = {}) => {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <SessionContext.Provider value={{ session, userRole: 'user' }}>
        <Routes>
          <Route path="/accept-invitation" element={ui} />
        </Routes>
      </SessionContext.Provider>
    </MemoryRouter>
  )
}

describe('AcceptInvitation', () => {
  const mockFetch = vi.fn()
  global.fetch = mockFetch

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows missing invitation token error when token is absent', async () => {
    renderWithProviders(<AcceptInvitation />, { initialEntries: ['/accept-invitation'] })
    
    expect(await screen.findByText(/Missing invitation token\./i)).toBeInTheDocument()
  })

  it('shows checking invitation loading state', async () => {
    // Keep fetch unresolved
    mockFetch.mockImplementation(() => new Promise(() => {}))
    
    renderWithProviders(<AcceptInvitation />, { initialEntries: ['/accept-invitation?token=abc'] })
    
    expect(screen.getByText(/Checking invitation…/i)).toBeInTheDocument()
  })

  it('handles GET API error with JSON response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      text: async () => JSON.stringify({ error: 'Invalid token' }),
    })

    renderWithProviders(<AcceptInvitation />, { initialEntries: ['/accept-invitation?token=abc'] })
    
    expect(await screen.findByText('Invalid token')).toBeInTheDocument()
  })

  it('handles GET API error with plain text response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      text: async () => 'Server error',
    })

    renderWithProviders(<AcceptInvitation />, { initialEntries: ['/accept-invitation?token=abc'] })
    
    expect(await screen.findByText('Server error')).toBeInTheDocument()
  })

  it('handles GET API error with unparseable text response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      text: async () => '<html/>',
    })

    renderWithProviders(<AcceptInvitation />, { initialEntries: ['/accept-invitation?token=abc'] })
    
    expect(await screen.findByText('<html/>')).toBeInTheDocument()
  })

  it('handles GET API network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network failure'))

    renderWithProviders(<AcceptInvitation />, { initialEntries: ['/accept-invitation?token=abc'] })
    
    expect(await screen.findByText('Network failure')).toBeInTheDocument()
  })

  it('renders invitation details successfully but prompts sign in if no session', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({
        invitation: { email: 'test@example.com', stokvel: { name: 'My Stokvel' } }
      }),
    })

    renderWithProviders(<AcceptInvitation />, { initialEntries: ['/accept-invitation?token=abc'], session: null })
    
    expect(await screen.findByText('test@example.com')).toBeInTheDocument()
    expect(screen.getByText('My Stokvel')).toBeInTheDocument()
    expect(screen.getByText(/Please sign in first, then return to this link\./i)).toBeInTheDocument()
  })

  it('renders invitation details and accept button if session exists', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({
        invitation: { email: 'test@example.com', stokvel: null } // testing fallback stokvel name
      }),
    })

    renderWithProviders(<AcceptInvitation />, { 
      initialEntries: ['/accept-invitation?token=abc'], 
      session: { access_token: 'fake-token' } 
    })
    
    expect(await screen.findByText('test@example.com')).toBeInTheDocument()
    expect(screen.getByText('this stokvel')).toBeInTheDocument()
    
    const btn = screen.getByRole('button', { name: /Accept invitation/i })
    expect(btn).toBeInTheDocument()
    expect(btn).not.toBeDisabled()
  })

  it('accepts invitation successfully', async () => {
    // 1st fetch: get invitation
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({
        invitation: { email: 'test@example.com', stokvel: { name: 'My Stokvel' } }
      }),
    })

    renderWithProviders(<AcceptInvitation />, { 
      initialEntries: ['/accept-invitation?token=abc'], 
      session: { access_token: 'fake-token' } 
    })
    
    const btn = await screen.findByRole('button', { name: /Accept invitation/i })
    
    // 2nd fetch: accept invitation
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ success: true }),
    })

    fireEvent.click(btn)
    
    expect(btn).toHaveTextContent('Accepting…')
    expect(btn).toBeDisabled()

    expect(await screen.findByText(/Invitation accepted\. The group now appears in your dashboard\./i)).toBeInTheDocument()
    
    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(mockFetch).toHaveBeenLastCalledWith('http://localhost/api/invitations/accept', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer fake-token',
      },
      body: JSON.stringify({ token: 'abc' }),
    })
  })

  it('handles accept invitation JSON error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({
        invitation: { email: 'test@example.com', stokvel: { name: 'My Stokvel' } }
      }),
    })

    renderWithProviders(<AcceptInvitation />, { 
      initialEntries: ['/accept-invitation?token=abc'], 
      session: { access_token: 'fake-token' } 
    })
    
    const btn = await screen.findByRole('button', { name: /Accept invitation/i })
    
    mockFetch.mockResolvedValueOnce({
      ok: false,
      text: async () => JSON.stringify({ error: 'Cannot accept twice' }),
    })

    fireEvent.click(btn)

    expect(await screen.findByText('Cannot accept twice')).toBeInTheDocument()
  })

  it('handles accept invitation network error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({
        invitation: { email: 'test@example.com', stokvel: { name: 'My Stokvel' } }
      }),
    })

    renderWithProviders(<AcceptInvitation />, { 
      initialEntries: ['/accept-invitation?token=abc'], 
      session: { access_token: 'fake-token' } 
    })
    
    const btn = await screen.findByRole('button', { name: /Accept invitation/i })
    
    mockFetch.mockRejectedValueOnce(new Error('Post Network Error'))

    fireEvent.click(btn)

    expect(await screen.findByText('Post Network Error')).toBeInTheDocument()
  })

  it('does not accept if session is missing access_token', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({
        invitation: { email: 'test@example.com', stokvel: { name: 'My Stokvel' } }
      }),
    })

    renderWithProviders(<AcceptInvitation />, { 
      initialEntries: ['/accept-invitation?token=abc'], 
      session: { user: { id: 1 } } // missing access_token
    })
    
    const btn = await screen.findByRole('button', { name: /Accept invitation/i })
    
    fireEvent.click(btn)
    
    // Fetch should not be called again (only called once for load)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })
})
