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
}) {
  const [amount, setAmount] = useState(String(monthlyContribution || ''))
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [paystackReady, setPaystackReady] = useState(Boolean(window.PaystackPop?.setup))
  const paystackRef = useRef(window.PaystackPop ?? null)
  const paystackFormRef = useRef(null)
  const callbackFiredRef = useRef(false)
  // On-screen debug log visible inside the modal
  const [debugLog, setDebugLog] = useState([])
  const parsedAmount = Number(amount)
  const paystackAmount = Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount * 100 : 0

  function addDebug(msg) {
    const ts = new Date().toLocaleTimeString()
    setDebugLog((prev) => [...prev, `[${ts}] ${msg}`])
    console.log('[QuickPay]', msg)
  }

  useEffect(() => {
    if (window.PaystackPop?.setup) {
      paystackRef.current = window.PaystackPop
      setPaystackReady(true)
      addDebug('PaystackPop already loaded')
      return
    }
    const existing = document.querySelector('script[data-paystack-inline="true"]')
    const onLoad = () => {
      paystackRef.current = window.PaystackPop ?? null
      const ready = Boolean(window.PaystackPop?.setup)
      setPaystackReady(ready)
      addDebug(`Paystack script loaded, ready=${ready}`)
    }
    const onError = () => {
      setPaystackReady(false)
      setError('Could not load Paystack.')
      addDebug('Paystack script FAILED to load')
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
    document.body.appendChild(script)
    addDebug('Loading Paystack script...')
    return () => {
      script.removeEventListener('load', onLoad)
      script.removeEventListener('error', onError)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function verifyAndRecord(transaction, parsedAmountLocal) {
    const reference = transaction?.reference || transaction?.trxref || transaction?.trans || null
    addDebug(`verifyAndRecord: ref=${reference}`)
    setLoading(true)
    try {
      if (!reference) {
        throw new Error('Payment completed but reference is missing.')
      }
      const url = apiUrl(`/api/stokvels/${stokvelId}/payments/verify`)
      addDebug(`POST ${url}`)
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ reference, amount: parsedAmountLocal }),
      })
      const text = await res.text()
      addDebug(`Response: ${res.status} — ${text.slice(0, 200)}`)
      let json = {}
      try {
        json = text ? JSON.parse(text) : {}
      } catch {
        json = {}
      }
      if (!res.ok) throw new Error(parseApiError(text))
      if (!json?.success) throw new Error('Payment was verified but could not be recorded.')
      addDebug('SUCCESS — contribution recorded!')
      onSuccess(parsedAmountLocal, json.contribution ?? null)
      onClose()
    } catch (e) {
      addDebug(`ERROR: ${e.message}`)
      console.error('[QuickPay] verifyAndRecord error:', e)
      setError(e.message)
      onRecordError?.(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e) {
    e?.preventDefault?.()
    addDebug('Pay Now clicked')
    if (!amount || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid amount')
      addDebug('Validation failed: invalid amount')
      return
    }
    setError(null)
    callbackFiredRef.current = false
    addDebug('Opening Paystack popup...')
    try {
      const paystack = paystackRef.current
      if (!paystackReady || !paystack?.setup) {
        throw new Error('Paystack is still loading. Please try again.')
      }
      const key = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY
      addDebug(`Paystack key: ${key ? key.slice(0, 12) + '...' : 'MISSING!'}`)
      addDebug(`Email: ${session.user.email}, Amount: ${paystackAmount} kobo`)
      const ref = `${Date.now()}-${Math.floor(Math.random() * 1000000)}`
      addDebug(`Generated ref: ${ref}`)
      const handler = paystack.setup({
        key,
        email: session.user.email,
        amount: paystackAmount,
        currency: 'ZAR',
        ref,
        callback: (transaction) => {
          // This alert CANNOT be missed — it proves the callback fired
          window.alert(`Paystack callback fired! ref: ${transaction?.reference || transaction?.trxref || 'none'}`)
          addDebug(`CALLBACK fired: ${JSON.stringify(transaction)}`)
          callbackFiredRef.current = true
          void verifyAndRecord(transaction, parsedAmount)
        },
        onClose: () => {
          if (callbackFiredRef.current) {
            addDebug('onClose after callback — ignoring')
            return
          }
          addDebug('Popup closed/cancelled by user')
          setError('Payment was cancelled')
        },
      })
      handler.openIframe()
      addDebug('Paystack popup opened')
    } catch (e) {
      const message = e?.message || 'Could not open Paystack popup.'
      addDebug(`Popup FAILED: ${message}`)
      console.error('[QuickPay] Popup open failed:', e)
      setError(message)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4">
      <div className={`${cardLight} w-full max-w-sm p-6`}>
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
        {error && <p className="mb-3 text-xs text-red-700 dark:text-red-300">{error}</p>}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className={`${btnPrimary} flex-1 py-2 text-sm disabled:opacity-50`}
          >
            {loading ? 'Recording…' : !paystackReady ? 'Loading payment…' : 'Pay Now'}
          </button>
          <button type="button" onClick={onClose} className={`${btnSecondary} flex-1 py-2 text-sm`}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
