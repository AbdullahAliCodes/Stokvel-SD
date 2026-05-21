import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import QuickPayModal from './QuickPayModal'

function baseProps(overrides = {}) {
  return {
    groupName: 'Ubuntu Circle',
    stokvelId: 'stokvel-1',
    session: { access_token: 'token-1', user: { email: 'member@example.com' } },
    monthlyContribution: 500,
    onSuccess: vi.fn(),
    onClose: vi.fn(),
    onRecordError: vi.fn(),
    ...overrides,
  }
}

describe('QuickPayModal', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    delete window.PaystackPop
  })

  it('shows validation error for invalid amount', async () => {
    const user = userEvent.setup()
    window.PaystackPop = { setup: vi.fn() }
    render(<QuickPayModal {...baseProps({ monthlyContribution: '' })} />)

    const amountInput = screen.getByPlaceholderText('Amount (R)')
    await user.clear(amountInput)
    await user.click(screen.getByRole('button', { name: 'Pay Now' }))

    expect(screen.getByText('Please enter a valid amount')).toBeInTheDocument()
  })

  it('handles not-ready paystack state', async () => {
    const user = userEvent.setup()
    render(<QuickPayModal {...baseProps()} />)

    expect(screen.getByRole('button', { name: 'Loading payment…' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Loading payment…' }))
    expect(screen.getByText('Paystack is still loading. Please try again.')).toBeInTheDocument()
  })

  it('submits successful payment and calls onSuccess + onClose', async () => {
    const setup = vi.fn(({ callback }) => ({
      openIframe: () => callback({ reference: 'pay-ref-123' }),
    }))
    window.PaystackPop = { setup }
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ success: true, contribution: { id: 'c1' } }),
    })

    const props = baseProps()
    const user = userEvent.setup()
    render(<QuickPayModal {...props} />)

    await user.clear(screen.getByPlaceholderText('Amount (R)'))
    await user.type(screen.getByPlaceholderText('Amount (R)'), '750')
    await user.click(screen.getByRole('button', { name: 'Pay Now' }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(1)
      expect(props.onSuccess).toHaveBeenCalledWith(750, { id: 'c1' })
      expect(props.onClose).toHaveBeenCalledTimes(1)
    })
  })

  it('shows API error message from JSON payload and calls onRecordError', async () => {
    const setup = vi.fn(({ callback }) => ({
      openIframe: () => callback({ reference: 'pay-ref-err' }),
    }))
    window.PaystackPop = { setup }
    fetch.mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({ error: 'Payment outside valid window' }),
    })

    const props = baseProps()
    const user = userEvent.setup()
    render(<QuickPayModal {...props} />)
    await user.click(screen.getByRole('button', { name: 'Pay Now' }))

    await waitFor(() => {
      expect(screen.getByText('Payment outside valid window')).toBeInTheDocument()
      expect(props.onRecordError).toHaveBeenCalledWith('Payment outside valid window')
    })
  })

  it('reports missing Paystack reference after callback', async () => {
    const setup = vi.fn(({ callback }) => ({
      openIframe: () => callback({}),
    }))
    window.PaystackPop = { setup }

    const props = baseProps()
    const user = userEvent.setup()
    render(<QuickPayModal {...props} />)
    await user.click(screen.getByRole('button', { name: 'Pay Now' }))

    await waitFor(() => {
      expect(screen.getByText('Payment completed but reference is missing.')).toBeInTheDocument()
      expect(props.onRecordError).toHaveBeenCalledWith('Payment completed but reference is missing.')
    })
  })

  it('uses trxref when reference is absent', async () => {
    const setup = vi.fn(({ callback }) => ({
      openIframe: () => callback({ trxref: 'trxref-only' }),
    }))
    window.PaystackPop = { setup }
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ success: true, contribution: { id: 'c2' } }),
    })

    const props = baseProps()
    const user = userEvent.setup()
    render(<QuickPayModal {...props} />)
    await user.click(screen.getByRole('button', { name: 'Pay Now' }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/payments/verify'),
        expect.objectContaining({
          body: expect.stringContaining('trxref-only'),
        }),
      )
      expect(props.onSuccess).toHaveBeenCalled()
    })
  })

  it('shows error when verify succeeds but success flag is false', async () => {
    const setup = vi.fn(({ callback }) => ({
      openIframe: () => callback({ reference: 'pay-no-success' }),
    }))
    window.PaystackPop = { setup }
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ success: false }),
    })

    const props = baseProps()
    const user = userEvent.setup()
    render(<QuickPayModal {...props} />)
    await user.click(screen.getByRole('button', { name: 'Pay Now' }))

    await waitFor(() => {
      expect(
        screen.getByText('Payment was verified but could not be recorded.'),
      ).toBeInTheDocument()
    })
  })

  it('shows cancelled message when the popup closes without a callback', async () => {
    const setup = vi.fn(({ onClose }) => ({
      openIframe: () => onClose?.(),
    }))
    window.PaystackPop = { setup }

    const user = userEvent.setup()
    render(<QuickPayModal {...baseProps()} />)
    await user.click(screen.getByRole('button', { name: 'Pay Now' }))

    expect(await screen.findByText('Payment was cancelled')).toBeInTheDocument()
  })

  it('parses plain-text API errors when response is not JSON', async () => {
    const setup = vi.fn(({ callback }) => ({
      openIframe: () => callback({ reference: 'pay-ref-plain' }),
    }))
    window.PaystackPop = { setup }
    fetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Internal gateway timeout',
    })

    const props = baseProps()
    const user = userEvent.setup()
    render(<QuickPayModal {...props} />)
    await user.click(screen.getByRole('button', { name: 'Pay Now' }))

    await waitFor(() => {
      expect(screen.getByText('Internal gateway timeout')).toBeInTheDocument()
      expect(props.onRecordError).toHaveBeenCalledWith('Internal gateway timeout')
    })
  })
})
