import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import AdminLayout from './AdminLayout'

vi.mock('../utils/supabase', () => ({
  supabase: { auth: { signOut: vi.fn(async () => ({})) } },
}))

vi.mock('../components/BrandLogo', () => ({
  default: ({ to }) => <a href={to}>Logo</a>,
}))

vi.mock('../components/ThemeToggle', () => ({
  default: () => <div data-testid="theme-toggle" />,
}))

function renderLayout(initialPath) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={<AdminLayout />}>
          <Route path="/admin/groups" element={<div>Groups hub</div>} />
          <Route path="/admin/groups/:id/edit" element={<div>Edit group</div>} />
          <Route path="/admin/tickets" element={<div>Tickets page</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('AdminLayout back navigation', () => {
  it('hides back link on groups hub', () => {
    renderLayout('/admin/groups')
    expect(screen.getByText('Groups hub')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Back to groups' })).not.toBeInTheDocument()
  })

  it('shows back link on admin sub-pages', () => {
    renderLayout('/admin/groups/42/edit')
    expect(screen.getByText('Edit group')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to groups' })).toHaveAttribute(
      'href',
      '/admin/groups',
    )
  })

  it('shows back link on tickets route', () => {
    renderLayout('/admin/tickets')
    expect(screen.getByText('Tickets page')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to groups' })).toHaveAttribute(
      'href',
      '/admin/groups',
    )
  })
})
