import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Inbox } from 'lucide-react'
import EmptyState from './EmptyState'

describe('EmptyState', () => {
  it('renders title and description in dashed variant', () => {
    render(
      <EmptyState
        icon={Inbox}
        title="Nothing here yet"
        description="Add your first record to get started."
      />,
    )

    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Nothing here yet' })).toBeInTheDocument()
    expect(screen.getByText(/Add your first record/i)).toBeInTheDocument()
  })

  it('renders optional action and card variant', () => {
    render(
      <EmptyState
        title="No results"
        variant="card"
        action={<button type="button">Create item</button>}
      />,
    )

    expect(screen.getByRole('heading', { name: 'No results' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create item' })).toBeInTheDocument()
  })
})
