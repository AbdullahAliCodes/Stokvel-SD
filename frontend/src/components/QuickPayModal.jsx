import { useEffect, useRef, useState } from 'react'
import { apiUrl } from '../utils/api'
import { btnPrimary, btnSecondary, cardLight, inputLight } from '../ui'

function parseApiError(text) {
  try {
    const json = JSON.parse(text)
    return json.error || text || 'Request failed'
  } catch {
    return text || 'Request failed'
  }
}

export default function QuickPayModal({
  groupName,
  stokvelId,
  session,
  monthlyContribution,
  onSuccess,
  onClose,
  onRecordError,
  onDebugStep,
}) {
  const [amount, setAmount] = useState(String(monthlyContribution || ''))
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [paystackReady, setPaystackReady] = useState(Boolean(window.PaystackPop?.setup))
  const paystackRef = useRef(window.PaystackPop ?? null)
  const paystackFormRef = useRef(null)
  const parsedAmount = Number(amount)
  const paystackAmount = Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount * 100 : 0

  useEffect(() => {
    if (window.PaystackPop?.setup) {
      paystackRef.current = window.PaystackPop
      setPaystackReady(true)
      return
    }
    const existing = document.querySelector('script[data-paystack-inline="true"]')
    const onLoad = () => {
      paystackRef.current = window.PaystackPop ?? null
      setPaystackReady(Boolean(window.PaystackPop?.setup))
    }
    const onError = () => {
      setPaystackReady(false)
      setError('Could not load Paystack.')
      onDebugStep?.('Paystack script failed to load')
    }
    if (existing) {
      existing.addEventListener('load', onLoad)
      existing.addEventListener('error', onError)
      return () => {
        existing.removeEventListener('load', onLoad)
        existing.removeEventListener('error', onError)
      }
    }
    const script = document.createElement('script')
    script.src = 'https://js.paystack.co/v1/inline.js'
    script.async = true
    script.dataset.paystackInline = 'true'
    script.addEventListener('load', onLoad)
    script.addEventListener('error', onError)
    const parent = paystackFormRef.current || document.body
    parent.appendChild(script)
    return () => {
      script.removeEventListener('load', onLoad)
      script.removeEventListener('error', onError)
    }
  }, [onDebugStep])

  async function verifyAndRecord(transaction, parsedAmountLocal) {
    const reference = transaction?.reference || transaction?.trxref || transaction?.trans || null
    setLoading(true)
    try {
      if (!reference) {
        throw new Error('Payment completed but reference is missing.')
      }
      const res = await fetch(apiUrl(`/api/stokvels/${stokvelId}/payments/verify`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ reference, amount: parsedAmountLocal }),
      })
      const text = await res.text()
      let json = {}
      try {
        json = text ? JSON.parse(text) : {}
      } catch {
        json = {}
      }
      if (!res.ok) throw new Error(parseApiError(text))
      if (!json?.success) throw new Error('Payment was verified but could not be recorded.')
      onSuccess(parsedAmountLocal, json.contribution ?? null)
      onClose()
    } catch (e) {
      setError(e.message)
      onRecordError?.(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e) {
    e?.preventDefault?.()
    onDebugStep?.('Pay Now clicked')
    if (!amount || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid amount')
      onDebugStep?.('Validation failed: invalid amount')
      return
    }
    setError(null)
    onDebugStep?.('Opening Paystack popup')
    try {
      const paystack = paystackRef.current
      if (!paystackReady || !paystack?.setup) {
        throw new Error('Paystack is still loading. Please try again.')
      }
      const handler = paystack.setup({
        key: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY,
        email: session.user.email,
        amount: paystackAmount,
        currency: 'ZAR',
        ref: `${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
        callback: (transaction) => {
          void verifyAndRecord(transaction, parsedAmount)
        },
        onClose: () => {
          onDebugStep?.('Paystack popup closed/cancelled')
          setError('Payment was cancelled')
        },
      })
      handler.openIframe()
      onDebugStep?.('Paystack popup opened')
    } catch (e) {
      const message = e?.message || 'Could not open Paystack popup.'
      onDebugStep?.(`Popup open failed: ${message}`)
      setError(message)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4">
      <form
        ref={paystackFormRef}
        onSubmit={handleSubmit}
        className={`${cardLight} w-full max-w-sm p-6`}
      >
        <h2 className="mb-4 text-lg font-bold text-stone-800">Quick Pay</h2>
        <p className="mb-4 text-sm text-stone-600">
          Contributing to <strong className="text-stone-800">{groupName}</strong>
        </p>
        <input
          type="number"
          min="1"
          placeholder="Amount (R)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className={`${inputLight} mb-4`}
        />
        {error && <p className="mb-3 text-xs text-red-700">{error}</p>}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className={`${btnPrimary} flex-1 py-2 text-sm disabled:opacity-50`}
          >
            {loading ? 'Recording…' : !paystackReady ? 'Loading payment…' : 'Pay Now'}
          </button>
          <button type="button" onClick={onClose} className={`${btnSecondary} flex-1 py-2 text-sm`}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
