import { createContext, useContext, useId } from 'react'

/** When true, banknotes skip SMIL + heavy SVG filters (smoother in stacked hero rain). */
const BankNoteRainSurfaceContext = createContext(false)

export function BankNoteRainSurface({ children }) {
  return <BankNoteRainSurfaceContext.Provider value={true}>{children}</BankNoteRainSurfaceContext.Provider>
}

const VIEW_W = 320
const VIEW_H = 160

/** Simplified Big Five silhouettes (right side, ~x 200–300). */
function RhinoSilhouette({ fill }) {
  return (
    <path
      fill={fill}
      opacity="0.88"
      d="M218 132l-4-18 8-12 14-6 18 2 12 10 6 16-6 10-16 4-20-2-12-14zm28-38l-6-22 12-8 10 2 8 14-2 14-12 6-10-6zm-42 8l-10-6-6-14 4-18 14-8 12 12-2 20-12 14z"
    />
  )
}

function ElephantSilhouette({ fill }) {
  return (
    <path
      fill={fill}
      opacity="0.88"
      d="M205 38c12-4 28-2 38 8 10 10 14 26 10 40l-6 28c-8 12-24 18-38 14-10-2-18-10-22-20l-6-34c-2-10 4-24 14-30l10-6zm48 52l16 18 8 20-4 12-14 6-12-2-8-16 4-24 10-14zm-62-8l-18-10-8-22 6-18 20-6 14 8 6 20-10 22-10 6z"
    />
  )
}

function LionSilhouette({ fill }) {
  return (
    <path
      fill={fill}
      opacity="0.88"
      d="M232 48c14-6 30 0 38 12 8 14 6 32-4 44l-10 22-18 12-22 2-16-10-6-26 4-32 10-16 16-12 8 4zm-8 58l-20 16-14 4-12-6-4-20 8-18 18-8 20 8 2 24zm28-46l12-8 10 4 4 14-8 16-14 6-10-8 6-24z"
    />
  )
}

function BuffaloSilhouette({ fill }) {
  return (
    <path
      fill={fill}
      opacity="0.88"
      d="M210 52c10-14 32-18 46-8 14 10 20 32 14 48l-8 26c-6 14-22 22-36 20l-20-4c-14-8-22-26-18-42l8-28 6-8 8-4zm-6 48l-14 26-16 8-12-2-6-22 10-20 18-6 20 16zm52-28l10 6 4 16-10 20-14 8-8-6 2-24 14-20 2-4z"
    />
  )
}

function LeopardSilhouette({ fill }) {
  return (
    <path
      fill={fill}
      opacity="0.88"
      d="M224 56c12-10 28-10 40 2 12 12 14 28 8 42l-14 28-24 14-22 2-18-12-4-28 8-32 14-20 12-6zm-4 56l2 22-10 14-16 6-14-8 2-24 14-16 22 6zm32-62l16-6 12 8 4 18-12 20-16 6-10-10 4-28 2-8z"
    />
  )
}

function GuillocheLayer({ stroke }) {
  const rings = []
  for (let i = 0; i < 14; i++) {
    const cx = 30 + (i % 4) * 90
    const cy = 20 + Math.floor(i / 4) * 45
    rings.push(
      <ellipse
        key={i}
        cx={cx}
        cy={cy}
        rx={26 + (i % 3) * 8}
        ry={36 - (i % 4) * 4}
        fill="none"
        stroke={stroke}
        strokeWidth="0.35"
        opacity="0.28"
      />,
    )
  }
  return (
    <g aria-hidden>
      {rings}
      <path
        d="M8 80 Q80 20 160 80 T312 80"
        fill="none"
        stroke={stroke}
        strokeWidth="0.3"
        opacity="0.22"
      />
      <path
        d="M8 100 Q120 140 200 60 T312 40"
        fill="none"
        stroke={stroke}
        strokeWidth="0.25"
        opacity="0.18"
      />
    </g>
  )
}

function MicroBorder({ stroke }) {
  return (
    <g aria-hidden>
      <rect x="5" y="5" width="310" height="150" fill="none" stroke={stroke} strokeWidth="0.55" rx="4" opacity="0.45" />
      <rect x="8" y="8" width="304" height="144" fill="none" stroke={stroke} strokeWidth="0.25" strokeDasharray="1.5 2.5" rx="3" opacity="0.35" />
    </g>
  )
}

/**
 * @param {{
 *   denom: string,
 *   dark: string,
 *   mid: string,
 *   light: string,
 *   accent: string,
 *   ink: string,
 *   inkMuted: string,
 *   Animal: React.ComponentType<{ fill: string }>,
 *   serial: string,
 * }} props
 */
function BankNoteArt({
  denom,
  dark,
  mid,
  light,
  accent,
  ink,
  inkMuted,
  Animal,
  serial,
}) {
  const isRain = useContext(BankNoteRainSurfaceContext)
  const uid = useId().replace(/:/g, '')
  const wm = denom.replace('R', '')

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      className="banknote-svg block h-full w-full"
      role="img"
      aria-label={`${denom} stylised note`}
      style={{ overflow: 'visible' }}
    >
      <defs>
        <linearGradient id={`${uid}-bg`} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={light} />
          <stop offset="45%" stopColor={mid} />
          <stop offset="100%" stopColor={dark} />
        </linearGradient>
        <linearGradient id={`${uid}-sheen`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.22" />
          <stop offset="40%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="55%" stopColor="#000000" stopOpacity="0.04" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.12" />
        </linearGradient>
        <linearGradient id={`${uid}-holo`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="35%" stopColor="#e8f5ff" stopOpacity="0.55" />
          <stop offset="50%" stopColor="#fffde7" stopOpacity="0.85" />
          <stop offset="65%" stopColor="#e3f2fd" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          {!isRain ? (
            <>
              <animate attributeName="x1" values="0%;100%;0%" dur="3.2s" repeatCount="indefinite" />
              <animate attributeName="x2" values="100%;200%;100%" dur="3.2s" repeatCount="indefinite" />
            </>
          ) : null}
        </linearGradient>
        <pattern id={`${uid}-grain`} width="4" height="4" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="0.35" fill="#000" opacity="0.04" />
          <circle cx="3" cy="2.5" r="0.25" fill="#fff" opacity="0.06" />
        </pattern>
        <filter id={`${uid}-paper`} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="2" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="0.6" xChannelSelector="R" yChannelSelector="G" result="disp" />
        </filter>
        <filter id={`${uid}-embossN`} x="-20%" y="-20%" width="140%" height="140%">
          <feMorphology in="SourceAlpha" operator="dilate" radius="0.4" result="dilated" />
          <feGaussianBlur in="dilated" stdDeviation="0.35" result="blur" />
          <feOffset dx="0.4" dy="0.4" in="blur" result="off" />
          <feFlood floodColor="#000000" floodOpacity="0.35" result="flood" />
          <feComposite in="flood" in2="off" operator="in" result="shadow" />
          <feMerge>
            <feMergeNode in="shadow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={`${uid}-shadow`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow
            dx="0"
            dy={isRain ? 5 : 10}
            stdDeviation={isRain ? 3.5 : 8}
            floodOpacity={isRain ? 0.2 : 0.32}
          />
        </filter>
      </defs>

      <g filter={`url(#${uid}-shadow)`}>
        <rect width={VIEW_W} height={VIEW_H} rx="5" fill={`url(#${uid}-bg)`} />
        <rect width={VIEW_W} height={VIEW_H} rx="5" fill={`url(#${uid}-sheen)`} style={{ mixBlendMode: 'soft-light' }} />

        {isRain ? (
          <GuillocheLayer stroke={accent} />
        ) : (
          <g filter={`url(#${uid}-paper)`}>
            <GuillocheLayer stroke={accent} />
          </g>
        )}

        <text
          x="160"
          y="88"
          textAnchor="middle"
          fill={dark}
          opacity="0.12"
          fontSize="120"
          fontWeight="800"
          fontFamily="system-ui, sans-serif"
          style={{ userSelect: 'none' }}
        >
          {wm}
        </text>

        <rect
          x="22"
          y="6"
          width="14"
          height="148"
          rx="1.5"
          fill={`url(#${uid}-holo)`}
          opacity="0.92"
          className={isRain ? 'banknote-holo-strip banknote-holo-strip--rain' : 'banknote-holo-strip'}
        />
        <line x1="29" y1="8" x2="29" y2="152" stroke={inkMuted} strokeWidth="1.2" opacity="0.35" strokeDasharray="3 2" />

        {/* Full-height windowed security thread */}
        <line
          x1="176"
          y1="10"
          x2="176"
          y2="150"
          stroke={accent}
          strokeWidth="1"
          opacity="0.38"
          strokeDasharray="4 3 1 3"
          strokeLinecap="round"
        />
        <line x1="176" y1="10" x2="176" y2="150" stroke="#ffffff" strokeWidth="0.35" opacity="0.22" strokeDasharray="6 8" />

        <MicroBorder stroke={inkMuted} />

        <text
          x="160"
          y="22"
          textAnchor="middle"
          fill={ink}
          fontSize="11"
          fontWeight="700"
          letterSpacing="3"
          fontFamily="system-ui, sans-serif"
        >
          STOKVEL-SD
        </text>

        <g>
          <circle cx="108" cy="88" r="48" fill="rgba(255,255,255,0.14)" stroke="rgba(255,255,255,0.5)" strokeWidth="1.35" />
          <circle cx="108" cy="88" r="39" fill="rgba(255,255,255,0.09)" />
          <text
            x="108"
            y="101"
            textAnchor="middle"
            fill="white"
            fontSize="38"
            fontWeight="800"
            fontFamily="Georgia, serif"
            style={
              isRain
                ? { opacity: 0.98 }
                : { filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.65))' }
            }
          >
            SD
          </text>
        </g>

        {isRain ? (
          <g>
            <text x="14" y="44" fill={ink} fontSize="28" fontWeight="900" fontFamily="system-ui, sans-serif">
              {denom}
            </text>
            <text x="228" y="148" fill={ink} fontSize="34" fontWeight="900" fontFamily="system-ui, sans-serif" textAnchor="end">
              {denom}
            </text>
          </g>
        ) : (
          <g filter={`url(#${uid}-embossN)`}>
            <text x="14" y="44" fill={ink} fontSize="28" fontWeight="900" fontFamily="system-ui, sans-serif">
              {denom}
            </text>
            <text x="228" y="148" fill={ink} fontSize="34" fontWeight="900" fontFamily="system-ui, sans-serif" textAnchor="end">
              {denom}
            </text>
          </g>
        )}

        <Animal fill={dark} />

        <text x="16" y="150" fill={inkMuted} fontSize="5.5" fontFamily="monospace" opacity="0.9">
          {serial}
        </text>

        <text x="12" y="155" fill={inkMuted} fontSize="3.8" fontFamily="system-ui, sans-serif" opacity="0.55">
          STOKVEL-SD • STOKVEL-SD • STOKVEL-SD • STOKVEL-SD • STOKVEL-SD • STOKVEL-SD • STOKVEL-SD • STOKVEL-SD
        </text>
      </g>
    </svg>
  )
}

export function BankNoteR10() {
  return (
    <BankNoteArt
      denom="R10"
      dark="#1565C0"
      mid="#42A5F5"
      light="#E3F2FD"
      accent="#0D47A1"
      ink="#0D1B2A"
      inkMuted="#1565C0"
      Animal={RhinoSilhouette}
      serial="SD 2025 4891023"
    />
  )
}

export function BankNoteR20() {
  return (
    <BankNoteArt
      denom="R20"
      dark="#B71C1C"
      mid="#EF5350"
      light="#FFCDD2"
      accent="#7F0000"
      ink="#3E0A0A"
      inkMuted="#B71C1C"
      Animal={ElephantSilhouette}
      serial="SD 2025 7729104"
    />
  )
}

export function BankNoteR50() {
  return (
    <BankNoteArt
      denom="R50"
      dark="#1B5E20"
      mid="#43A047"
      light="#C8E6C9"
      accent="#0D3D12"
      ink="#0D1F0F"
      inkMuted="#1B5E20"
      Animal={LionSilhouette}
      serial="SD 2025 3381049"
    />
  )
}

export function BankNoteR100() {
  return (
    <BankNoteArt
      denom="R100"
      dark="#E65100"
      mid="#FB8C00"
      light="#FFE0B2"
      accent="#BF360C"
      ink="#3E1A00"
      inkMuted="#E65100"
      Animal={BuffaloSilhouette}
      serial="SD 2025 9018472"
    />
  )
}

export function BankNoteR200() {
  return (
    <BankNoteArt
      denom="R200"
      dark="#4E342E"
      mid="#8D6E63"
      light="#D7CCC8"
      accent="#3E2723"
      ink="#1E100C"
      inkMuted="#5D4037"
      Animal={LeopardSilhouette}
      serial="SD 2025 2203891"
    />
  )
}

export const BANK_NOTE_COMPONENTS = [
  BankNoteR10,
  BankNoteR20,
  BankNoteR50,
  BankNoteR100,
  BankNoteR200,
]
