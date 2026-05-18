import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Spinner from './Spinner'

describe('Spinner', () => {
  it('renders with default accessible label', () => {
    render(<Spinner />)

    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
  })

  it('supports custom size and label', () => {
    render(<Spinner size="lg" label="Saving" className="mx-auto" />)

    const spinner = screen.getByRole('status', { name: 'Saving' })
    expect(spinner).toHaveClass('h-12', 'w-12', 'mx-auto')
  })
})
