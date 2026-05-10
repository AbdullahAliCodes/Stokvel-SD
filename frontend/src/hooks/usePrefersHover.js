import { useEffect, useState } from 'react'

/** True when the device supports hover (fine pointer), e.g. not touch-primary. */
export function usePrefersHover() {
  const [prefersHover, setPrefersHover] = useState(true)
  useEffect(() => {
    const mq = window.matchMedia('(hover: hover)')
    const apply = () => setPrefersHover(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])
  return prefersHover
}
