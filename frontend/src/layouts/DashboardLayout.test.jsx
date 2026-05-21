import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
})
