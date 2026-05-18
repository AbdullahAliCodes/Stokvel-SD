import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Inbox } from 'lucide-react'
import EmptyState from './EmptyState'

describe('EmptyState', () => {
  it('renders title and description', () => {
    render(
      <EmptyState
        icon={Inbox}
        title="Nothing here yet"
        description="Add your first item to get started."
      />,
    )

    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Nothing here yet' })).toBeInTheDocument()
    expect(screen.getByText(/Add your first item/i)).toBeInTheDocument()
  })

  it('renders optional action slot', () => {
    render(
      <EmptyState
        title="Empty"
        action={<button type="button">Create</button>}
        variant="card"
      />,
    )

    expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument()
  })
})
