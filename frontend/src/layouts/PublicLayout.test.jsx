import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import PublicLayout from './PublicLayout'
import { SessionContext } from '../context/SessionContext'

const signOutMock = vi.fn(async () => ({}))

vi.mock('../utils/supabase', () => ({
  supabase: { auth: { signOut: (...args) => signOutMock(...args) } },
}))

vi.mock('../components/BrandLogo', () => ({
  default: ({ to }) => <a href={to}>Logo</a>,
}))

vi.mock('../components/PublicFooter', () => ({
  default: () => <footer data-testid="public-footer">Footer</footer>,
}))

vi.mock('../components/ThemeToggle', () => ({
  default: () => <div data-testid="theme-toggle" />,
}))

function renderLayout(initialPath, sessionValue) {
  return render(
    <SessionContext.Provider value={sessionValue}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<div data-testid="outlet">Landing</div>} />
            <Route path="/auth" element={<div data-testid="outlet">Auth</div>} />
            <Route path="/about" element={<div data-testid="outlet">About page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </SessionContext.Provider>,
  )
}

describe('PublicLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders outlet content on public routes with chrome', () => {
    renderLayout('/about', { session: null, userRole: null })

    expect(screen.getByTestId('outlet')).toHaveTextContent('About page')
    expect(screen.getByText('Logo')).toBeInTheDocument()
    expect(screen.getByTestId('public-footer')).toBeInTheDocument()
    expect(screen.getByTestId('theme-toggle')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Log In \/ Sign up/i })).toBeInTheDocument()
  })

  it('hides nav chrome on landing route', () => {
    renderLayout('/', { session: null, userRole: null })

    expect(screen.getByTestId('outlet')).toHaveTextContent('Landing')
    expect(screen.queryByText('Logo')).not.toBeInTheDocument()
    expect(screen.queryByTestId('public-footer')).not.toBeInTheDocument()
  })

  it('hides nav chrome on auth route', () => {
    renderLayout('/auth', { session: null, userRole: null })

    expect(screen.getByTestId('outlet')).toHaveTextContent('Auth')
    expect(screen.queryByText('Logo')).not.toBeInTheDocument()
    expect(screen.queryByTestId('public-footer')).not.toBeInTheDocument()
  })

  it('shows dashboard link and signs out when session exists', async () => {
    const user = userEvent.setup()
    renderLayout('/about', {
      session: { access_token: 't1', user: { id: 'u1' } },
      userRole: 'member',
    })

    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/dashboard')

    await user.click(screen.getByRole('button', { name: 'Log out' }))

    expect(signOutMock).toHaveBeenCalled()
  })
})
