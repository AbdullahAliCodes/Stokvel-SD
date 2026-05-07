import { describe, it, expect } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import RequireAuth from './RequireAuth'

function renderWithRoutes(session) {
  return render(
    <MemoryRouter initialEntries={['/private']}>
      <Routes>
        <Route element={<RequireAuth session={session} />}>
          <Route path="/private" element={<div>Private Content</div>} />
        </Route>
        <Route path="/auth" element={<div>Auth Page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('RequireAuth', () => {
  it('renders outlet content when session exists', () => {
    renderWithRoutes({ user: { id: 'u-1' } })
    expect(screen.getByText('Private Content')).toBeInTheDocument()
  })

  it('redirects to /auth when session is null', () => {
    renderWithRoutes(null)
    expect(screen.getByText('Auth Page')).toBeInTheDocument()
  })
})
