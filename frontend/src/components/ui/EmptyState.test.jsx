import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BarChart3 } from 'lucide-react'
import EmptyState from './EmptyState'

describe('EmptyState', () => {
  it('renders dashed variant with icon, description, and action', () => {
    render(
      <EmptyState
        icon={BarChart3}
        title="Nothing here"
        description="Add data to get started."
        action={<button type="button">Add item</button>}
      />,
    )

    expect(screen.getByRole('status')).toHaveClass('border-dashed')
    expect(screen.getByText('Nothing here')).toBeInTheDocument()
    expect(screen.getByText('Add data to get started.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add item' })).toBeInTheDocument()
  })

  it('renders card variant without optional slots', () => {
    render(<EmptyState title="Card shell" variant="card" />)

    expect(screen.getByRole('status')).toHaveClass('p-8')
    expect(screen.getByText('Card shell')).toBeInTheDocument()
    expect(screen.queryByText(/Add data/i)).not.toBeInTheDocument()
  })
})
