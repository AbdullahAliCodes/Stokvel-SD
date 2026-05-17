/** Shared detection for transport/TLS/init failures when talking to Supabase (PostgREST or Auth-style errors). */

const TLS_CODES = new Set([
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'CERT_HAS_EXPIRED',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
])

const NETWORK_CODES = new Set([
  'ECONNREFUSED',
  'ENOTFOUND',
  'ETIMEDOUT',
  'ECONNRESET',
  'EAI_AGAIN',
])

export function isTransportLayerFailure(errLike) {
  if (errLike == null) return false
  if (errLike.code === 'SUPABASE_CLIENT_UNAVAILABLE') return true

  let e = errLike
  for (let i = 0; i < 8 && e; i += 1) {
    const msg = String(e.message ?? '')
    if (/fetch failed/i.test(msg)) return true
    if (/network error|failed to fetch/i.test(msg)) return true
    if (NETWORK_CODES.has(e.code)) return true
    if (e.code && TLS_CODES.has(e.code)) return true
    if (/UNABLE_TO_VERIFY_LEAF_SIGNATURE/i.test(msg)) return true
    if (
      /certificate/i.test(msg) &&
      /verify|verification|invalid|unable/i.test(msg)
    ) {
      return true
    }
    e = e.cause
  }
  return false
}

export function logSupabaseClientInitFailure(context, err) {
  const msg = err instanceof Error ? err.message : String(err)
  console.warn(
    `[${context}] Supabase createClient failed:`,
    msg,
    err instanceof Error && err.stack ? `\n${err.stack}` : '',
  )
  if (isTransportLayerFailure(err)) {
    console.warn(
      `[${context}] If this persists, check corporate TLS interception (NODE_EXTRA_CA_CERTS) or outbound HTTPS to Supabase.`,
    )
  }
}

/**
 * Respond consistently for Supabase failures: 503 for transport/TLS/client init, else 500 with a readable message.
 */
export function sendSupabaseFailure(res, errLike, context = 'supabase') {
  if (errLike?.code === 'SUPABASE_CLIENT_UNAVAILABLE') {
    console.warn(`[${context}]`, errLike.message ?? errLike)
    res.status(503).json({
      error:
        'Database client unavailable. Verify SUPABASE_URL and SUPABASE_ANON_KEY, then retry.',
    })
    return
  }

  if (isTransportLayerFailure(errLike)) {
    const msg = String(errLike?.message ?? errLike ?? '')
    console.warn(`[${context}] Supabase unreachable (network/TLS):`, msg)
    res.status(503).json({
      error:
        'Database temporarily unavailable. Check network connectivity and TLS to Supabase.',
    })
    return
  }

  const msg = String(errLike?.message ?? errLike ?? 'Database request failed.')
  const code = errLike?.code != null ? String(errLike.code) : ''
  console.error(
    `[${context}]`,
    msg,
    code ? `(code ${code})` : '',
    errLike?.details != null ? String(errLike.details) : '',
  )
  res.status(500).json({
    error: msg === '[object Object]' ? 'Database request failed.' : msg,
  })
}
