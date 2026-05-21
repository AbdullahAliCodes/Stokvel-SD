import { useCallback, useEffect, useRef, useState } from 'react'
import { MoveHorizontal } from 'lucide-react'
import { tableWrap } from '../../ui'

/**
 * Horizontally scrollable table shell with edge fades + mobile hint when content overflows.
 */
export default function TableScrollArea({
  children,
  className = '',
  hint = 'Swipe sideways to see all columns',
}) {
  const scrollRef = useRef(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const updateScrollHints = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const { scrollLeft, scrollWidth, clientWidth } = el
    const overflow = scrollWidth > clientWidth + 2
    setCanScrollLeft(overflow && scrollLeft > 4)
    setCanScrollRight(overflow && scrollLeft < scrollWidth - clientWidth - 4)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    updateScrollHints()
    let ro = null
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(updateScrollHints)
      ro.observe(el)
    }
    el.addEventListener('scroll', updateScrollHints, { passive: true })
    window.addEventListener('resize', updateScrollHints)
    return () => {
      ro?.disconnect()
      el.removeEventListener('scroll', updateScrollHints)
      window.removeEventListener('resize', updateScrollHints)
    }
  }, [updateScrollHints, children])

  const showMobileCue = canScrollLeft || canScrollRight

  return (
    <div className={`relative ${className}`.trim()}>
      <div
        ref={scrollRef}
        className={`${tableWrap} scroll-smooth [-webkit-overflow-scrolling:touch]`}
      >
        {children}
      </div>
      {canScrollLeft ? (
        <div
          className="pointer-events-none absolute inset-y-0 left-0 z-[1] w-8 rounded-l-2xl bg-gradient-to-r from-white to-transparent dark:from-slate-900 dark:to-transparent md:hidden"
          aria-hidden
        />
      ) : null}
      {canScrollRight ? (
        <div
          className="pointer-events-none absolute inset-y-0 right-0 z-[1] w-10 rounded-r-2xl bg-gradient-to-l from-white via-white/80 to-transparent dark:from-slate-900 dark:via-slate-900/80 dark:to-transparent md:hidden"
          aria-hidden
        />
      ) : null}
      {showMobileCue ? (
        <p className="mt-1.5 flex items-center justify-center gap-1.5 text-xs text-stone-500 dark:text-stone-400 md:hidden">
          <MoveHorizontal
            className="h-3.5 w-3.5 shrink-0 text-emerald-700 dark:text-emerald-400"
            aria-hidden
          />
          <span>{hint}</span>
        </p>
      ) : null}
    </div>
  )
}
