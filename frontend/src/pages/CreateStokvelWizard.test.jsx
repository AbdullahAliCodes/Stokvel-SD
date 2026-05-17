import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { CreateStokvelWizard } from './CreateStokvelWizard'
import { SessionContext } from '../context/SessionContext'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('../utils/api', () => ({
  apiUrl: (path) => `http://localhost${path}`,
}))

vi.mock('../context/ModalContext', () => ({
  useConfirm: () => vi.fn().mockResolvedValue(true),
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

describe('CreateStokvelWizard', { timeout: 15000 }, () => {
  const mockFetch = vi.fn()
  global.fetch = mockFetch
  global.confirm = vi.fn()

  const defaultSessionAdmin = {
    access_token: 'fake-token',
    user: { id: 'admin-uuid', email: 'admin@test.com' },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    global.confirm.mockReturnValue(true)
  })

  // Always restore real timers after each test so they don't bleed
  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  describe('Basic Rendering and Tabs', () => {
    it('renders details tab initially', () => {
      renderWithProviders(<CreateStokvelWizard variant="admin" />, { session: defaultSessionAdmin })
      expect(screen.getByText('Admin stokvel creation')).toBeInTheDocument()
      expect(screen.getByLabelText(/Group name/i)).toBeInTheDocument()
    })

    it('navigates through tabs', async () => {
      renderWithProviders(<CreateStokvelWizard variant="admin" />, { session: defaultSessionAdmin })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Next/i }))
      })
      expect(screen.getByText(/Search registered users/i)).toBeInTheDocument()

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Previous/i }))
      })
      expect(screen.getByLabelText(/Group name/i)).toBeInTheDocument()
    })
  })

  describe('Details Validation', () => {
    it('shows error if submitting empty group name', async () => {
      renderWithProviders(<CreateStokvelWizard variant="admin" />, { session: defaultSessionAdmin })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Next/i }))
      })
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Next/i }))
      })
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Create stokvel/i }))
      })

      expect(await screen.findByText(/Group name is required/i)).toBeInTheDocument()
    })

    it('shows error if contribution amount is invalid', async () => {
      renderWithProviders(<CreateStokvelWizard variant="admin" />, { session: defaultSessionAdmin })

      await act(async () => {
        fireEvent.change(screen.getByLabelText(/Group name/i), { target: { value: 'My Stokvel' } })
        fireEvent.change(screen.getByLabelText(/Contribution amount/i), { target: { value: '-5' } })
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Next/i }))
      })
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Next/i }))
      })
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Create stokvel/i }))
      })

      expect(await screen.findByText(/Enter a valid contribution amount/i)).toBeInTheDocument()
    })
  })

  describe('Member Management (Admin Variant)', () => {
    it('searches for members successfully', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            users: [{ id: 'user-2-uuid', username: 'johndoe', firstName: 'John', email: 'john@test.com' }],
          }),
      })

      renderWithProviders(<CreateStokvelWizard variant="admin" />, { session: defaultSessionAdmin })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Next/i }))
      })

      const searchInput = screen.getByPlaceholderText(/Search by name/i)

      await act(async () => {
        fireEvent.change(searchInput, { target: { value: 'john' } })
        fireEvent.focus(searchInput)
      })

      // Advance past the debounce and flush all pending promises
      await act(async () => {
        vi.advanceTimersByTime(400)
      })

      await waitFor(() => {
        expect(screen.getByText('@johndoe')).toBeInTheDocument()
      })
    })

    it('adds pending member by email', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ users: [] }),
      })

      renderWithProviders(<CreateStokvelWizard variant="admin" />, { session: defaultSessionAdmin })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Next/i }))
      })

      const searchInput = screen.getByPlaceholderText(/Search by name/i)

      await act(async () => {
        fireEvent.change(searchInput, { target: { value: 'newuser@example.com' } })
        fireEvent.focus(searchInput)
      })

      // Advance past the debounce and flush pending promises
      await act(async () => {
        vi.advanceTimersByTime(400)
      })

      const addBtn = await screen.findByRole('button', { name: /Add new member/i })

      await waitFor(() => {
        expect(addBtn).not.toBeDisabled()
      })

      await act(async () => {
        fireEvent.click(addBtn)
      })

      // The email appears in both the search dropdown and the members table
      // so we scope the assertion to the members table specifically
      await waitFor(() => {
        const allMatches = screen.getAllByText(/newuser@example.com/i)
        expect(allMatches.length).toBeGreaterThan(0)
        // At least one match should be in the members table (has truncate class)
        const inTable = allMatches.find((el) => el.closest('table') || el.classList.contains('truncate'))
        expect(inTable).toBeTruthy()
      })
    })

    it('removes member', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ users: [] }),
      })

      renderWithProviders(<CreateStokvelWizard variant="admin" />, { session: defaultSessionAdmin })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Next/i }))
      })

      const searchInput = screen.getByPlaceholderText(/Search by name/i)

      await act(async () => {
        fireEvent.change(searchInput, { target: { value: 'removeme@example.com' } })
      })

      await act(async () => {
        vi.advanceTimersByTime(400)
      })

      const addBtn = await screen.findByRole('button', { name: /Add new member/i })

      await waitFor(() => expect(addBtn).not.toBeDisabled())

      await act(async () => {
        fireEvent.click(addBtn)
      })

      // Email appears in multiple places - verify at least one exists in the table before removing
      await waitFor(() => {
        const allMatches = screen.getAllByText(/removeme@example.com/i)
        const inTable = allMatches.find(
          (el) => el.closest('table') || el.classList.contains('truncate'),
        )
        expect(inTable).toBeTruthy()
      })

      // There are two Remove buttons (desktop table + mobile card) - click the first
      await act(async () => {
        fireEvent.click(screen.getAllByRole('button', { name: /Remove member/i })[0])
      })

      // After removal the email should be gone from the members table
      await waitFor(() => {
        const remaining = screen.queryAllByText(/removeme@example.com/i)
        const inTable = remaining.filter(
          (el) => el.closest('table') || el.classList.contains('truncate'),
        )
        expect(inTable).toHaveLength(0)
      })
    })
  })

  describe('Document Uploads', () => {
    it('rejects non-PDF files', async () => {
      renderWithProviders(<CreateStokvelWizard variant="admin" />, { session: defaultSessionAdmin })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Next/i }))
      })
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Next/i }))
      })

      const fileInput = document.querySelector('input[type="file"]')
      const file = new File(['hello'], 'hello.png', { type: 'image/png' })

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } })
      })

      expect(await screen.findByText(/Only PDF files are allowed/i)).toBeInTheDocument()
    })

    it('accepts valid PDF', async () => {
      renderWithProviders(<CreateStokvelWizard variant="admin" />, { session: defaultSessionAdmin })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Next/i }))
      })
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Next/i }))
      })

      const fileInput = document.querySelector('input[type="file"]')
      const file = new File(['dummy'], 'test.pdf', { type: 'application/pdf' })

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } })
      })

      expect(await screen.findByText('test.pdf')).toBeInTheDocument()
    })
  })

  describe('Submission', () => {
    it('submits form successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({ stokvel: { id: 'stokvel-123', name: 'My Group' } }),
      })

      renderWithProviders(<CreateStokvelWizard variant="admin" />, { session: defaultSessionAdmin })

      await act(async () => {
        fireEvent.change(screen.getByLabelText(/Group name/i), { target: { value: 'My Group' } })
        fireEvent.change(screen.getByLabelText(/Contribution amount/i), { target: { value: '100' } })
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Next/i }))
      })
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Next/i }))
      })
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Create stokvel/i }))
      })

      expect(await screen.findByText(/My Group is live/i)).toBeInTheDocument()
    })
  })
})
