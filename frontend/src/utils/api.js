/**
 * Absolute API URL for production (Vercel → Render). Empty in local dev → relative `/api/...`
 * works with the Vite proxy.
 */
export function apiUrl(path) {
  const raw = import.meta.env.VITE_API_BASE_URL || ''
  const base = raw.replace(/\/$/, '')
  const p = path.startsWith('/') ? path : `/${path}`
  return base ? `${base}${p}` : p
}
