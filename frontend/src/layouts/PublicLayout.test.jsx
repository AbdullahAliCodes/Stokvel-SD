import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import PublicLayout from './PublicLayout'

vi.mock('../utils/supabase', () => ({
  supabase: {
    auth: {
      signOut: vi.fn().mockResolvedValue({}),
    },
  },
}))

vi.mock('../components/BrandLogo', () => ({
  default: ({ to }) => (
    <a href={to} data-testid="brand-logo">
      Logo
    </a>
  ),
}))

vi.mock('../components/PublicFooter', () => ({
  default: () => <footer data-testid="public-footer">Footer</footer>,
}))

vi.mock('../components/ThemeToggle', () => ({
  default: () => <button type="button">Theme</button>,
}))

const sessionState = vi.hoisted(() => ({
  current: { session: null, userRole: null },
}))

vi.mock('../context/SessionContext', () => ({
  useSession: () => sessionState.current,
}))

function renderLayout(initialPath = '/apply') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/apply" element={<div>Outlet child content</div>} />
          <Route path="/" element={<div>Landing owns nav</div>} />
          <Route path="/auth" element={<div>Auth page</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('PublicLayout', () => {
  it('renders Outlet content with public chrome on non-landing routes', () => {
    sessionState.current = { session: null, userRole: null }

    renderLayout('/apply')

    expect(screen.getByText('Outlet child content')).toBeInTheDocument()
    expect(screen.getByTestId('brand-logo')).toBeInTheDocument()
    expect(screen.getByTestId('public-footer')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Log In \/ Sign up/i })).toBeInTheDocument()
  })

  it('hides public chrome on landing and auth routes', () => {
    sessionState.current = { session: null, userRole: null }

    renderLayout('/')
    expect(screen.getByText('Landing owns nav')).toBeInTheDocument()
    expect(screen.queryByTestId('public-footer')).not.toBeInTheDocument()

    renderLayout('/auth')
    expect(screen.getByText('Auth page')).toBeInTheDocument()
    expect(screen.queryByTestId('public-footer')).not.toBeInTheDocument()
  })

  it('shows dashboard link for signed-in member', () => {
    sessionState.current = {
      session: { access_token: 'tok' },
      userRole: 'user',
    }

    renderLayout('/apply')

    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/dashboard')
    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument()
  })

  it('shows admin dashboard link for platform admin', () => {
    sessionState.current = {
      session: { access_token: 'tok' },
      userRole: 'admin',
    }

    renderLayout('/apply')

    expect(screen.getByRole('link', { name: 'Admin Dashboard' })).toHaveAttribute(
      'href',
      '/admin/groups',
    )
    expect(screen.getByTestId('brand-logo')).toHaveAttribute('href', '/admin/groups')
  })
})
