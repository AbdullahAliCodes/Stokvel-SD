import { useId } from 'react'
import { pageSubtitle } from '../../ui'

function gaugeStroke(grade) {
  switch (String(grade || '')) {
    case 'Excellent':
      return '#047857'
    case 'Good':
      return '#ca8a04'
    case 'Fair':
      return '#ea580c'
    case 'At Risk':
      return '#b91c1c'
    default:
      return '#57534e'
  }
}

/** Semi-circle arc gauge (0–100), SVG — no chart libraries. */
export default function ScoreGauge({ score, grade, size = 'default' }) {
  const gradId = useId().replace(/:/g, '')
  const r = size === 'compact' ? 42 : 54
  const arcLen = Math.PI * r
  const pct = Math.min(100, Math.max(0, Number(score)))
  const filled = (pct / 100) * arcLen
  const stroke = gaugeStroke(grade)
  const compact = size === 'compact'

  const viewW = compact ? 112 : 140
  const viewH = compact ? 72 : 90
  const cx = viewW / 2
  const cy = compact ? 64 : 82
  const strokeW = compact ? 10 : 12
  const arcPath = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`

  return (
    <div className={`relative mx-auto flex shrink-0 items-end justify-center ${compact ? 'h-28 w-32' : 'h-36 w-44'}`}>
      <svg
        viewBox={`0 0 ${viewW} ${viewH}`}
        className="h-full w-full overflow-visible"
        aria-hidden
      >
        <defs>
          <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.95" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0.55" />
          </linearGradient>
        </defs>
        <path
          d={arcPath}
          fill="none"
          stroke="#e7e5e4"
          strokeWidth={strokeW}
          strokeLinecap="round"
          className="dark:stroke-slate-700"
        />
        <path
          d={arcPath}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={strokeW}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${arcLen}`}
          style={{ transition: 'stroke-dasharray 0.45s ease' }}
        />
      </svg>
      <div
        className={`pointer-events-none absolute inset-x-0 flex flex-col items-center text-center ${compact ? 'bottom-0' : 'bottom-2'}`}
      >
        <span
          className={`font-bold tabular-nums tracking-tight text-stone-900 dark:text-stone-50 ${compact ? 'text-2xl' : 'text-3xl'}`}
        >
          {Math.round(pct)}
        </span>
        <span className={`${pageSubtitle} mt-0.5 ${compact ? 'text-[11px]' : ''}`}>
          ML health score
        </span>
      </div>
    </div>
  )
}
