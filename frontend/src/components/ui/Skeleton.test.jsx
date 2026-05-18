import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Skeleton from './Skeleton'

describe('Skeleton', () => {
  it('mounts with default classes', () => {
    const { container } = render(<Skeleton className="h-4 w-full" />)
    const el = container.firstChild

    expect(el).toHaveAttribute('aria-hidden', 'true')
    expect(el).toHaveClass('animate-pulse')
    expect(el).toHaveClass('h-4')
  })

  it('applies numeric width and height styles', () => {
    const { container } = render(<Skeleton width={120} height={24} rounded="rounded-md" />)
    const el = container.firstChild

    expect(el).toHaveStyle({ width: '120px', height: '24px' })
    expect(el).toHaveClass('rounded-md')
  })
})
