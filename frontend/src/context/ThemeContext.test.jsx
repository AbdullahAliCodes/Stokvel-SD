import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ThemeProvider, useTheme } from './ThemeContext'

function ThemeConsumer() {
  const { theme, toggleTheme } = useTheme()
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <button type="button" onClick={toggleTheme}>
        toggle
      </button>
    </div>
  )
}

describe('ThemeContext', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
  })

  it('uses stored theme when present', () => {
    localStorage.setItem('stokvel-theme', 'dark')

    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>,
    )

    expect(screen.getByTestId('theme')).toHaveTextContent('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('falls back to system preference and toggles theme', () => {
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>,
    )

    expect(screen.getByTestId('theme')).toHaveTextContent('dark')
    fireEvent.click(screen.getByRole('button', { name: 'toggle' }))
    expect(screen.getByTestId('theme')).toHaveTextContent('light')
    expect(localStorage.getItem('stokvel-theme')).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('throws when useTheme is used outside provider', () => {
    function BadConsumer() {
      useTheme()
      return null
    }
    expect(() => render(<BadConsumer />)).toThrow(/must be used within ThemeProvider/i)
  })
})
