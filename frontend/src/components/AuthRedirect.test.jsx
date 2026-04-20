import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import AuthRedirect from './AuthRedirect'

const { sessionState } = vi.hoisted(() => ({
  sessionState: { current: { session: null, userRole: null } },
}))

vi.mock('../context/SessionContext', () => ({
  useSession: () => sessionState.current,
}))

vi.mock('react-router-dom', () => ({
  Navigate: ({ to, replace }) => (
    <div data-testid="navigate" data-to={to} data-replace={String(Boolean(replace))} />
  ),
}))

function getNavigationTarget() {
  const navigateNode = screen.getByTestId('navigate')
  return {
    to: navigateNode.getAttribute('data-to'),
    replace: navigateNode.getAttribute('data-replace'),
  }
}

describe('AuthRedirect', () => {
  it('redirects unauthenticated users to /auth', () => {
    sessionState.current = { session: null, userRole: 'member' }

    render(<AuthRedirect />)

    expect(getNavigationTarget()).toEqual({ to: '/auth', replace: 'true' })
  })

  it('shows loading state when session exists but role is null', () => {
    sessionState.current = { session: { user: { id: 'u-1' } }, userRole: null }

    render(<AuthRedirect />)

    expect(screen.getByText('Authenticating...')).toBeInTheDocument()
    expect(screen.queryByTestId('navigate')).not.toBeInTheDocument()
  })

  it('shows loading state when session exists but role is undefined', () => {
    sessionState.current = { session: { user: { id: 'u-1' } }, userRole: undefined }

    render(<AuthRedirect />)

    expect(screen.getByText('Authenticating...')).toBeInTheDocument()
    expect(screen.queryByTestId('navigate')).not.toBeInTheDocument()
  })

  it('redirects admins to /admin/groups', () => {
    sessionState.current = { session: { user: { id: 'u-1' } }, userRole: 'admin' }

    render(<AuthRedirect />)

    expect(getNavigationTarget()).toEqual({ to: '/admin/groups', replace: 'true' })
  })

  it('redirects admins to /admin/groups even with mixed-case role values', () => {
    sessionState.current = { session: { user: { id: 'u-1' } }, userRole: 'AdMiN' }

    render(<AuthRedirect />)

    expect(getNavigationTarget()).toEqual({ to: '/admin/groups', replace: 'true' })
  })

  it('redirects non-admin authenticated users to /dashboard', () => {
    sessionState.current = { session: { user: { id: 'u-1' } }, userRole: 'member' }

    render(<AuthRedirect />)

    expect(getNavigationTarget()).toEqual({ to: '/dashboard', replace: 'true' })
  })

  it('redirects numeric role values to /dashboard', () => {
    sessionState.current = { session: { user: { id: 'u-1' } }, userRole: 1 }

    render(<AuthRedirect />)

    expect(getNavigationTarget()).toEqual({ to: '/dashboard', replace: 'true' })
  })
})
