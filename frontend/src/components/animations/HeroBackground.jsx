/** Same asset as navbar / BrandLogo — public path */
const MARK_SRC = '/stokvel-logo.png'

/**
 * Static STOKGELD security-style watermark: tiles the wordmark diagonally, very low contrast.
 * Sits above the hero gradient, below RandRain (z-index set by parent stacking context).
 */
export default function HeroBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 z-[1] overflow-hidden" aria-hidden>
      <div
        className="absolute left-1/2 top-1/2 h-[220%] w-[220%] opacity-[0.03]"
        style={{
          transform: 'translate(-50%, -50%) rotate(-25deg)',
          backgroundColor: '#2E7D32',
          WebkitMaskImage: `url(${MARK_SRC})`,
          maskImage: `url(${MARK_SRC})`,
          WebkitMaskSize: '180px auto',
          maskSize: '180px auto',
          WebkitMaskRepeat: 'repeat',
          maskRepeat: 'repeat',
        }}
      />
    </div>
  )
}
