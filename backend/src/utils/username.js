/** Lowercase 3–30 chars: letters, digits, underscore only. */
export function normalizeUsername(raw) {
  if (typeof raw !== 'string') return ''
  let s = raw.trim().toLowerCase().replace(/\s+/g, '_')
  s = s.replace(/[^a-z0-9_]/g, '')
  if (s.length < 3 || s.length > 30) return ''
  return s
}
