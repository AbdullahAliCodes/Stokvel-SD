import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import TableScrollArea from './TableScrollArea'

describe('TableScrollArea', () => {
  const originalResizeObserver = global.ResizeObserver

  beforeEach(() => {
    global.ResizeObserver = class {
      observe() {}
      disconnect() {}
      unobserve() {}
    }
  })

  afterEach(() => {
    global.ResizeObserver = originalResizeObserver
  })

  it('renders children inside the scroll region', () => {
    render(
      <TableScrollArea>
        <table>
          <tbody>
            <tr>
              <td>Row</td>
            </tr>
          </tbody>
        </table>
      </TableScrollArea>,
    )
    expect(screen.getByText('Row')).toBeInTheDocument()
  })

  it('shows the swipe hint when the table overflows horizontally', () => {
    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
      configurable: true,
      get() {
        return 900
      },
    })
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get() {
        return 320
      },
    })
    Object.defineProperty(HTMLElement.prototype, 'scrollLeft', {
      configurable: true,
      get() {
        return 0
      },
    })

    render(
      <TableScrollArea hint="Swipe sideways to see all columns">
        <table>
          <tbody>
            <tr>
              <td>Wide</td>
            </tr>
          </tbody>
        </table>
      </TableScrollArea>,
    )

    expect(screen.getByText('Swipe sideways to see all columns')).toBeInTheDocument()
  })
})
