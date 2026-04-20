import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import AdminPlaceholder from './AdminPlaceholder'

describe('AdminPlaceholder', () => {
  it('renders the provided title correctly', () => {
    const testTitle = 'System Analytics'
    render(<AdminPlaceholder title={testTitle} />)

    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toHaveTextContent(testTitle)
    expect(heading).toHaveClass('text-emerald-800')

    expect(screen.getByText('No information available')).toBeInTheDocument()
  })

  it('renders without crashing when title is undefined', () => {
    const { container } = render(<AdminPlaceholder />)
    
    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toBeEmptyDOMElement()
    
    expect(screen.getByText('No information available')).toBeInTheDocument()
  })

  it('renders without crashing when title is null', () => {
    const { container } = render(<AdminPlaceholder title={null} />)
    
    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toBeEmptyDOMElement()
    
    expect(screen.getByText('No information available')).toBeInTheDocument()
  })

  it('renders without crashing when title is an empty string', () => {
    render(<AdminPlaceholder title="" />)
    
    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toBeEmptyDOMElement()
    
    expect(screen.getByText('No information available')).toBeInTheDocument()
  })
})
