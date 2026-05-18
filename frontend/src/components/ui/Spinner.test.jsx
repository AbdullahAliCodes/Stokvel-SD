import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Spinner from './Spinner'

describe('Spinner', () => {
  it('renders with default md size and label', () => {
    render(<Spinner />)

    const spinner = screen.getByRole('status', { name: 'Loading' })
    expect(spinner).toBeInTheDocument()
    expect(spinner).toHaveClass('h-8')
    expect(spinner).toHaveClass('w-8')
  })

  it('renders custom size and label', () => {
    render(<Spinner size="lg" label="Preparing your workspace" className="mx-auto" />)

    const spinner = screen.getByRole('status', { name: 'Preparing your workspace' })
    expect(spinner).toHaveClass('h-12')
    expect(spinner).toHaveClass('mx-auto')
  })

  it('falls back to md size for unknown size key', () => {
    render(<Spinner size="unknown" />)

    expect(screen.getByRole('status')).toHaveClass('h-8')
  })
})
