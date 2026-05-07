import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ThemeToggle from './ThemeToggle'

const { mockUseTheme } = vi.hoisted(() => ({
  mockUseTheme: vi.fn(),
}))

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => mockUseTheme(),
}))

describe('ThemeToggle', () => {
  beforeEach(() => {
    mockUseTheme.mockReset()
  })

  it('renders moon icon state and toggles from light mode', async () => {
    const user = userEvent.setup()
    const toggleTheme = vi.fn()
    mockUseTheme.mockReturnValue({ theme: 'light', toggleTheme })

    render(<ThemeToggle />)
    const btn = screen.getByRole('button', { name: 'Switch to dark mode' })
    expect(btn).toBeInTheDocument()
    await user.click(btn)
    expect(toggleTheme).toHaveBeenCalledTimes(1)
  })

  it('renders sun icon state when theme is dark', () => {
    mockUseTheme.mockReturnValue({ theme: 'dark', toggleTheme: vi.fn() })
    render(<ThemeToggle />)
    expect(screen.getByRole('button', { name: 'Switch to light mode' })).toBeInTheDocument()
  })

  it('uses sidebar class variant when requested', () => {
    mockUseTheme.mockReturnValue({ theme: 'light', toggleTheme: vi.fn() })
    render(<ThemeToggle layout="sidebar" />)
    const btn = screen.getByRole('button', { name: 'Switch to dark mode' })
    expect(btn.className).toContain('w-full')
  })
})
