const PREFIX = 'stokvel_cache_v1:'

function keyFor(key) {
  return `${PREFIX}${key}`
}

export function readViewCache(key, maxAgeMs = 120000) {
  try {
    const raw = sessionStorage.getItem(keyFor(key))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const ts = Number(parsed.ts || 0)
    if (!ts || Date.now() - ts > maxAgeMs) return null
    return parsed.data ?? null
  } catch {
    return null
  }
}

export function writeViewCache(key, data) {
  try {
    sessionStorage.setItem(
      keyFor(key),
      JSON.stringify({
        ts: Date.now(),
        data,
      }),
    )
  } catch {
    // ignore storage limits/private mode errors
  }
}
