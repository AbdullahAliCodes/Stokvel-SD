import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import BrandLogo from './BrandLogo'

vi.mock('react-router-dom', () => ({
  Link: ({ to, className, children, ...rest }) => (
    <a href={to} className={className} data-testid="brand-logo-link" {...rest}>
      {children}
    </a>
  ),
}))

describe('BrandLogo', () => {
  it('renders with default props and expected image metadata', () => {
    render(<BrandLogo />)

    const link = screen.getByTestId('brand-logo-link')
    const image = screen.getByRole('img', { name: 'StokGeld' })

    expect(link).toHaveAttribute('href', '/')
    expect(image).toHaveAttribute('src', '/stokvel-logo.png')
    expect(image).toHaveAttribute('decoding', 'async')
    expect(image).toHaveAttribute('alt', 'StokGeld')
  })

  it('applies default class names when no overrides are provided', () => {
    render(<BrandLogo />)

    const link = screen.getByTestId('brand-logo-link')
    const image = screen.getByRole('img', { name: 'StokGeld' })

    expect(link.className).toContain('flex shrink-0 items-center rounded-md')
    expect(link.className).toContain('focus-visible:ring-2')
    expect(image.className).toContain('h-10 w-auto md:h-12')
    expect(image.className).toContain('max-w-[min(100%,56rem)]')
    expect(image.className).not.toContain('brightness-0 invert')
  })

  it('uses custom destination and merges custom wrapper class names', () => {
    render(<BrandLogo to="/dashboard" className="mx-auto bg-red-100" />)

    const link = screen.getByTestId('brand-logo-link')

    expect(link).toHaveAttribute('href', '/dashboard')
    expect(link.className).toContain('mx-auto bg-red-100')
    expect(link.className).toContain('focus-visible:ring-emerald-600/40')
  })

  it('uses custom image class names when imgClassName is provided', () => {
    render(<BrandLogo imgClassName="h-16 max-h-24 custom-img" />)

    const image = screen.getByRole('img', { name: 'StokGeld' })

    expect(image.className).toContain('h-16 max-h-24 custom-img')
    expect(image.className).toContain('object-contain object-left')
  })

  it('adds dark-surface inversion classes when variant is onDark', () => {
    render(<BrandLogo variant="onDark" />)

    const image = screen.getByRole('img', { name: 'StokGeld' })

    expect(image.className).toContain('brightness-0 invert')
  })

  it('does not add dark-surface inversion classes for unknown variant values', () => {
    render(<BrandLogo variant="night-mode" />)

    const image = screen.getByRole('img', { name: 'StokGeld' })

    expect(image.className).not.toContain('brightness-0 invert')
  })

  it('forwards additional link props to the rendered link element', () => {
    render(
      <BrandLogo
        aria-label="Go to home"
        target="_blank"
        rel="noopener noreferrer"
        data-track-id="brand-logo"
      />,
    )

    const link = screen.getByTestId('brand-logo-link')

    expect(link).toHaveAttribute('aria-label', 'Go to home')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect(link).toHaveAttribute('data-track-id', 'brand-logo')
  })
})
