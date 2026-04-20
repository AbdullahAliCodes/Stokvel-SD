import { render } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import AdminCreateStokvel from './AdminCreateStokvel'

// Mock the child component to check if it's rendered with the correct props
vi.mock('./CreateStokvelWizard', () => ({
  CreateStokvelWizard: (props) => <div data-testid="mock-create-stokvel-wizard" data-variant={props.variant} />
}))

describe('AdminCreateStokvel', () => {
  it('renders CreateStokvelWizard with variant="admin"', () => {
    const { getByTestId } = render(<AdminCreateStokvel />)
    const mockWizard = getByTestId('mock-create-stokvel-wizard')
    
    expect(mockWizard).toBeInTheDocument()
    expect(mockWizard).toHaveAttribute('data-variant', 'admin')
  })
})
