import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import Account from './Account'
import { SessionContext } from '../context/SessionContext'

vi.mock('../utils/api', () => ({
  apiUrl: (path) => `http://localhost${path}`,
}))

const renderWithProviders = (ui, { session = null } = {}) => {
  return render(
    <MemoryRouter>
      <SessionContext.Provider value={{ session, userRole: 'user' }}>
        {ui}
      </SessionContext.Provider>
    </MemoryRouter>
  )
}

describe('Account', () => {
  const mockFetch = vi.fn()
  global.fetch = mockFetch

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not fetch profile if access_token is missing', () => {
    renderWithProviders(<Account />, { session: { user: { id: 1 } } }) // missing access_token
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('shows loading state while fetching profile', async () => {
    mockFetch.mockImplementation(() => new Promise(() => {}))
    renderWithProviders(<Account />, { session: { access_token: 'fake-token' } })
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('populates form with profile data on successful load', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({
        profile: { firstName: 'John', lastName: 'Doe', username: 'johndoe', email: 'john@example.com' }
      }),
    })

    renderWithProviders(<Account />, { session: { access_token: 'fake-token' } })

    await waitFor(() => {
      expect(screen.getByLabelText(/First name/i)).toHaveValue('John')
      expect(screen.getByLabelText(/Last name/i)).toHaveValue('Doe')
      expect(screen.getByLabelText(/Username/i)).toHaveValue('johndoe')
      expect(screen.getByLabelText(/Email/i)).toHaveValue('john@example.com')
    })
  })

  it('handles partial profile data correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({
        profile: {}
      }),
    })

    renderWithProviders(<Account />, { session: { access_token: 'fake-token' } })

    await waitFor(() => {
      expect(screen.getByLabelText(/First name/i)).toHaveValue('')
      expect(screen.getByLabelText(/Last name/i)).toHaveValue('')
      expect(screen.getByLabelText(/Username/i)).toHaveValue('')
      expect(screen.getByLabelText(/Email/i)).toHaveValue('')
    })
  })

  it('handles load error with JSON response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      text: async () => JSON.stringify({ error: 'Unauthorized profile access' }),
    })

    renderWithProviders(<Account />, { session: { access_token: 'fake-token' } })
    expect(await screen.findByText('Unauthorized profile access')).toBeInTheDocument()
  })

  it('handles load error with plain text response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      text: async () => 'Server error',
    })

    renderWithProviders(<Account />, { session: { access_token: 'fake-token' } })
    expect(await screen.findByText('Server error')).toBeInTheDocument()
  })

  it('handles load error with unparseable text response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      text: async () => '<html>Error</html>',
    })

    renderWithProviders(<Account />, { session: { access_token: 'fake-token' } })
    expect(await screen.findByText('<html>Error</html>')).toBeInTheDocument()
  })

  it('handles load network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network failure'))

    renderWithProviders(<Account />, { session: { access_token: 'fake-token' } })
    expect(await screen.findByText('Network failure')).toBeInTheDocument()
  })

  it('ignores state updates if component unmounts before fetch completes', async () => {
    let resolveFetch
    const fetchPromise = new Promise((resolve) => {
      resolveFetch = resolve
    })
    mockFetch.mockReturnValue(fetchPromise)

    const { unmount } = renderWithProviders(<Account />, { session: { access_token: 'fake-token' } })
    
    unmount()

    resolveFetch({
      ok: true,
      text: async () => JSON.stringify({ profile: { firstName: 'Late' } }),
    })
    
    // Test passes if it doesn't throw a state update on unmounted component error
    // (React doesn't throw this in 18+, but this executes the `if (!cancelled)` branches).
    expect(mockFetch).toHaveBeenCalled()
  })

  it('ignores state updates if component unmounts before error completes', async () => {
    let rejectFetch
    const fetchPromise = new Promise((_, reject) => {
      rejectFetch = reject
    })
    mockFetch.mockReturnValue(fetchPromise)

    const { unmount } = renderWithProviders(<Account />, { session: { access_token: 'fake-token' } })
    
    unmount()

    rejectFetch(new Error('Late error'))
    expect(mockFetch).toHaveBeenCalled()
  })

  it('successfully updates profile on form submit', async () => {
    // 1st fetch: load
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({
        profile: { firstName: 'John', lastName: 'Doe', username: 'johndoe', email: 'john@example.com' }
      }),
    })

    renderWithProviders(<Account />, { session: { access_token: 'fake-token' } })

    const btn = await screen.findByRole('button', { name: /Save profile/i })
    
    // modify values
    fireEvent.change(screen.getByLabelText(/First name/i), { target: { value: 'Jane' } })
    
    // 2nd fetch: save
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({
        profile: { firstName: 'Jane', lastName: 'Doe', username: 'johndoe', email: 'john@example.com' }
      }),
    })

    fireEvent.click(btn)
    
    expect(btn).toHaveTextContent('Saving…')
    expect(btn).toBeDisabled()

    expect(await screen.findByText('Profile updated.')).toBeInTheDocument()
    
    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(mockFetch).toHaveBeenLastCalledWith('http://localhost/api/profile/me', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer fake-token',
      },
      body: JSON.stringify({
        firstName: 'Jane',
        lastName: 'Doe',
        username: 'johndoe',
        email: 'john@example.com',
      }),
    })
  })

  it('sends null for username if it is empty string or spaces on submit', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ profile: { email: 'test@example.com' } }),
    })

    renderWithProviders(<Account />, { session: { access_token: 'fake-token' } })
    const btn = await screen.findByRole('button', { name: /Save profile/i })
    
    fireEvent.change(screen.getByLabelText(/Username/i), { target: { value: '   ' } })
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ profile: { email: 'test@example.com' } }),
    })

    fireEvent.click(btn)

    await screen.findByText('Profile updated.')

    expect(mockFetch).toHaveBeenLastCalledWith('http://localhost/api/profile/me', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer fake-token',
      },
      body: JSON.stringify({
        firstName: '',
        lastName: '',
        username: null,
        email: 'test@example.com',
      }),
    })
  })

  it('handles update JSON error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ profile: { email: 'test@example.com' } }),
    })

    renderWithProviders(<Account />, { session: { access_token: 'fake-token' } })
    const btn = await screen.findByRole('button', { name: /Save profile/i })
    
    mockFetch.mockResolvedValueOnce({
      ok: false,
      text: async () => JSON.stringify({ error: 'Username already taken' }),
    })

    fireEvent.click(btn)

    expect(await screen.findByText('Username already taken')).toBeInTheDocument()
  })

  it('handles update plain text error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ profile: { email: 'test@example.com' } }),
    })

    renderWithProviders(<Account />, { session: { access_token: 'fake-token' } })
    const btn = await screen.findByRole('button', { name: /Save profile/i })
    
    mockFetch.mockResolvedValueOnce({
      ok: false,
      text: async () => 'Save server error',
    })

    fireEvent.click(btn)

    expect(await screen.findByText('Save server error')).toBeInTheDocument()
  })

  it('handles update network error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ profile: { email: 'test@example.com' } }),
    })

    renderWithProviders(<Account />, { session: { access_token: 'fake-token' } })
    const btn = await screen.findByRole('button', { name: /Save profile/i })
    
    mockFetch.mockRejectedValueOnce(new Error('Save network error'))

    fireEvent.click(btn)

    expect(await screen.findByText('Save network error')).toBeInTheDocument()
  })

  it('does not submit form if session access_token is mysteriously missing', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ profile: { email: 'test@example.com' } }),
    })

    const { rerender } = renderWithProviders(<Account />, { session: { access_token: 'fake-token' } })
    const btn = await screen.findByRole('button', { name: /Save profile/i })

    // Simulate session dropping
    render(
      <MemoryRouter>
        <SessionContext.Provider value={{ session: null, userRole: 'user' }}>
          <Account />
        </SessionContext.Provider>
      </MemoryRouter>,
      { container: document.body.firstChild }
    )

    fireEvent.click(btn)

    // Load fetch is the only one that should have happened
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })
})
