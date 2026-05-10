import { motion as M, useReducedMotion } from 'framer-motion'

/**
 * Stylised generic banknote (not country-specific) — layered gradients read as paper + ink at a glance.
 * @param {{ variant?: number, className?: string }} props
 */
function GenericBill({ variant = 0, className = '' }) {
  const v = variant % 3
  const schemes = [
    {
      face: 'from-[#f8f5ee] via-[#e6efe6] to-[#d5e3d8]',
      strip: 'bg-emerald-700/40',
      ink: 'text-emerald-950',
      num: '100',
    },
    {
      face: 'from-[#f5f7fb] via-[#e6eaf2] to-[#d8e0ed]',
      strip: 'bg-sky-700/35',
      ink: 'text-slate-900',
      num: '50',
    },
    {
      face: 'from-[#faf6ed] via-[#f0e8d8] to-[#e5dcc8]',
      strip: 'bg-amber-800/30',
      ink: 'text-amber-950',
      num: '200',
    },
  ]
  const s = schemes[v]

  return (
    <div
      className={`relative h-full w-full overflow-hidden rounded-[2px] border border-black/[0.14] ${className}`}
      style={{
        boxShadow:
          'inset 0 1px 0 rgba(255,255,255,0.65), inset 0 -1px 0 rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.12)',
      }}
      aria-hidden
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${s.face}`} />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-white/25 via-transparent to-transparent"
        style={{ mixBlendMode: 'soft-light' }}
      />
      <div className={`absolute bottom-[7%] left-[15%] top-[7%] w-[5%] rounded-[1px] ${s.strip} opacity-85`} />
      <div className="absolute left-[8%] top-[10%] h-[10%] w-[18%] rounded-sm bg-black/[0.05]" />
      <div className="absolute right-[9%] top-[11%] h-[54%] w-[30%] rounded-[999px] bg-gradient-to-br from-stone-200/55 to-stone-500/30 shadow-inner ring-1 ring-black/10" />
      <div className="absolute bottom-[10%] left-[10%] right-[36%] top-[24%] bg-[repeating-linear-gradient(90deg,transparent,transparent_2px,rgba(0,0,0,0.03)_2px,rgba(0,0,0,0.03)_3px)] opacity-40" />
      <span
        className={`absolute bottom-1.5 right-2 font-serif text-base font-bold tabular-nums tracking-tight drop-shadow-sm sm:text-lg ${s.ink}`}
      >
        {s.num}
      </span>
      <div className="absolute inset-x-0 top-0 h-[9%] bg-gradient-to-b from-black/[0.07] to-transparent" />
    </div>
  )
}

const DENOM_VARIANT_CYCLE = [0, 1, 2, 0, 1]

/**
 * @param {{
 *   index: number,
 *   layer: { scale: number, blurPx: number, opacity: number, durationMul: number },
 *   zIndex: number,
 * }} props
 */
function FallingBill({ index, layer, zIndex }) {
  const left = ((index * 47 + zIndex * 19) % 86) + 7
  const baseDur = (10 + (index % 6) * 0.75) * layer.durationMul
  const delay = (index % 12) * 0.26 + (zIndex % 3) * 0.12
  const variant = DENOM_VARIANT_CYCLE[(index + zIndex) % DENOM_VARIANT_CYCLE.length]
  const filter =
    layer.blurPx > 0 ? `blur(${layer.blurPx}px) saturate(${0.9 + layer.scale * 0.1})` : 'saturate(1.03)'

  return (
    <M.div
      className="pointer-events-none absolute top-0 w-[4.35rem] sm:w-[4.6rem]"
      style={{
        left: `${left}%`,
        zIndex,
        opacity: layer.opacity,
        filter,
        transformStyle: 'preserve-3d',
        willChange: 'transform, opacity, filter',
      }}
      initial={{
        y: '-16%',
        rotateX: 18 + (index % 5) * 5,
        rotateY: -14 + (index % 4) * 6,
        rotate: -5 + (index % 4) * 2,
        x: 0,
      }}
      animate={{
        y: ['-16%', '36vh', '115vh'],
        rotateX: [18, -30, 16],
        rotateY: [-14, 24, -10],
        rotate: [-5, 12, -4],
        x: [0, 18, -12],
      }}
      transition={{
        duration: baseDur,
        delay,
        repeat: Infinity,
        repeatDelay: 0.45 + (index % 6) * 0.22,
        times: [0, 0.4, 1],
        ease: ['easeOut', [0.46, 0.04, 0.74, 0.99]],
      }}
    >
      <div
        className="origin-[50%_0%]"
        style={{
          transform: `scale(${layer.scale})`,
          transformStyle: 'preserve-3d',
          boxShadow:
            layer.blurPx < 0.5
              ? '0 32px 52px -12px rgba(12, 36, 28, 0.42), 0 10px 24px -10px rgba(12, 36, 28, 0.28)'
              : '0 20px 36px -16px rgba(12, 36, 28, 0.3)',
        }}
      >
        <div className="aspect-[2.12/1] w-full">
          <GenericBill variant={variant} />
        </div>
      </div>
    </M.div>
  )
}

function DepthLayer({ config, zBase }) {
  const { key, count, scale, blurPx, opacity, durationMul } = config
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ zIndex: zBase, transform: 'translateZ(0)' }}
      aria-hidden
    >
      {Array.from({ length: count }).map((_, i) => (
        <FallingBill key={`${key}-${i}`} index={i} layer={{ scale, blurPx, opacity, durationMul }} zIndex={zBase + i} />
      ))}
    </div>
  )
}

function PileHeap() {
  const pieces = 9
  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 z-[80] flex h-28 items-end justify-center sm:h-32"
      aria-hidden
    >
      {Array.from({ length: pieces }).map((_, i) => {
        const rot = ((i * 19) % 20) - 10
        const variant = i % 3
        return (
          <M.div
            key={i}
            className="relative w-[2.35rem] overflow-hidden rounded-[2px] opacity-95 shadow-lg shadow-emerald-950/25 sm:w-[2.55rem]"
            style={{
              zIndex: 100 + i,
              marginLeft: i === 0 ? 0 : -13,
              transformStyle: 'preserve-3d',
            }}
            initial={{ y: 40, opacity: 0, rotate: rot, rotateX: 12 }}
            animate={{ y: -i * 2.1, opacity: 1, rotate: rot, rotateX: 8 }}
            transition={{
              type: 'spring',
              stiffness: 108,
              damping: 19,
              delay: 0.28 + i * 0.048,
            }}
          >
            <div className="aspect-[2.12/1] w-full">
              <GenericBill variant={variant} />
            </div>
          </M.div>
        )
      })}
    </div>
  )
}

/** Layered depth-of-field bill rain: far layers smaller + softer; near layer sharp. Immersive, pointer-safe. */
export default function RandRainBackground() {
  const reduce = useReducedMotion()

  if (reduce) {
    return (
      <div
        className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-b from-emerald-100/55 via-white/90 to-teal-50/50"
        aria-hidden
      />
    )
  }

  const layers = [
    { key: 'far', count: 16, scale: 0.5, blurPx: 7, opacity: 0.48, durationMul: 1.38 },
    { key: 'mid', count: 12, scale: 0.72, blurPx: 2.5, opacity: 0.68, durationMul: 1.08 },
    { key: 'near', count: 8, scale: 1, blurPx: 0, opacity: 0.94, durationMul: 0.86 },
  ]

  return (
    <div
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      style={{
        perspective: '1400px',
        perspectiveOrigin: '50% 28%',
      }}
      aria-hidden
    >
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/85 via-white/70 to-teal-100/55" />
      <div className="absolute inset-0 transform-gpu [transform-style:preserve-3d]">
        {layers.map((cfg, i) => (
          <DepthLayer key={cfg.key} config={cfg} zBase={i * 30} />
        ))}
      </div>
      <PileHeap />
    </div>
  )
}
