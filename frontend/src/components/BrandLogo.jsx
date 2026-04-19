import { Link } from "react-router-dom";

const logoSrc = "/stokvel-logo.png";

/**
 * Brand mark from `public/` (e.g. stokvel-logo.png). Scale with `imgClassName` via Tailwind `h-*` / `max-h-*`.
 * `variant="onDark"` — inverts for contrast on dark emerald panels (footer, auth aside).
 */
export default function BrandLogo({
  to = "/",
  className = "",
  imgClassName = "h-10 w-auto md:h-12",
  variant = "default",
  ...linkProps
}) {
  const onDark = variant === "onDark";
  return (
    <Link
      to={to}
      className={`flex shrink-0 items-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 ${className}`}
      {...linkProps}
    >
      <img
        src={logoSrc}
        alt="StokGeld"
        className={`${imgClassName} w-auto max-w-[min(100%,56rem)] shrink-0 object-contain object-left ${onDark ? "brightness-0 invert" : ""}`}
        decoding="async"
      />
    </Link>
  );
}
