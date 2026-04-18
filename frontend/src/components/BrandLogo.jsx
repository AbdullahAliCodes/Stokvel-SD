import { Link } from 'react-router-dom'
import logoSrc from '../assets/stokgeld-logo.png'

/**
 * Official StokGeld wordmark (transparent PNG). Scale with `imgClassName` using Tailwind `h-*` / `max-h-*`.
 * `variant="onDark"` — inverts for contrast on dark emerald panels (footer, auth aside).
 */
export default function BrandLogo({
  to = '/',
  className = '',
  imgClassName = 'h-32 w-auto md:h-40',
  variant = 'default',
  ...linkProps
}) {
  const onDark = variant === 'onDark'
  return (
    <Link
      to={to}
      className={`inline-flex shrink-0 items-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 ${className}`}
      {...linkProps}
    >
      <img
        src={logoSrc}
        alt="StokGeld"
        className={`${imgClassName} w-auto max-w-[min(100%,56rem)] shrink-0 object-contain object-left ${onDark ? 'brightness-0 invert' : ''}`}
        decoding="async"
      />
    </Link>
  )
}
