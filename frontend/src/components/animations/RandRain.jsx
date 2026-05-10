import { useMemo, useState, useCallback } from 'react'
import { useReducedMotion } from 'framer-motion'
import { BANK_NOTE_COMPONENTS, BankNoteRainSurface } from './BankNotes'

/** Balanced: in spec range 25–35 while keeping frame time stable. */
const PARTICLE_COUNT = 26

function hashSeed(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h)
}

function FallingNote({ particle }) {
  const { Note, leftPct, duration, delay, scale, opacity, rotA, spinTurns } = particle
  const rotEnd = rotA + spinTurns * 360
  const reduce = useReducedMotion()
  const [spinning, setSpinning] = useState(false)
  const [ripples, setRipples] = useState([])

  const onClick = useCallback(
    (e) => {
      if (reduce) return
      const el = e.currentTarget
      const rect = el.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const id = Date.now() + Math.random()
      setRipples((r) => [...r, { id, x, y }])
      window.setTimeout(() => setRipples((r) => r.filter((k) => k.id !== id)), 580)
      setSpinning(true)
      window.setTimeout(() => setSpinning(false), 400)
    },
    [reduce],
  )

  return (
    <div
      className={`rand-rain-fall rand-rain-note absolute top-0 ${spinning ? 'rand-rain-note--spin' : ''}`}
      style={{
        left: `${leftPct}%`,
        width: `${5.8 * scale}rem`,
        zIndex: Math.round(scale * 40),
        opacity,
        ['--rand-y0']: '-24vh',
        ['--rand-y1']: '132vh',
        ['--rand-r0']: `${rotA}deg`,
        ['--rand-r1']: `${rotEnd}deg`,
        animationDuration: `${duration}s`,
        animationDelay: `${delay}s`,
      }}
      onClick={onClick}
      role="presentation"
    >
      <div className="rand-rain-note-face relative aspect-[2/1] w-full [transform:translateZ(0)]">
        {ripples.map((r) => (
          <span
            key={r.id}
            className="rand-rain-ripple"
            style={{ left: r.x, top: r.y }}
            aria-hidden
          />
        ))}
        <BankNoteRainSurface>
          <Note />
        </BankNoteRainSurface>
      </div>
    </div>
  )
}

function RearPile() {
  const layers = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => ({
      Note: BANK_NOTE_COMPONENTS[i % BANK_NOTE_COMPONENTS.length],
      rot: ((i * 17) % 22) - 11,
      x: (i % 4) * 5 - 7,
      y: i * 2.8,
      scale: 0.26 + (i % 3) * 0.02,
    }))
  }, [])

  return (
    <div
      className="pointer-events-none absolute bottom-0 left-1/2 z-[5] w-[min(100%,480px)]"
      aria-hidden
    >
      <div className="relative mx-auto h-16 w-full sm:h-20">
        {layers.map((L, i) => (
          <div
            key={i}
            className="absolute left-1/2 w-[5.5rem] sm:w-[6rem]"
            style={{
              bottom: L.y,
              marginLeft: L.x,
              transform: `translateX(-50%) rotate(${L.rot}deg)`,
              transformOrigin: '50% 100%',
              opacity: 0.58 + (i % 4) * 0.07,
              zIndex: i,
            }}
          >
            <div className="relative aspect-[2/1] w-full" style={{ transform: `translateZ(0) scale(${L.scale})` }}>
              <BankNoteRainSurface>
                <L.Note />
              </BankNoteRainSurface>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Rand rain: CSS keyframe motion + optional hover / click affordances on notes.
 */
export default function RandRain() {
  const reduce = useReducedMotion()

  const particles = useMemo(() => {
    return Array.from({ length: PARTICLE_COUNT }, (_, i) => {
      const seed = hashSeed(`stokvel-rain-${i}`)
      const Note = BANK_NOTE_COMPONENTS[(i * 3 + (seed % 97)) % BANK_NOTE_COMPONENTS.length]
      const scale = 0.42 + (seed % 700) / 1000
      const leftPct = 3 + (seed % 900) / 10
      const duration = 3 + (seed % 4000) / 1000
      const delay = (seed % 3200) / 1000
      const opacity = 0.72 + (seed % 280) / 1000
      const rotA = -26 + (seed % 5200) / 100
      const spinTurns = 0.65 + (seed % 120) / 100

      return {
        id: `rain-${i}`,
        Note,
        leftPct,
        duration,
        delay,
        scale,
        opacity,
        rotA,
        spinTurns,
      }
    })
  }, [])

  if (reduce) {
    return (
      <div
        className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-b from-emerald-100/45 via-white to-teal-50/40"
        aria-hidden
      />
    )
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-emerald-50/88 via-white/72 to-teal-50/6" />

      <div className="pointer-events-none absolute inset-0 [contain:layout_style] [isolation:isolate]">
        {particles.map((p) => (
          <FallingNote key={p.id} particle={p} />
        ))}
      </div>

      <RearPile />
    </div>
  )
}
