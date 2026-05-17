import { describe, it, expect } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import PageBackNav from './PageBackNav'

function renderNav(props) {
  return render(
    <MemoryRouter>
      <PageBackNav {...props} />
    </MemoryRouter>,
  )
}

describe('PageBackNav', () => {
  it('renders a link with label and destination', () => {
    renderNav({ to: '/group/s1/dashboard', label: 'Back to dashboard' })
    const link = screen.getByRole('link', { name: 'Back to dashboard' })
    expect(link).toHaveAttribute('href', '/group/s1/dashboard')
  })

  it('uses default label when label is omitted', () => {
    renderNav({ to: '/dashboard' })
    expect(screen.getByRole('link', { name: 'Back to dashboard' })).toBeInTheDocument()
  })

  it('renders nothing when to is missing', () => {
    const { container } = renderNav({ to: null, label: 'Back to dashboard' })
    expect(container).toBeEmptyDOMElement()
  })

  it('applies optional className', () => {
    renderNav({ to: '/dashboard', className: 'mt-4' })
    expect(screen.getByRole('link', { name: 'Back to dashboard' })).toHaveClass('mt-4')
  })
})
