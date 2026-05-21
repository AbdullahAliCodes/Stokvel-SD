import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { supabase } from '../utils/supabase'
import { readViewCache } from '../utils/viewCache'
import DashboardLayout from './DashboardLayout'
import { SessionContext } from '../context/SessionContext'

vi.mock('../utils/supabase', () => ({
  supabase: { auth: { signOut: vi.fn(async () => ({})) } },
}))

vi.mock('../components/BrandLogo', () => ({
  default: ({ to }) => <a href={to}>Logo</a>,
}))

vi.mock('../components/ThemeToggle', () => ({
  default: () => <div data-testid="theme-toggle" />,
}))

vi.mock('../utils/viewCache', () => ({
  readViewCache: vi.fn(() => null),
  writeViewCache: vi.fn(),
}))

vi.mock('../utils/api', () => ({
  apiUrl: (path) => `http://test${path}`,
}))

const memberships = [
  {
    stokvel_id: 'stok-1',
    group_role: 'member',
    stokvels: { id: 'stok-1', name: 'Alpha Group', status: 'active' },
  },
]

function renderLayout(initialPath) {
  global.fetch = vi.fn(async (url) => {
    if (String(url).includes('/api/profile/me')) {
      return {
        ok: true,
        text: async () => JSON.stringify({ profile: { firstName: 'Ada' } }),
      }
    }
    return {
      ok: true,
      text: async () => JSON.stringify({ memberships }),
    }
  })

  return render(
    <SessionContext.Provider
      value={{
        session: { access_token: 'token', user: { id: 'u1' } },
        userRole: 'member',
      }}
    >
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route element={<DashboardLayout />}>
            <Route path="/group/:stokvel_id/dashboard" element={<div>Group home</div>} />
            <Route path="/group/:stokvel_id/payments" element={<div>Payments page</div>} />
            <Route path="/account" element={<div>Account page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </SessionContext.Provider>,
  )
}

describe('DashboardLayout page content', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('renders outlet without a back-to-dashboard link on scoped sub-pages', async () => {
    renderLayout('/group/stok-1/payments')
    expect(await screen.findByText('Payments page')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Back to dashboard' })).not.toBeInTheDocument()
  })

  it('renders outlet without a back-to-dashboard link on global member routes', async () => {
    renderLayout('/account')
    expect(await screen.findByText('Account page')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Back to dashboard' })).not.toBeInTheDocument()
  })

  it('shows a welcome message with the member first name above Account', async () => {
    renderLayout('/account')
    await screen.findByText('Account page')
    expect(screen.getAllByText('Welcome back, Ada').length).toBeGreaterThanOrEqual(1)
  })

  it('exposes a mobile menu toggle and closes the drawer via backdrop', async () => {
    const user = userEvent.setup()
    renderLayout('/account')
    await screen.findByText('Account page')

    const openBtn = screen.getByRole('button', { name: 'Open menu' })
    expect(openBtn).toHaveAttribute('aria-expanded', 'false')

    await user.click(openBtn)
    expect(screen.getByRole('button', { name: 'Close menu' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    expect(screen.getByLabelText('Stokvel')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Dismiss menu overlay' }))
    expect(screen.getByRole('button', { name: 'Open menu' })).toBeInTheDocument()
  })

  it('blocks the outlet when the scoped stokvel is not in the membership list', async () => {
    renderLayout('/group/unknown-stokvel/payments')
    await screen.findByLabelText('Stokvel')
    expect(screen.queryByText('Payments page')).not.toBeInTheDocument()
  })

  it('shows a membership error when the fetch fails with no cached memberships', async () => {
    global.fetch = vi.fn(async (url) => {
      if (String(url).includes('/api/profile/me')) {
        return {
          ok: true,
          text: async () => JSON.stringify({ profile: { firstName: 'Ada' } }),
        }
      }
      return { ok: false, text: async () => 'Membership fetch failed' }
    })

    render(
      <SessionContext.Provider
        value={{
          session: { access_token: 'token', user: { id: 'u1' } },
          userRole: 'member',
        }}
      >
        <MemoryRouter initialEntries={['/account']}>
          <Routes>
            <Route element={<DashboardLayout />}>
              <Route path="/account" element={<div>Account page</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </SessionContext.Provider>,
    )

    expect(await screen.findByText(/Could not load your stokvels/i)).toBeInTheDocument()
  })

  it('navigates when a different stokvel is selected from the sidebar', async () => {
    const multiMemberships = [
      ...memberships,
      {
        stokvel_id: 'stok-2',
        group_role: 'member',
        stokvels: { id: 'stok-2', name: 'Beta Group', status: 'active' },
      },
    ]

    global.fetch = vi.fn(async (url) => {
      if (String(url).includes('/api/profile/me')) {
        return {
          ok: true,
          text: async () => JSON.stringify({ profile: { firstName: 'Ada' } }),
        }
      }
      return {
        ok: true,
        text: async () => JSON.stringify({ memberships: multiMemberships }),
      }
    })

    render(
      <SessionContext.Provider
        value={{
          session: { access_token: 'token', user: { id: 'u1' } },
          userRole: 'member',
        }}
      >
        <MemoryRouter initialEntries={['/group/stok-1/dashboard']}>
          <Routes>
            <Route element={<DashboardLayout />}>
              <Route
                path="/group/:stokvel_id/dashboard"
                element={<div>Dashboard outlet</div>}
              />
            </Route>
          </Routes>
        </MemoryRouter>
      </SessionContext.Provider>,
    )

    await screen.findByText('Dashboard outlet')
    fireEvent.change(screen.getByLabelText('Stokvel'), { target: { value: 'stok-2' } })
    expect(await screen.findByText('Dashboard outlet')).toBeInTheDocument()
  })

  it('shows a treasurer role badge for the selected group', async () => {
    const treasurerMemberships = [
      {
        stokvel_id: 'stok-1',
        group_role: 'treasurer',
        stokvels: { id: 'stok-1', name: 'Alpha Group', status: 'active' },
      },
    ]

    global.fetch = vi.fn(async (url) => {
      if (String(url).includes('/api/profile/me')) {
        return {
          ok: true,
          text: async () => JSON.stringify({ profile: { firstName: 'Ada' } }),
        }
      }
      return {
        ok: true,
        text: async () => JSON.stringify({ memberships: treasurerMemberships }),
      }
    })

    render(
      <SessionContext.Provider
        value={{
          session: { access_token: 'token', user: { id: 'u1' } },
          userRole: 'member',
        }}
      >
        <MemoryRouter initialEntries={['/group/stok-1/dashboard']}>
          <Routes>
            <Route element={<DashboardLayout />}>
              <Route path="/group/:stokvel_id/dashboard" element={<div>Group home</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </SessionContext.Provider>,
    )

    await screen.findByText('Group home')
    expect(screen.getAllByText('Treasurer').length).toBeGreaterThan(0)
  })

  it('shows the admin superuser badge in the sidebar', async () => {
    render(
      <SessionContext.Provider
        value={{
          session: { access_token: 'token', user: { id: 'u1' } },
          userRole: 'admin',
        }}
      >
        <MemoryRouter initialEntries={['/account']}>
          <Routes>
            <Route element={<DashboardLayout />}>
              <Route path="/account" element={<div>Account page</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </SessionContext.Provider>,
    )

    await screen.findByText('Account page')
    expect(screen.getAllByText('Admin | Superuser').length).toBeGreaterThan(0)
  })

  it('shows My Applications when a membership is pending', async () => {
    const pendingMemberships = [
      {
        stokvel_id: 'stok-pending',
        group_role: 'member',
        stokvels: { id: 'stok-pending', name: 'Pending Group', status: 'pending' },
      },
    ]

    global.fetch = vi.fn(async (url) => {
      if (String(url).includes('/api/profile/me')) {
        return {
          ok: true,
          text: async () => JSON.stringify({ profile: { firstName: 'Ada' } }),
        }
      }
      return {
        ok: true,
        text: async () => JSON.stringify({ memberships: pendingMemberships }),
      }
    })

    render(
      <SessionContext.Provider
        value={{
          session: { access_token: 'token', user: { id: 'u1' } },
          userRole: 'member',
        }}
      >
        <MemoryRouter initialEntries={['/account']}>
          <Routes>
            <Route element={<DashboardLayout />}>
              <Route path="/account" element={<div>Account page</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </SessionContext.Provider>,
    )

    await screen.findByText('Account page')
    expect(screen.getByRole('link', { name: /My Applications/i })).toBeInTheDocument()
  })

  it('signs out and navigates home when Log Out is clicked', async () => {
    const user = userEvent.setup()
    render(
      <SessionContext.Provider
        value={{
          session: { access_token: 'token', user: { id: 'u1' } },
          userRole: 'member',
        }}
      >
        <MemoryRouter initialEntries={['/account']}>
          <Routes>
            <Route path="/" element={<div>Home page</div>} />
            <Route element={<DashboardLayout />}>
              <Route path="/account" element={<div>Account page</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </SessionContext.Provider>,
    )

    await screen.findByText('Account page')
    await user.click(screen.getByRole('button', { name: /Log Out/i }))
    expect(supabase.auth.signOut).toHaveBeenCalled()
    expect(await screen.findByText('Home page')).toBeInTheDocument()
  })

  it('navigates to dashboard when Try again is clicked after a membership fetch failure', async () => {
    global.fetch = vi.fn(async (url) => {
      if (String(url).includes('/api/profile/me')) {
        return {
          ok: true,
          text: async () => JSON.stringify({ profile: { firstName: 'Ada' } }),
        }
      }
      return { ok: false, text: async () => 'Membership fetch failed' }
    })

    render(
      <SessionContext.Provider
        value={{
          session: { access_token: 'token', user: { id: 'u1' } },
          userRole: 'member',
        }}
      >
        <MemoryRouter initialEntries={['/account']}>
          <Routes>
            <Route path="/dashboard" element={<div>Dashboard home</div>} />
            <Route element={<DashboardLayout />}>
              <Route path="/account" element={<div>Account page</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </SessionContext.Provider>,
    )

    await screen.findByText(/Could not load your stokvels/i)
    fireEvent.click(screen.getByRole('button', { name: /Try again/i }))
    expect(await screen.findByText('Dashboard home')).toBeInTheDocument()
  })

  it('resolves stokvel ids from nested stokvels when stokvel_id is absent', async () => {
    const nestedOnly = [
      {
        group_role: 'member',
        stokvels: { id: 'stok-nested', name: 'Nested Group', status: 'active' },
      },
    ]

    global.fetch = vi.fn(async (url) => {
      if (String(url).includes('/api/profile/me')) {
        return {
          ok: true,
          text: async () => JSON.stringify({ profile: { firstName: 'Ada' } }),
        }
      }
      return {
        ok: true,
        text: async () => JSON.stringify({ memberships: nestedOnly }),
      }
    })

    render(
      <SessionContext.Provider
        value={{
          session: { access_token: 'token', user: { id: 'u1' } },
          userRole: 'member',
        }}
      >
        <MemoryRouter initialEntries={['/group/stok-nested/dashboard']}>
          <Routes>
            <Route element={<DashboardLayout />}>
              <Route path="/group/:stokvel_id/dashboard" element={<div>Nested home</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </SessionContext.Provider>,
    )

    expect(await screen.findByText('Nested home')).toBeInTheDocument()
  })

  it('hydrates memberships from cache when the network payload is not an array', async () => {
    readViewCache.mockReturnValueOnce({ memberships: 'not-an-array' })

    renderLayout('/account')
    await screen.findByText('Account page')
    expect(screen.getByLabelText('Stokvel')).toBeInTheDocument()
  })
})
