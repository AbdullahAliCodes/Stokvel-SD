import { Loader2 } from 'lucide-react'

const SIZE_CLASS = {
  xs: 'h-3 w-3',
  sm: 'h-4 w-4',
  md: 'h-8 w-8',
  lg: 'h-12 w-12',
}

export default function Spinner({
  size = 'md',
  className = '',
  label = 'Loading',
}) {
  const sizeClass = SIZE_CLASS[size] ?? SIZE_CLASS.md
  return (
    <Loader2
      role="status"
      aria-label={label}
      className={`animate-spin text-emerald-600 dark:text-emerald-400 ${sizeClass} ${className}`.trim()}
    />
  )
}
