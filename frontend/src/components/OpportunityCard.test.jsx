import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OpportunityCard from './OpportunityCard'

const baseProps = {
  name: 'Thrive Circle',
  subtitle: 'Community savings',
  metrics: [
    { label: 'Members', value: '12' },
    { label: 'Monthly', value: 'R500' },
  ],
  icon: 'users',
}

function renderCard(props = {}) {
  return render(
    <MemoryRouter>
      <OpportunityCard {...baseProps} {...props} />
    </MemoryRouter>,
  )
}

describe('OpportunityCard', () => {
  it('renders required props and default apply href', () => {
    renderCard()
    expect(screen.getByText('Thrive Circle')).toBeInTheDocument()
    expect(screen.getByText('Community savings')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('R500')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Apply to join' })).toHaveAttribute('href', '/auth')
  })

  it('uses custom applyHref when onApply is not provided', () => {
    renderCard({ applyHref: '/custom-apply' })
    expect(screen.getByRole('link', { name: 'Apply to join' })).toHaveAttribute(
      'href',
      '/custom-apply',
    )
  })

  it('renders button and calls custom onApply handler', async () => {
    const user = userEvent.setup()
    const onApply = vi.fn()
    renderCard({ onApply })
    await user.click(screen.getByRole('button', { name: 'Apply to join' }))
    expect(onApply).toHaveBeenCalledTimes(1)
  })

  it('shows joining state and disables button', () => {
    renderCard({ onApply: vi.fn(), isJoining: true })
    expect(screen.getByRole('button', { name: 'Joining...' })).toBeDisabled()
  })

  it('handles unknown icon and partial metrics safely', () => {
    renderCard({
      icon: 'unknown',
      metrics: [{ label: 'Members', value: '3' }],
    })
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.queryByText('R500')).not.toBeInTheDocument()
  })
})
