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
    vi.spyOn(window, 'alert').mockImplementation(() => {})
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
