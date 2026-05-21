import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import PublicLayout from './PublicLayout'
import { SessionContext } from '../context/SessionContext'

const mockNavigate = vi.fn()
const signOutMock = vi.fn().mockResolvedValue({})

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('../utils/supabase', () => ({
  supabase: { auth: { signOut: (...args) => signOutMock(...args) } },
}))

vi.mock('../components/BrandLogo', () => ({
  default: ({ to }) => <a href={to}>Brand</a>,
}))

vi.mock('../components/ThemeToggle', () => ({
  default: () => <div data-testid="theme-toggle" />,
}))

vi.mock('../components/PublicFooter', () => ({
  default: () => <footer data-testid="public-footer">Footer</footer>,
}))

function renderPublicLayout(initialPath, session = null, userRole = null) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <SessionContext.Provider value={{ session, userRole }}>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<div>Home outlet</div>} />
            <Route path="/auth" element={<div>Auth outlet</div>} />
            <Route path="/stokvels" element={<div>Public stokvels outlet</div>} />
          </Route>
        </Routes>
      </SessionContext.Provider>
    </MemoryRouter>,
  )
}

describe('PublicLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    signOutMock.mockResolvedValue({})
  })

  it('renders outlet content on public routes', () => {
    renderPublicLayout('/stokvels')
    expect(screen.getByText('Public stokvels outlet')).toBeInTheDocument()
  })

  it('hides nav chrome on the landing route', () => {
    renderPublicLayout('/')
    expect(screen.getByText('Home outlet')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Log In/i })).not.toBeInTheDocument()
    expect(screen.queryByTestId('public-footer')).not.toBeInTheDocument()
  })

  it('hides nav chrome on the auth route', () => {
    renderPublicLayout('/auth')
    expect(screen.getByText('Auth outlet')).toBeInTheDocument()
    expect(screen.queryByTestId('public-footer')).not.toBeInTheDocument()
  })

  it('shows guest nav and footer on non-landing public pages', () => {
    renderPublicLayout('/stokvels')
    expect(screen.getByRole('link', { name: /Log In \/ Sign up/i })).toHaveAttribute(
      'href',
      '/auth',
    )
    expect(screen.getByTestId('theme-toggle')).toBeInTheDocument()
    expect(screen.getByTestId('public-footer')).toBeInTheDocument()
  })

  it('shows member dashboard CTA when session exists', () => {
    renderPublicLayout('/stokvels', {
      access_token: 'token-1',
      user: { id: 'u1' },
    })
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
      'href',
      '/dashboard',
    )
    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Log In/i })).not.toBeInTheDocument()
  })

  it('shows admin dashboard CTA and signs out on logout', async () => {
    renderPublicLayout(
      '/stokvels',
      { access_token: 'token-1', user: { id: 'admin-1' } },
      'admin',
    )
    expect(screen.getByRole('link', { name: 'Admin Dashboard' })).toHaveAttribute(
      'href',
      '/admin/groups',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Log out' }))
    await waitFor(() => {
      expect(signOutMock).toHaveBeenCalled()
      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true })
    })
  })
})
