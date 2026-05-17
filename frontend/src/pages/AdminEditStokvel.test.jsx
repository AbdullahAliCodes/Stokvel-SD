import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

function futureDatetimeLocal() {
  const d = new Date(Date.now() + 7 * 24 * 3600 * 1000)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function pastDatetimeLocal() {
  const d = new Date(Date.now() - 3600 * 1000)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import AdminEditStokvel from './AdminEditStokvel'
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

const confirmMock = vi.fn().mockResolvedValue(true)

vi.mock('../context/ModalContext', () => ({
  useConfirm: () => confirmMock,
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

describe('AdminEditStokvel', () => {
  const mockFetch = vi.fn()
  global.fetch = mockFetch
  
  beforeEach(() => {
    vi.clearAllMocks()
    confirmMock.mockReset()
    confirmMock.mockResolvedValue(true)
  })

  const mockLoadSuccess = () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({
        stokvel: {
          name: 'My Stokvel',
          type: 'Rotating',
          status: 'active',
          contribution_amount: 500,
          cycle_length: 6,
        }
      })
    }).mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({
        meetings: [
          { id: 1, title: 'Kickoff', meeting_date: '2026-01-01T10:00:00Z', meeting_link: 'http://meet.com/1', agenda: 'Discuss', minutes: 'All good' }
        ]
      })
    })
  }

  describe('Loading State', () => {
    it('does not fetch if session or id is missing', () => {
      renderWithProviders(<AdminEditStokvel />, { session: { user: { id: 1 } } }) // missing access_token
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('shows loading state while fetching', () => {
      mockFetch.mockImplementation(() => new Promise(() => {}))
      renderWithProviders(<AdminEditStokvel />, { session: { access_token: 'fake-token' } })
      expect(screen.getByText('Loading…')).toBeInTheDocument()
    })

    it('populates form with stokvel and meetings data on success', async () => {
      mockLoadSuccess()
      renderWithProviders(<AdminEditStokvel />, { session: { access_token: 'fake-token' } })

      await waitFor(() => {
        expect(screen.getByLabelText(/Group name/i)).toHaveValue('My Stokvel')
        expect(screen.getByLabelText(/Contribution \(ZAR\)/i)).toHaveValue(500)
        expect(screen.getByLabelText(/Cycle length/i)).toHaveValue(6)
        expect(screen.getByText('Kickoff')).toBeInTheDocument()
        expect(screen.getByText(/All good/)).toBeInTheDocument() // minutes placeholder/value
      })
    })

    it('handles stokvel load error (JSON)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => JSON.stringify({ error: 'Not found' })
      }).mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ meetings: [] })
      })
      renderWithProviders(<AdminEditStokvel />, { session: { access_token: 'fake-token' } })
      expect(await screen.findByText('Not found')).toBeInTheDocument()
    })

    it('handles meetings load error (Text)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ stokvel: {} })
      }).mockResolvedValueOnce({
        ok: false,
        text: async () => 'Failed to load meetings'
      })
      renderWithProviders(<AdminEditStokvel />, { session: { access_token: 'fake-token' } })
      expect(await screen.findByText('Failed to load meetings')).toBeInTheDocument()
    })

    it('handles load network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))
      renderWithProviders(<AdminEditStokvel />, { session: { access_token: 'fake-token' } })
      expect(await screen.findByText('Network error')).toBeInTheDocument()
    })
  })

  describe('Update Stokvel', () => {
    it('cancels save if confirmed is false', async () => {
      mockLoadSuccess()
      renderWithProviders(<AdminEditStokvel />, { session: { access_token: 'fake-token' } })
      const btn = await screen.findByRole('button', { name: 'Save changes' })
      
      confirmMock.mockResolvedValueOnce(false)
      fireEvent.click(btn)

      expect(mockFetch).toHaveBeenCalledTimes(2) // only the initial loads
    })

    it('saves successfully and navigates', async () => {
      mockLoadSuccess()
      renderWithProviders(<AdminEditStokvel />, { session: { access_token: 'fake-token' } })
      const btn = await screen.findByRole('button', { name: 'Save changes' })
      
      fireEvent.change(screen.getByLabelText(/Group name/i), { target: { value: 'New Stokvel' } })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ success: true })
      })

      fireEvent.click(btn)
      
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(3)
        expect(mockFetch).toHaveBeenLastCalledWith('http://localhost/api/admin/stokvels/123', expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({
            name: 'New Stokvel',
            type: 'Rotating',
            status: 'active',
            contributionAmount: 500,
            cycleLength: 6,
          })
        }))
        expect(mockNavigate).toHaveBeenCalledWith('/admin/groups')
      })
    })

    it('handles save error', async () => {
      mockLoadSuccess()
      renderWithProviders(<AdminEditStokvel />, { session: { access_token: 'fake-token' } })
      const btn = await screen.findByRole('button', { name: 'Save changes' })
      
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => JSON.stringify({ error: 'Invalid config' })
      })

      fireEvent.click(btn)
      expect(await screen.findByText('Invalid config')).toBeInTheDocument()
    })
  })

  describe('Delete Stokvel', () => {
    it('cancels delete if confirmed is false', async () => {
      mockLoadSuccess()
      renderWithProviders(<AdminEditStokvel />, { session: { access_token: 'fake-token' } })
      const btn = await screen.findByRole('button', { name: 'Delete stokvel' })
      
      confirmMock.mockResolvedValueOnce(false)
      fireEvent.click(btn)

      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('deletes successfully and navigates', async () => {
      mockLoadSuccess()
      renderWithProviders(<AdminEditStokvel />, { session: { access_token: 'fake-token' } })
      const btn = await screen.findByRole('button', { name: 'Delete stokvel' })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ success: true })
      })

      fireEvent.click(btn)
      
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(3)
        expect(mockFetch).toHaveBeenLastCalledWith('http://localhost/api/admin/stokvels/123', expect.objectContaining({
          method: 'DELETE'
        }))
        expect(mockNavigate).toHaveBeenCalledWith('/admin/groups')
      })
    })

    it('handles delete error', async () => {
      mockLoadSuccess()
      renderWithProviders(<AdminEditStokvel />, { session: { access_token: 'fake-token' } })
      const btn = await screen.findByRole('button', { name: 'Delete stokvel' })
      
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => 'Cannot delete active stokvel'
      })

      fireEvent.click(btn)
      expect(await screen.findByText('Cannot delete active stokvel')).toBeInTheDocument()
    })
  })

  describe('Add Member', () => {
    it('cancels add if confirmed is false', async () => {
      mockLoadSuccess()
      renderWithProviders(<AdminEditStokvel />, { session: { access_token: 'fake-token' } })
      const input = await screen.findByPlaceholderText('e.g. sipho_k')
      const btn = screen.getByRole('button', { name: 'Add member' })
      
      fireEvent.change(input, { target: { value: 'sipho' } })
      confirmMock.mockResolvedValueOnce(false)
      fireEvent.click(btn)

      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('adds member successfully', async () => {
      mockLoadSuccess()
      renderWithProviders(<AdminEditStokvel />, { session: { access_token: 'fake-token' } })
      const input = await screen.findByPlaceholderText('e.g. sipho_k')
      const btn = screen.getByRole('button', { name: 'Add member' })
      
      fireEvent.change(input, { target: { value: 'sipho' } })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ success: true })
      })

      fireEvent.click(btn)
      
      expect(await screen.findByText('Member added: sipho')).toBeInTheDocument()
      expect(input).toHaveValue('')
    })

    it('handles add member error', async () => {
      mockLoadSuccess()
      renderWithProviders(<AdminEditStokvel />, { session: { access_token: 'fake-token' } })
      const input = await screen.findByPlaceholderText('e.g. sipho_k')
      const btn = screen.getByRole('button', { name: 'Add member' })
      
      fireEvent.change(input, { target: { value: 'sipho' } })

      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => JSON.stringify({ error: 'User not found' })
      })

      fireEvent.click(btn)
      expect(await screen.findByText('User not found')).toBeInTheDocument()
    })
  })

  describe('Meetings', () => {
    it('cancels schedule if confirmed is false', async () => {
      mockLoadSuccess()
      renderWithProviders(<AdminEditStokvel />, { session: { access_token: 'fake-token' } })
      const btn = await screen.findByRole('button', { name: 'Schedule meeting' })
      
      fireEvent.change(screen.getByLabelText(/Meeting title/i), { target: { value: 'Test Meet' } })
      fireEvent.change(screen.getByLabelText(/Date & time/i), { target: { value: futureDatetimeLocal() } })
      
      confirmMock.mockResolvedValueOnce(false)
      fireEvent.click(btn)

      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('schedules meeting successfully and updates list', async () => {
      mockLoadSuccess()
      renderWithProviders(<AdminEditStokvel />, { session: { access_token: 'fake-token' } })
      const btn = await screen.findByRole('button', { name: 'Schedule meeting' })
      
      fireEvent.change(screen.getByLabelText(/Meeting title/i), { target: { value: 'Test Meet' } })
      fireEvent.change(screen.getByLabelText(/Date & time/i), { target: { value: futureDatetimeLocal() } })
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({
          meeting: { id: 2, title: 'Test Meet', meeting_date: '2026-02-01T10:00:00Z', minutes: '' }
        })
      })

      fireEvent.click(btn)
      
      expect(await screen.findByText('Meeting scheduled and notifications sent.')).toBeInTheDocument()
      expect(screen.getByText('Test Meet')).toBeInTheDocument()
    })

    it('handles schedule meeting error', async () => {
      mockLoadSuccess()
      renderWithProviders(<AdminEditStokvel />, { session: { access_token: 'fake-token' } })
      const btn = await screen.findByRole('button', { name: 'Schedule meeting' })
      
      fireEvent.change(screen.getByLabelText(/Meeting title/i), { target: { value: 'Test Meet' } })
      fireEvent.change(screen.getByLabelText(/Date & time/i), { target: { value: futureDatetimeLocal() } })
      
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => 'Bad Request'
      })

      fireEvent.click(btn)
      expect(await screen.findByText('Bad Request')).toBeInTheDocument()
    })

    it('does not schedule when datetime is in the past locally', async () => {
      mockLoadSuccess()
      renderWithProviders(<AdminEditStokvel />, { session: { access_token: 'fake-token' } })
      const btn = await screen.findByRole('button', { name: 'Schedule meeting' })

      fireEvent.change(screen.getByLabelText(/Meeting title/i), { target: { value: 'Test Meet' } })
      fireEvent.change(screen.getByLabelText(/Date & time/i), {
        target: { value: pastDatetimeLocal() },
      })
      fireEvent.click(btn)

      expect(confirmMock).not.toHaveBeenCalled()
      expect(await screen.findByRole('alert')).toHaveTextContent(/already passed/i)
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('cancels saving minutes if confirmed is false', async () => {
      mockLoadSuccess()
      renderWithProviders(<AdminEditStokvel />, { session: { access_token: 'fake-token' } })
      const btn = await screen.findByRole('button', { name: 'Save minutes' })
      
      confirmMock.mockResolvedValueOnce(false)
      fireEvent.click(btn)

      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('saves minutes successfully', async () => {
      mockLoadSuccess()
      renderWithProviders(<AdminEditStokvel />, { session: { access_token: 'fake-token' } })
      const btn = await screen.findByRole('button', { name: 'Save minutes' })
      
      fireEvent.change(screen.getByPlaceholderText(/Record minutes/i), { target: { value: 'Updated minutes' } })
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({
          meeting: { id: 1, title: 'Kickoff', meeting_date: '2026-01-01T10:00:00Z', minutes: 'Updated minutes' }
        })
      })

      fireEvent.click(btn)
      expect(await screen.findByText('Minutes saved.')).toBeInTheDocument()
    })

    it('handles save minutes error', async () => {
      mockLoadSuccess()
      renderWithProviders(<AdminEditStokvel />, { session: { access_token: 'fake-token' } })
      const btn = await screen.findByRole('button', { name: 'Save minutes' })
      
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => 'Minutes error'
      })

      fireEvent.click(btn)
      expect(await screen.findByText('Minutes error')).toBeInTheDocument()
    })

    it('cancels delete meeting if confirmed is false', async () => {
      mockLoadSuccess()
      renderWithProviders(<AdminEditStokvel />, { session: { access_token: 'fake-token' } })
      const btn = await screen.findByRole('button', { name: 'Delete meeting' })
      
      confirmMock.mockResolvedValueOnce(false)
      fireEvent.click(btn)

      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('deletes meeting successfully', async () => {
      mockLoadSuccess()
      renderWithProviders(<AdminEditStokvel />, { session: { access_token: 'fake-token' } })
      const btn = await screen.findByRole('button', { name: 'Delete meeting' })
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ success: true })
      })

      fireEvent.click(btn)
      expect(await screen.findByText('Meeting deleted.')).toBeInTheDocument()
      expect(screen.queryByText('Kickoff')).not.toBeInTheDocument()
    })

    it('handles delete meeting error', async () => {
      mockLoadSuccess()
      renderWithProviders(<AdminEditStokvel />, { session: { access_token: 'fake-token' } })
      const btn = await screen.findByRole('button', { name: 'Delete meeting' })
      
      mockFetch.mockRejectedValueOnce(new Error('Delete meet err'))

      fireEvent.click(btn)
      expect(await screen.findByText('Delete meet err')).toBeInTheDocument()
    })
  })
})
