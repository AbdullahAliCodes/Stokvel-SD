import { useEffect, useRef, useState } from 'react'
import { animate, useReducedMotion } from 'framer-motion'
import { formatRand } from '../../utils/formatZar'

/**
 * @param {{ value: number, loading?: boolean, className?: string, label: string, 'aria-label'?: string, tone?: 'dark' | 'light' }} props
 */
export default function LiveMoneyCounter({
  value,
  loading = false,
  className = '',
  label,
  'aria-label': ariaLabel,
  tone = 'dark',
}) {
  const reduce = useReducedMotion()
  const [display, setDisplay] = useState(0)
  const prevTarget = useRef(0)
  const readyRef = useRef(false)

  const targetNum = Number(value)

  useEffect(() => {
    if (loading) return
    if (!Number.isFinite(targetNum)) return
    if (reduce) {
      prevTarget.current = targetNum
      readyRef.current = true
      return
    }

    const from = readyRef.current ? prevTarget.current : 0
    prevTarget.current = targetNum
    readyRef.current = true

    const controls = animate(from, targetNum, {
      duration: 2.15,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setDisplay(v),
    })

    return () => controls.stop()
  }, [targetNum, loading, reduce])

  const shown = loading
    ? 0
    : reduce && Number.isFinite(targetNum)
      ? targetNum
      : display
  const text = formatRand(shown)

  const labelCls =
    tone === 'light'
      ? 'text-xs font-medium uppercase tracking-[0.22em] text-emerald-800/85'
      : 'text-xs font-medium uppercase tracking-[0.22em] text-[#D4AF37]/90'

  const valueCls =
    tone === 'light'
      ? 'mt-2 font-serif text-4xl font-semibold tabular-nums tracking-tight text-emerald-950 sm:text-5xl md:text-6xl'
      : 'mt-2 font-serif text-4xl font-semibold tabular-nums tracking-tight text-[#F5F0E8] sm:text-5xl md:text-6xl'

  return (
    <div className={className}>
      <p className={labelCls}>{label}</p>
      <p
        className={valueCls}
        aria-live="polite"
        aria-busy={loading}
        aria-label={ariaLabel ?? `${label}: ${text}`}
      >
        {text}
      </p>
    </div>
  )
}
