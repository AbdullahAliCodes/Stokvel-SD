import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import Apply from './Apply'

// Mock the child component to check if it's rendered with the correct props
vi.mock('./CreateStokvelWizard', () => ({
  CreateStokvelWizard: (props) => <div data-testid="mock-create-stokvel-wizard" data-variant={props.variant} />
}))

describe('Apply', () => {
  it('renders CreateStokvelWizard with variant="member"', () => {
    render(<Apply />)
    const mockWizard = screen.getByTestId('mock-create-stokvel-wizard')
    
    expect(mockWizard).toBeInTheDocument()
    expect(mockWizard).toHaveAttribute('data-variant', 'member')
  })
})
