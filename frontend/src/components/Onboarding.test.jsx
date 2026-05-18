import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import Onboarding from './Onboarding'

const sessionState = vi.hoisted(() => ({
  current: { userRole: null },
}))

vi.mock('react-router-dom', () => ({
  Link: ({ to, children, ...rest }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
  Navigate: ({ to }) => <div data-testid="navigate" data-to={to} />,
}))

vi.mock('../context/SessionContext', () => ({
  useSession: () => sessionState.current,
}))

vi.mock('./ui/Spinner', () => ({
  default: ({ label }) => <div data-testid="spinner">{label}</div>,
}))

describe('Onboarding', () => {
  it('shows loading state while platform role is unresolved (null)', () => {
    sessionState.current = { userRole: null }

    render(<Onboarding />)

    expect(screen.getByTestId('spinner')).toHaveTextContent('Preparing your workspace')
    expect(screen.queryByText('Welcome!')).not.toBeInTheDocument()
  })

  it('shows welcome cards and Apply CTA for non-admin users', () => {
    sessionState.current = { userRole: 'user' }

    render(<Onboarding />)

    expect(screen.getByText('Welcome!')).toBeInTheDocument()
    expect(screen.getByText(/apply or create a Stokvel/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Apply to a stokvel/i })).toHaveAttribute('href', '/apply')
    expect(screen.getByRole('link', { name: /Back to Home/i })).toHaveAttribute('href', '/')
  })

  it('redirects platform admins to admin groups', () => {
    sessionState.current = { userRole: 'admin' }

    render(<Onboarding />)

    expect(screen.getByTestId('navigate')).toHaveAttribute('data-to', '/admin/groups')
    expect(screen.queryByText('Welcome!')).not.toBeInTheDocument()
  })
})
