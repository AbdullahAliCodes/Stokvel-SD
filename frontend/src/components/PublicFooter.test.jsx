import { describe, it, expect } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import PublicFooter from './PublicFooter'

function renderFooter() {
  return render(
    <MemoryRouter>
      <PublicFooter />
    </MemoryRouter>,
  )
}

describe('PublicFooter', () => {
  it('renders core sections and branding copy', () => {
    renderFooter()
    expect(screen.getByText('Company')).toBeInTheDocument()
    expect(screen.getByText('Support')).toBeInTheDocument()
    expect(
      screen.getByText(/Community-first savings circles with transparent tools/i),
    ).toBeInTheDocument()
  })

  it('renders internal links with valid hrefs', () => {
    renderFooter()

    expect(screen.getByRole('link', { name: 'How it works' })).toHaveAttribute('href', '/#how')
    expect(screen.getAllByRole('link', { name: 'Create account' })[0]).toHaveAttribute(
      'href',
      '/auth',
    )
    expect(screen.getByRole('link', { name: 'Contact' })).toHaveAttribute(
      'href',
      '/#footer-support',
    )
    expect(screen.getByRole('link', { name: 'Help centre (sign in)' })).toHaveAttribute(
      'href',
      '/auth',
    )
    expect(screen.getByRole('link', { name: 'Browse groups' })).toHaveAttribute(
      'href',
      '/stokvels',
    )
  })

  it('renders legal links and current year notice', () => {
    renderFooter()
    expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '#privacy')
    expect(screen.getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '#terms')
    expect(screen.getByText(new RegExp(String(new Date().getFullYear())))).toBeInTheDocument()
  })
})
