import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { render, screen, waitFor } from '@testing-library/react'
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
  global.fetch = vi.fn(async () => ({
    ok: true,
    text: async () => JSON.stringify({ memberships }),
  }))

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

describe('DashboardLayout back navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('hides back link on group dashboard home', async () => {
    renderLayout('/group/stok-1/dashboard')
    expect(await screen.findByText('Group home')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Back to dashboard' })).not.toBeInTheDocument()
  })

  it('shows back link to group dashboard on scoped sub-pages', async () => {
    renderLayout('/group/stok-1/payments')
    expect(await screen.findByText('Payments page')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Back to dashboard' })).toHaveAttribute(
        'href',
        '/group/stok-1/dashboard',
      )
    })
  })

  it('shows back link on global member routes', async () => {
    renderLayout('/account')
    expect(await screen.findByText('Account page')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Back to dashboard' })).toHaveAttribute(
        'href',
        '/dashboard',
      )
    })
  })
})
