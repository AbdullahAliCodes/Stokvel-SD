import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Skeleton from './Skeleton'

describe('Skeleton', () => {
  it('renders with default pulse classes', () => {
    const { container } = render(<Skeleton className="h-4 w-24" />)
    const el = container.firstChild

    expect(el).toHaveClass('animate-pulse')
    expect(el).toHaveClass('h-4')
    expect(el).toHaveAttribute('aria-hidden', 'true')
  })

  it('applies numeric width and height styles', () => {
    const { container } = render(<Skeleton width={120} height={32} rounded="rounded-full" />)
    const el = container.firstChild

    expect(el).toHaveStyle({ width: '120px', height: '32px' })
    expect(el).toHaveClass('rounded-full')
  })
})
