import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react'
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

const confirmMock = vi.hoisted(() => vi.fn().mockResolvedValue(true))

vi.mock('../context/ModalContext', () => ({
  useConfirm: () => confirmMock,
}))

vi.mock('@hello-pangea/dnd', () => ({
  DragDropContext: ({ children, onDragEnd }) => (
    <div
      data-testid="mock-dnd-context"
      onClick={() =>
        onDragEnd?.({
          draggableId: 'mock-drag',
          source: { index: 0, droppableId: 'stokvel-payout-order' },
          destination: { index: 1, droppableId: 'stokvel-payout-order' },
        })
      }
    >
      {children}
    </div>
  ),
  Droppable: ({ children }) =>
    children(
      {
        innerRef: () => {},
        droppableProps: { 'data-rfd-droppable-id': 'stokvel-payout-order' },
        placeholder: null,
      },
      {},
    ),
  Draggable: ({ children, draggableId }) =>
    children(
      {
        innerRef: () => {},
        draggableProps: { 'data-rfd-draggable-id': draggableId },
        dragHandleProps: { 'data-testid': `drag-${draggableId}` },
      },
      { isDragging: false },
    ),
}))

const renderWithProviders = (ui, { session = null, userRole = 'admin' } = {}) => {
  return render(
    <MemoryRouter>
      <SessionContext.Provider value={{ session, userRole }}>
        {ui}
      </SessionContext.Provider>
    </MemoryRouter>
  )
}

/** Valid v4-style ids for registeredNonCreatorMembers / treasurer checks */
const MEMBER_CREATOR_ID = '11111111-1111-4111-8111-111111111111'
const TREASURER_USER_ID = '22222222-2222-4222-8222-222222222222'
const SECOND_MEMBER_ID = '33333333-3333-4333-8333-333333333333'

const treasurerUser = {
  id: TREASURER_USER_ID,
  username: 'treasurer1',
  firstName: 'Trea',
  lastName: 'Surer',
  email: 'treasurer@test.com',
}

const secondRegisteredUser = {
  id: SECOND_MEMBER_ID,
  username: 'member2',
  firstName: 'Second',
  lastName: 'User',
  email: 'second@test.com',
}

const userWithoutEmail = {
  id: '44444444-4444-4444-8444-444444444444',
  username: 'noemail',
  firstName: 'No',
  lastName: 'Email',
  email: '',
}

describe('CreateStokvelWizard', { timeout: 15000 }, () => {
  const mockFetch = vi.fn()

  async function advanceDebounceSearch() {
    await act(async () => {
      vi.advanceTimersByTime(400)
    })
  }

  async function searchAndSelectRegisteredUser(
    user,
    query = user.username,
    { setupSearchMock = true } = {},
  ) {
    if (setupSearchMock) {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ users: [user] }),
      })
    }

    const searchInput = screen.getByPlaceholderText(/Search by name/i)
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: query } })
      fireEvent.focus(searchInput)
    })
    await advanceDebounceSearch()

    const handle = `@${user.username}`
    await waitFor(() => expect(screen.getByText(handle)).toBeInTheDocument())
    const row = screen.getByText(handle).closest('button')
    await act(async () => {
      fireEvent.mouseDown(row)
    })
  }

  const defaultSessionAdmin = {
    access_token: 'fake-token',
    user: { id: 'admin-uuid', email: 'admin@test.com' },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockReset()
    vi.stubGlobal('fetch', mockFetch)
    vi.stubGlobal('confirm', vi.fn(() => true))
    confirmMock.mockResolvedValue(true)
  })

  // Always restore real timers after each test so they don't bleed
  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
    vi.unstubAllGlobals()
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

  describe('Fixed stokvel UI toggles', () => {
    it('hides payout order controls and shows maturity copy for Fixed type', async () => {
      renderWithProviders(<CreateStokvelWizard variant="admin" />, { session: defaultSessionAdmin })

      await act(async () => {
        fireEvent.change(screen.getByLabelText(/Type/i), { target: { value: 'Fixed' } })
        fireEvent.click(screen.getByRole('button', { name: /Next/i }))
      })

      expect(screen.getByText(/bulk payout at maturity/i)).toBeInTheDocument()
      expect(screen.queryByText(/^Payout order$/i)).not.toBeInTheDocument()
      expect(screen.queryByLabelText(/Randomize at activation/i)).not.toBeInTheDocument()
    })

    it('shows payout order controls for Rotating type', async () => {
      renderWithProviders(<CreateStokvelWizard variant="admin" />, { session: defaultSessionAdmin })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Next/i }))
      })

      expect(screen.getByText(/^Payout order$/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/Randomize at activation/i)).toBeInTheDocument()
    })
  })

  describe('Submit validation branches', () => {
    it('shows error when payment window days are invalid on submit', async () => {
      renderWithProviders(<CreateStokvelWizard variant="admin" />, { session: defaultSessionAdmin })

      await act(async () => {
        fireEvent.change(screen.getByLabelText(/Group name/i), { target: { value: 'Fixed Pool' } })
        fireEvent.change(screen.getByLabelText(/Contribution amount/i), { target: { value: '100' } })
        fireEvent.change(screen.getByLabelText(/Type/i), { target: { value: 'Fixed' } })
        fireEvent.change(screen.getByLabelText(/Payment window start day/i), {
          target: { value: '40' },
        })
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

      expect(
        await screen.findByText(/Payment window days must be whole numbers between 1 and 31/i),
      ).toBeInTheDocument()
      expect(confirmMock).not.toHaveBeenCalled()
    })
  })

  describe('Cancel and API failure paths', () => {
    it('does not call the API when useConfirm resolves false', async () => {
      confirmMock.mockResolvedValue(false)

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

      await waitFor(() => {
        expect(confirmMock).toHaveBeenCalled()
      })
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('surfaces API failure in the error box on submit', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => JSON.stringify({ error: 'Stokvel creation failed on server' }),
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

      expect(await screen.findByText(/Stokvel creation failed on server/i)).toBeInTheDocument()
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('Member variant', () => {
    const memberSession = {
      access_token: 'member-token',
      user: { id: MEMBER_CREATOR_ID, email: 'member@test.com' },
    }

    const renderMemberWizard = () =>
      renderWithProviders(<CreateStokvelWizard variant="member" />, {
        session: memberSession,
        userRole: 'member',
      })

    const goToMemberMembersTab = async () => {
      await act(async () => {
        fireEvent.change(screen.getByLabelText(/Group name/i), {
          target: { value: 'Member Group' },
        })
        fireEvent.change(screen.getByLabelText(/Contribution amount/i), {
          target: { value: '200' },
        })
        fireEvent.click(screen.getByRole('button', { name: /Next/i }))
      })
    }

    it('renders the member apply heading', () => {
      renderMemberWizard()
      expect(screen.getByText('Apply to stokvel')).toBeInTheDocument()
    })

    it('shows inline treasurer warning when only email invites are listed', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ users: [] }),
      })

      renderMemberWizard()
      await goToMemberMembersTab()

      const searchInput = screen.getByPlaceholderText(/Search by name/i)
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: 'invite@example.com' } })
        vi.advanceTimersByTime(400)
      })

      const addBtn = await screen.findByRole('button', { name: /Add new member/i })
      await act(async () => {
        fireEvent.click(addBtn)
      })

      expect(
        screen.getByText(
          /You must add at least one registered user to act as the Treasurer/i,
        ),
      ).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Next/i })).toBeDisabled()
    })

    it('requires selecting a treasurer when two registered members are listed', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })

      renderMemberWizard()
      await goToMemberMembersTab()

      await searchAndSelectRegisteredUser(treasurerUser)
      await searchAndSelectRegisteredUser(secondRegisteredUser, 'member2', {
        setupSearchMock: true,
      })

      const treasurerSelect = screen.getByLabelText(/Designated treasurer/i)
      expect(treasurerSelect).toBeInTheDocument()

      await act(async () => {
        fireEvent.change(treasurerSelect, { target: { value: '' } })
        fireEvent.click(screen.getByRole('button', { name: /Next/i }))
      })

      expect(
        await screen.findByText(
          /Select a designated treasurer. You cannot assign yourself/i,
        ),
      ).toBeInTheDocument()
    })

    it('submits a member application successfully', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })

      mockFetch.mockImplementation(async (url, init) => {
        const u = String(url)
        if (u.includes('/members/search')) {
          return {
            ok: true,
            text: async () => JSON.stringify({ users: [treasurerUser] }),
          }
        }
        if (u.includes('/api/stokvels') && init?.method === 'POST') {
          return {
            ok: true,
            text: async () =>
              JSON.stringify({
                stokvel: { id: 'stokvel-member-1', name: 'Member Group' },
              }),
          }
        }
        return { ok: true, text: async () => JSON.stringify({}) }
      })

      renderMemberWizard()
      await goToMemberMembersTab()
      await searchAndSelectRegisteredUser(treasurerUser, treasurerUser.username, {
        setupSearchMock: false,
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Next/i }))
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Create stokvel/i }))
      })

      expect(await screen.findByText(/Application submitted/i)).toBeInTheDocument()
      expect(screen.getByText(/submitted for approval/i)).toBeInTheDocument()

      const createCall = mockFetch.mock.calls.find(
        ([calledUrl, calledInit]) =>
          String(calledUrl).includes('/api/stokvels') &&
          calledInit?.method === 'POST' &&
          !String(calledUrl).includes('/members/search'),
      )
      expect(createCall).toBeTruthy()
      const body = JSON.parse(createCall[1].body)
      expect(body.treasurerUserId).toBe(TREASURER_USER_ID)
    })

    it('surfaces member search errors from the API', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })

      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => JSON.stringify({ error: 'Search unavailable' }),
      })

      renderMemberWizard()
      await goToMemberMembersTab()

      const searchInput = screen.getByPlaceholderText(/Search by name/i)
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: 'jane' } })
        fireEvent.focus(searchInput)
        vi.advanceTimersByTime(400)
      })

      expect(await screen.findByText('Search unavailable')).toBeInTheDocument()
    })

    it('surfaces plain-text member search errors', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })

      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => 'Search timed out',
      })

      renderMemberWizard()
      await goToMemberMembersTab()

      const searchInput = screen.getByPlaceholderText(/Search by name/i)
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: 'jane' } })
        vi.advanceTimersByTime(400)
      })

      expect(await screen.findByText('Search timed out')).toBeInTheDocument()
    })

    it('surfaces member create API failures on submit', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })

      mockFetch.mockImplementation(async (url, init) => {
        const u = String(url)
        if (u.includes('/members/search')) {
          return {
            ok: true,
            text: async () => JSON.stringify({ users: [treasurerUser] }),
          }
        }
        if (u.includes('/api/stokvels') && init?.method === 'POST') {
          return {
            ok: false,
            text: async () => JSON.stringify({ error: 'Application rejected' }),
          }
        }
        return { ok: true, text: async () => JSON.stringify({}) }
      })

      renderMemberWizard()
      await goToMemberMembersTab()
      await searchAndSelectRegisteredUser(treasurerUser, treasurerUser.username, {
        setupSearchMock: false,
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Next/i }))
      })
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Create stokvel/i }))
      })

      expect(await screen.findByText('Application rejected')).toBeInTheDocument()
    })

    it('keeps Next disabled on members tab until a registered treasurer can be chosen', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })

      renderMemberWizard()
      await goToMemberMembersTab()

      const nextBtn = screen.getByRole('button', { name: /Next/i })
      expect(nextBtn).toBeDisabled()
      expect(nextBtn.getAttribute('title')).toMatch(
        /Add a registered member to assign as treasurer/i,
      )
    })

    it('auto-selects the treasurer when exactly one registered member is added', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })

      renderMemberWizard()
      await goToMemberMembersTab()
      await searchAndSelectRegisteredUser(treasurerUser)

      const treasurerSelect = screen.getByLabelText(/Designated treasurer/i)
      expect(treasurerSelect).toHaveValue(TREASURER_USER_ID)
    })

    it('submits with two registered members and explicit treasurer selection', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })

      mockFetch.mockImplementation(async (url, init) => {
        const u = String(url)
        if (u.includes('/members/search')) {
          return {
            ok: true,
            text: async () =>
              JSON.stringify({ users: [treasurerUser, secondRegisteredUser] }),
          }
        }
        if (u.includes('/api/stokvels') && init?.method === 'POST') {
          return {
            ok: true,
            text: async () =>
              JSON.stringify({
                stokvel: { id: 'stokvel-member-2', name: 'Member Group' },
              }),
          }
        }
        return { ok: true, text: async () => JSON.stringify({}) }
      })

      renderMemberWizard()
      await goToMemberMembersTab()
      await searchAndSelectRegisteredUser(treasurerUser, treasurerUser.username, {
        setupSearchMock: false,
      })
      await searchAndSelectRegisteredUser(secondRegisteredUser, 'member2', {
        setupSearchMock: false,
      })

      fireEvent.change(screen.getByLabelText(/Designated treasurer/i), {
        target: { value: TREASURER_USER_ID },
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Next/i }))
      })
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Create stokvel/i }))
      })

      expect(await screen.findByText(/Application submitted/i)).toBeInTheDocument()
      const createCall = mockFetch.mock.calls.find(
        ([calledUrl, calledInit]) =>
          String(calledUrl).includes('/api/stokvels') &&
          calledInit?.method === 'POST' &&
          !String(calledUrl).includes('/members/search'),
      )
      const body = JSON.parse(createCall[1].body)
      expect(body.treasurerUserId).toBe(TREASURER_USER_ID)
      expect(body.memberDetails.length).toBeGreaterThanOrEqual(2)
    })

    it('redirects to the dashboard after a successful member application', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })

      mockFetch.mockImplementation(async (url, init) => {
        const u = String(url)
        if (u.includes('/members/search')) {
          return {
            ok: true,
            text: async () => JSON.stringify({ users: [treasurerUser] }),
          }
        }
        if (u.includes('/api/stokvels') && init?.method === 'POST') {
          return {
            ok: true,
            text: async () =>
              JSON.stringify({
                stokvel: { id: 'stokvel-member-3', name: 'Member Group' },
              }),
          }
        }
        return { ok: true, text: async () => JSON.stringify({}) }
      })

      renderMemberWizard()
      await goToMemberMembersTab()
      await searchAndSelectRegisteredUser(treasurerUser, treasurerUser.username, {
        setupSearchMock: false,
      })
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Next/i }))
      })
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Create stokvel/i }))
      })

      await screen.findByText(/Application submitted/i)
      await act(async () => {
        vi.advanceTimersByTime(5000)
      })

      expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
    })

    it('rejects adding the chairperson email again as a pending invite', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ users: [] }),
      })

      renderMemberWizard()
      await goToMemberMembersTab()

      const searchInput = screen.getByPlaceholderText(/Search by name/i)
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: 'member@test.com' } })
        vi.advanceTimersByTime(400)
      })

      await act(async () => {
        fireEvent.click(await screen.findByRole('button', { name: /Add new member/i }))
      })

      expect(
        await screen.findByText(/That is you — you are already in the group/i),
      ).toBeInTheDocument()
    })

    it('adds a pending username invite on the member flow', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })

      mockFetch.mockImplementation(async (url) => {
        if (String(url).includes('/members/search')) {
          return { ok: true, text: async () => JSON.stringify({ users: [] }) }
        }
        return { ok: true, text: async () => JSON.stringify({}) }
      })

      renderMemberWizard()
      await goToMemberMembersTab()

      const searchInput = screen.getByPlaceholderText(/Search by name/i)
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: 'pendinguser' } })
        fireEvent.focus(searchInput)
        vi.advanceTimersByTime(400)
      })

      const addBtn = await screen.findByRole('button', { name: /Add new member/i })
      await waitFor(() => expect(addBtn).not.toBeDisabled())
      await act(async () => {
        fireEvent.click(addBtn)
      })

      expect(screen.getAllByText('@pendinguser').length).toBeGreaterThan(0)
    })
  })

  describe('Admin pending member validation', () => {
    it('rejects usernames that are too short when adding a pending member', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ users: [] }),
      })

      renderWithProviders(<CreateStokvelWizard variant="admin" />, {
        session: defaultSessionAdmin,
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Next/i }))
      })

      const searchInput = screen.getByPlaceholderText(/Search by name/i)

      await act(async () => {
        fireEvent.change(searchInput, { target: { value: 'ab' } })
        fireEvent.focus(searchInput)
        vi.advanceTimersByTime(400)
      })

      const addBtn = await screen.findByRole('button', { name: /Add new member/i })
      await act(async () => {
        fireEvent.click(addBtn)
      })

      expect(
        await screen.findByText(/Username must be 3–30 characters/i),
      ).toBeInTheDocument()
    })

    it('adds a pending member by username', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })

      mockFetch.mockImplementation(async (url) => {
        if (String(url).includes('/api/admin/users')) {
          return { ok: true, text: async () => JSON.stringify({ users: [] }) }
        }
        return { ok: true, text: async () => JSON.stringify({}) }
      })

      renderWithProviders(<CreateStokvelWizard variant="admin" />, {
        session: defaultSessionAdmin,
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Next/i }))
      })

      const searchInput = screen.getByPlaceholderText(/Search by name/i)
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: 'pendinguser' } })
        fireEvent.focus(searchInput)
        vi.advanceTimersByTime(400)
      })

      const addBtn = await screen.findByRole('button', { name: /Add new member/i })
      await waitFor(() => expect(addBtn).not.toBeDisabled())
      await act(async () => {
        fireEvent.click(addBtn)
      })

      expect(screen.getAllByText('@pendinguser').length).toBeGreaterThan(0)
    })

    it('rejects invalid manual email addresses for pending invites', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })

      mockFetch.mockImplementation(async (url) => {
        if (String(url).includes('/api/admin/users')) {
          return { ok: true, text: async () => JSON.stringify({ users: [] }) }
        }
        return { ok: true, text: async () => JSON.stringify({}) }
      })

      renderWithProviders(<CreateStokvelWizard variant="admin" />, {
        session: defaultSessionAdmin,
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Next/i }))
      })

      const searchInput = screen.getByPlaceholderText(/Search by name/i)
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: 'bad-email@' } })
        fireEvent.focus(searchInput)
        vi.advanceTimersByTime(400)
      })

      const addBtn = await screen.findByRole('button', { name: /Add new member/i })
      await waitFor(() => expect(addBtn).not.toBeDisabled())
      await act(async () => {
        fireEvent.click(addBtn)
      })

      expect(await screen.findByText(/Enter a valid email address/i)).toBeInTheDocument()
    })

    it('demotes the previous treasurer when another member is assigned treasurer', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })

      const firstUser = {
        id: '55555555-5555-4555-8555-555555555555',
        username: 'firstuser',
        firstName: 'First',
        lastName: 'User',
        email: 'first@test.com',
      }
      const secondUser = {
        id: '66666666-6666-4666-8666-666666666666',
        username: 'seconduser',
        firstName: 'Second',
        lastName: 'User',
        email: 'second@test.com',
      }

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          text: async () => JSON.stringify({ users: [firstUser] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          text: async () => JSON.stringify({ users: [secondUser] }),
        })

      renderWithProviders(<CreateStokvelWizard variant="admin" />, {
        session: defaultSessionAdmin,
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Next/i }))
      })

      await searchAndSelectRegisteredUser(firstUser, 'firstuser', { setupSearchMock: false })
      await searchAndSelectRegisteredUser(secondUser, 'seconduser', { setupSearchMock: false })

      const roleSelects = screen.getAllByLabelText(/Role for/i)
      fireEvent.change(roleSelects[0], { target: { value: 'Treasurer' } })
      fireEvent.change(roleSelects[1], { target: { value: 'Treasurer' } })

      expect(roleSelects[0]).toHaveValue('Member')
      expect(roleSelects[1]).toHaveValue('Treasurer')
    })
  })

  describe('Create error paths', () => {
    it('surfaces document upload failures before create', async () => {
      mockFetch.mockImplementation(async (url) => {
        if (String(url).includes('/uploads/documents')) {
          return {
            ok: false,
            json: async () => ({ error: 'Upload rejected' }),
          }
        }
        return { ok: true, text: async () => JSON.stringify({}) }
      })

      renderWithProviders(<CreateStokvelWizard variant="admin" />, {
        session: defaultSessionAdmin,
      })

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

      const fileInput = document.querySelector('input[type="file"]')
      const file = new File(['dummy'], 'test.pdf', { type: 'application/pdf' })
      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } })
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Create stokvel/i }))
      })

      expect(await screen.findByText('Upload rejected')).toBeInTheDocument()
      expect(
        mockFetch.mock.calls.some(([u]) => String(u).includes('/api/admin/stokvels')),
      ).toBe(false)
    })

    it('requires email for registered members missing profile email on submit', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ users: [userWithoutEmail] }),
      })

      renderWithProviders(<CreateStokvelWizard variant="admin" />, {
        session: defaultSessionAdmin,
      })

      await act(async () => {
        fireEvent.change(screen.getByLabelText(/Group name/i), { target: { value: 'My Group' } })
        fireEvent.change(screen.getByLabelText(/Contribution amount/i), { target: { value: '100' } })
        fireEvent.click(screen.getByRole('button', { name: /Next/i }))
      })

      await searchAndSelectRegisteredUser(userWithoutEmail)

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Next/i }))
      })
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Create stokvel/i }))
      })

      expect(
        await screen.findByText(/Enter a valid email for @noemail/i),
      ).toBeInTheDocument()
      expect(confirmMock).not.toHaveBeenCalled()
    })

    it('rejects PDF uploads larger than 5MB', async () => {
      renderWithProviders(<CreateStokvelWizard variant="admin" />, {
        session: defaultSessionAdmin,
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Next/i }))
      })
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Next/i }))
      })

      const fileInput = document.querySelector('input[type="file"]')
      const huge = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'big.pdf', {
        type: 'application/pdf',
      })

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [huge] } })
      })

      expect(await screen.findByText(/Each PDF must be at most 5MB/i)).toBeInTheDocument()
    })
  })

  describe('Post-create admin invites', () => {
    async function createStokvelForInvites() {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({ stokvel: { id: 'stokvel-123', name: 'My Group' } }),
      })

      renderWithProviders(<CreateStokvelWizard variant="admin" />, {
        session: defaultSessionAdmin,
      })

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

      await screen.findByText(/My Group is live/i)
    }

    it('surfaces username invite failures after create', async () => {
      await createStokvelForInvites()

      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => JSON.stringify({ error: 'User not found' }),
      })

      await act(async () => {
        fireEvent.change(screen.getByLabelText(/Add by username/i), {
          target: { value: 'ghostuser' },
        })
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /^Add member$/i }))
      })

      expect(await screen.findByText('User not found')).toBeInTheDocument()
    })

    it('surfaces email invitation failures after create', async () => {
      await createStokvelForInvites()

      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => JSON.stringify({ error: 'Invalid email domain' }),
      })

      await act(async () => {
        fireEvent.change(screen.getByLabelText(/Invite by email/i), {
          target: { value: 'bad@example.com' },
        })
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /^Send invite$/i }))
      })

      expect(await screen.findByText('Invalid email domain')).toBeInTheDocument()
    })

    it('shows success when username invite succeeds', async () => {
      await createStokvelForInvites()

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ ok: true }),
      })

      await act(async () => {
        fireEvent.change(screen.getByLabelText(/Add by username/i), {
          target: { value: 'newmember' },
        })
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /^Add member$/i }))
      })

      expect(await screen.findByText(/Member added: newmember/i)).toBeInTheDocument()
    })

    it('shows success when an email invitation succeeds', async () => {
      await createStokvelForInvites()

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ ok: true }),
      })

      await act(async () => {
        fireEvent.change(screen.getByLabelText(/Invite by email/i), {
          target: { value: 'invite@example.com' },
        })
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /^Send invite$/i }))
      })

      expect(await screen.findByText(/Invitation sent: invite@example.com/i)).toBeInTheDocument()
    })
  })

  describe('Advanced admin flows', () => {
    async function goToMembersTab() {
      await act(async () => {
        fireEvent.change(screen.getByLabelText(/Group name/i), { target: { value: 'My Group' } })
        fireEvent.change(screen.getByLabelText(/Contribution amount/i), { target: { value: '100' } })
        fireEvent.click(screen.getByRole('button', { name: /Next/i }))
      })
    }

    it('reorders manual payout sequence via drag and drop', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          text: async () => JSON.stringify({ users: [treasurerUser] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          text: async () => JSON.stringify({ users: [secondRegisteredUser] }),
        })

      renderWithProviders(<CreateStokvelWizard variant="admin" />, {
        session: defaultSessionAdmin,
      })
      await goToMembersTab()
      await searchAndSelectRegisteredUser(treasurerUser, treasurerUser.username, {
        setupSearchMock: false,
      })
      await searchAndSelectRegisteredUser(secondRegisteredUser, 'member2', {
        setupSearchMock: false,
      })

      await act(async () => {
        fireEvent.click(screen.getByLabelText(/Manual \(drag to reorder\)/i))
      })

      const dnd = await screen.findByTestId('mock-dnd-context')
      fireEvent.click(dnd)

      expect(screen.getByTestId(`drag-${TREASURER_USER_ID}`)).toBeInTheDocument()
      expect(screen.getByTestId(`drag-${SECOND_MEMBER_ID}`)).toBeInTheDocument()
    })

    it('saves and validates email from the member email popover', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ users: [userWithoutEmail] }),
      })

      renderWithProviders(<CreateStokvelWizard variant="admin" />, {
        session: defaultSessionAdmin,
      })
      await goToMembersTab()
      await searchAndSelectRegisteredUser(userWithoutEmail)

      fireEvent.click(screen.getAllByRole('button', { name: /^Add email$/i })[0])
      expect(await screen.findByRole('dialog')).toBeInTheDocument()

      fireEvent.change(screen.getByLabelText(/^Email$/i), { target: { value: 'not-an-email' } })
      fireEvent.click(screen.getByRole('button', { name: /^Save$/i }))
      expect(await screen.findByText(/Enter a valid email address/i)).toBeInTheDocument()

      fireEvent.change(screen.getByLabelText(/^Email$/i), {
        target: { value: 'valid@example.com' },
      })
      fireEvent.click(screen.getByRole('button', { name: /^Save$/i }))
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    })

    it('closes the email popover with Escape', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ users: [userWithoutEmail] }),
      })

      renderWithProviders(<CreateStokvelWizard variant="admin" />, {
        session: defaultSessionAdmin,
      })
      await goToMembersTab()
      await searchAndSelectRegisteredUser(userWithoutEmail)

      fireEvent.click(screen.getAllByRole('button', { name: /^Add email$/i })[0])
      await screen.findByRole('dialog')
      fireEvent.keyDown(window, { key: 'Escape' })
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    })

    it('adds documents via dropzone and removes them from the list', async () => {
      renderWithProviders(<CreateStokvelWizard variant="admin" />, {
        session: defaultSessionAdmin,
      })
      await goToMembersTab()
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Next/i }))
      })

      const pdf = new File(['%PDF'], 'constitution.pdf', { type: 'application/pdf' })
      const dropTarget = screen.getByText(/Drop PDFs here or click to upload/i).closest('button')

      await act(async () => {
        fireEvent.dragOver(dropTarget)
        fireEvent.dragLeave(dropTarget)
        fireEvent.drop(dropTarget, { dataTransfer: { files: [pdf] } })
      })
      expect(await screen.findByText('constitution.pdf')).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: /Remove constitution.pdf/i }))
      await waitFor(() => {
        expect(screen.queryByText('constitution.pdf')).not.toBeInTheDocument()
      })
    })

    it('submits manual payout sequence on create when roster is complete', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          text: async () => JSON.stringify({ users: [treasurerUser] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          text: async () => JSON.stringify({ users: [secondRegisteredUser] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          text: async () =>
            JSON.stringify({ stokvel: { id: 'stokvel-manual-1', name: 'Manual Group' } }),
        })

      renderWithProviders(<CreateStokvelWizard variant="admin" />, {
        session: defaultSessionAdmin,
      })
      await goToMembersTab()
      await searchAndSelectRegisteredUser(treasurerUser, treasurerUser.username, {
        setupSearchMock: false,
      })
      await searchAndSelectRegisteredUser(secondRegisteredUser, 'member2', {
        setupSearchMock: false,
      })

      await act(async () => {
        fireEvent.click(screen.getByLabelText(/Manual \(drag to reorder\)/i))
      })
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Next/i }))
      })
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Create stokvel/i }))
      })

      expect(await screen.findByText(/Manual Group is live/i)).toBeInTheDocument()

      const createCall = mockFetch.mock.calls.find(
        ([url, init]) =>
          String(url).includes('/api/admin/stokvels') &&
          init?.method === 'POST',
      )
      const body = JSON.parse(createCall[1].body)
      expect(body.proposed_payout_sequence).toEqual(
        expect.arrayContaining([TREASURER_USER_ID, SECOND_MEMBER_ID]),
      )
    })

    it('submits public rotating groups with randomize payout and weekly meetings', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({ stokvel: { id: 'stokvel-public-1', name: 'Public Group' } }),
      })

      renderWithProviders(<CreateStokvelWizard variant="admin" />, {
        session: defaultSessionAdmin,
      })

      await act(async () => {
        fireEvent.change(screen.getByLabelText(/Group name/i), { target: { value: 'Public Group' } })
        fireEvent.change(screen.getByLabelText(/Contribution amount/i), { target: { value: '150' } })
        fireEvent.change(screen.getByLabelText(/Meeting frequency/i), {
          target: { value: 'weekly' },
        })
        fireEvent.click(screen.getByLabelText(/Make this Stokvel Public/i))
        fireEvent.click(screen.getByRole('button', { name: /Next/i }))
      })

      await act(async () => {
        fireEvent.click(screen.getByLabelText(/Randomize at activation/i))
        fireEvent.click(screen.getByRole('button', { name: /Next/i }))
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Create stokvel/i }))
      })

      expect(await screen.findByText(/Public Group is live/i)).toBeInTheDocument()

      const createCall = mockFetch.mock.calls.find(
        ([url, init]) =>
          String(url).includes('/api/admin/stokvels') && init?.method === 'POST',
      )
      const body = JSON.parse(createCall[1].body)
      expect(body.isPublic).toBe(true)
      expect(body.meetingFrequency).toBe('weekly')
      expect(body.payout_order_type).toBe('randomize')
      expect(body.proposed_payout_sequence).toEqual([])
    })

    it('supports optional email on pending username members via the popover', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })

      mockFetch.mockImplementation(async (url) => {
        if (String(url).includes('/api/admin/users')) {
          return { ok: true, text: async () => JSON.stringify({ users: [] }) }
        }
        return { ok: true, text: async () => JSON.stringify({}) }
      })

      renderWithProviders(<CreateStokvelWizard variant="admin" />, {
        session: defaultSessionAdmin,
      })
      await goToMembersTab()

      const searchInput = screen.getByPlaceholderText(/Search by name/i)
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: 'pendinguser' } })
        fireEvent.focus(searchInput)
        vi.advanceTimersByTime(400)
      })
      const addBtn = await screen.findByRole('button', { name: /Add new member/i })
      await waitFor(() => expect(addBtn).not.toBeDisabled())
      await act(async () => {
        fireEvent.click(addBtn)
      })

      const addEmailButtons = screen.getAllByRole('button', { name: /^Add email$/i })
      fireEvent.click(addEmailButtons[addEmailButtons.length - 1])
      expect(await screen.findByText(/Add contact email \(optional\)/i)).toBeInTheDocument()

      fireEvent.change(screen.getByLabelText(/^Email$/i), {
        target: { value: 'optional@example.com' },
      })
      fireEvent.click(screen.getByRole('button', { name: /^Save$/i }))
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      expect(screen.getAllByText('optional@example.com').length).toBeGreaterThan(0)
    })

    it('closes the email popover from the backdrop control', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ users: [userWithoutEmail] }),
      })

      renderWithProviders(<CreateStokvelWizard variant="admin" />, {
        session: defaultSessionAdmin,
      })
      await goToMembersTab()
      await searchAndSelectRegisteredUser(userWithoutEmail)

      fireEvent.click(screen.getAllByRole('button', { name: /^Add email$/i })[0])
      await screen.findByRole('dialog')
      fireEvent.click(screen.getAllByRole('button', { name: /^Close$/i })[0])
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    })

    it('closes the email popover when Cancel is clicked', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ users: [userWithoutEmail] }),
      })

      renderWithProviders(<CreateStokvelWizard variant="admin" />, {
        session: defaultSessionAdmin,
      })
      await goToMembersTab()
      await searchAndSelectRegisteredUser(userWithoutEmail)

      fireEvent.click(screen.getAllByRole('button', { name: /^Add email$/i })[0])
      await screen.findByRole('dialog')
      fireEvent.click(screen.getByRole('button', { name: /^Cancel$/i }))
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    })

    it('closes the email popover from the header dismiss control', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ users: [userWithoutEmail] }),
      })

      renderWithProviders(<CreateStokvelWizard variant="admin" />, {
        session: defaultSessionAdmin,
      })
      await goToMembersTab()
      await searchAndSelectRegisteredUser(userWithoutEmail)

      fireEvent.click(screen.getAllByRole('button', { name: /^Add email$/i })[0])
      await screen.findByRole('dialog')
      const closeButtons = screen.getAllByRole('button', { name: /^Close$/i })
      fireEvent.click(closeButtons[closeButtons.length - 1])
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    })

    it('surfaces parseApiError HTML when create fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => '<html>Cannot GET /api/admin/stokvels</html>',
      })

      renderWithProviders(<CreateStokvelWizard variant="admin" />, {
        session: defaultSessionAdmin,
      })
      await goToMembersTab()
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Next/i }))
      })
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Create stokvel/i }))
      })

      expect(
        await screen.findByText(/Could not reach the API \(got an HTML error page\)/i),
      ).toBeInTheDocument()
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
