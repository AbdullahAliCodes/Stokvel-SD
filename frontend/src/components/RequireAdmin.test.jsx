import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import RequireAdmin from './RequireAdmin'

const { mockUseSession } = vi.hoisted(() => ({
  mockUseSession: vi.fn(),
}))

vi.mock('../context/SessionContext', () => ({
  useSession: () => mockUseSession(),
}))

function renderGuard() {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route element={<RequireAdmin />}>
          <Route path="/admin" element={<div>Admin Area</div>} />
        </Route>
        <Route path="/dashboard" element={<div>Dashboard Page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('RequireAdmin', () => {
  beforeEach(() => {
    mockUseSession.mockReset()
  })

  it('renders admin outlet for admin role', () => {
    mockUseSession.mockReturnValue({ userRole: 'admin' })
    renderGuard()
    expect(screen.getByText('Admin Area')).toBeInTheDocument()
  })

  it('redirects member to /dashboard', () => {
    mockUseSession.mockReturnValue({ userRole: 'member' })
    renderGuard()
    expect(screen.getByText('Dashboard Page')).toBeInTheDocument()
  })

  it('shows loading state for null/guest role', () => {
    mockUseSession.mockReturnValue({ userRole: null })
    renderGuard()
    expect(screen.getByText('Loading authorization…')).toBeInTheDocument()
  })
})
