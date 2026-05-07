import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import RequireMember from './RequireMember'

const { mockUseSession } = vi.hoisted(() => ({
  mockUseSession: vi.fn(),
}))

vi.mock('../context/SessionContext', () => ({
  useSession: () => mockUseSession(),
}))

function renderGuard() {
  return render(
    <MemoryRouter initialEntries={['/member']}>
      <Routes>
        <Route element={<RequireMember />}>
          <Route path="/member" element={<div>Member Area</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('RequireMember', () => {
  beforeEach(() => {
    mockUseSession.mockReset()
  })

  it('renders outlet for an authorized membership role', () => {
    mockUseSession.mockReturnValue({ userRole: 'member' })
    renderGuard()
    expect(screen.getByText('Member Area')).toBeInTheDocument()
  })

  it('renders outlet for admin role as an allowed signed-in state', () => {
    mockUseSession.mockReturnValue({ userRole: 'admin' })
    renderGuard()
    expect(screen.getByText('Member Area')).toBeInTheDocument()
  })

  it('shows loading state for null userRole', () => {
    mockUseSession.mockReturnValue({ userRole: null })
    renderGuard()
    expect(screen.getByText('Loading your dashboard...')).toBeInTheDocument()
  })
})
