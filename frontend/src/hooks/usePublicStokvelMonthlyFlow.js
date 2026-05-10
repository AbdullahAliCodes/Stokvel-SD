import { useEffect, useState } from 'react'
import { apiUrl } from '../utils/api'

const DEMO_FALLBACK_TOTAL = 2_400_000

/**
 * Sums contribution_amount × members_count for public active stokvels (monthly flow proxy).
 * Falls back to a demo total when the API errors or returns no usable figures.
 */
export function usePublicStokvelMonthlyFlow() {
  const [total, setTotal] = useState(null)
  const [isFallback, setIsFallback] = useState(false)

  useEffect(() => {
    const ctrl = new AbortController()

    ;(async () => {
      try {
        const res = await fetch(apiUrl('/api/public/stokvels'), { signal: ctrl.signal })
        const text = await res.text()
        if (!res.ok) throw new Error('bad status')
        const rows = JSON.parse(text)
        if (!Array.isArray(rows) || rows.length === 0) {
          if (!ctrl.signal.aborted) {
            setTotal(DEMO_FALLBACK_TOTAL)
            setIsFallback(true)
          }
          return
        }
        let sum = 0
        for (const r of rows) {
          const amt = Number(r.contribution_amount)
          const n = Number(r.members_count)
          if (Number.isFinite(amt) && Number.isFinite(n)) sum += amt * n
        }
        if (!ctrl.signal.aborted) {
          if (sum > 0) {
            setTotal(sum)
            setIsFallback(false)
          } else {
            setTotal(DEMO_FALLBACK_TOTAL)
            setIsFallback(true)
          }
        }
      } catch {
        if (!ctrl.signal.aborted) {
          setTotal(DEMO_FALLBACK_TOTAL)
          setIsFallback(true)
        }
      }
    })()

    return () => ctrl.abort()
  }, [])

  return {
    /** `null` until the first fetch settles; then a non‑negative ZAR amount (demo fallback may apply). */
    amount: total,
    loading: total === null,
    isFallback,
  }
}
