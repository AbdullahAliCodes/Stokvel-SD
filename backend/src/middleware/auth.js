import { supabase } from '../utils/supabase.js'

/** Treat Admin / ADMIN / admin as platform admin for routes and /api/me. */
export function normalizePlatformRole(role) {
  if (role == null || role === '') return 'user'
  if (String(role).toLowerCase() === 'admin') return 'admin'
  return String(role)
}

/** Network / TLS failures talking to Supabase Auth (not invalid JWT). */
function isAuthUpstreamFailure(err) {
  if (!err) return false
  const networkCodes = new Set([
    'ECONNREFUSED',
    'ENOTFOUND',
    'ETIMEDOUT',
    'ECONNRESET',
    'CERT_HAS_EXPIRED',
    'SELF_SIGNED_CERT_IN_CHAIN',
    'DEPTH_ZERO_SELF_SIGNED_CERT',
    'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  ])
  let e = err
  for (let i = 0; i < 8 && e; i += 1) {
    if (e.code && networkCodes.has(e.code)) return true
    const msg = String(e.message ?? '')
    if (/UNABLE_TO_VERIFY_LEAF_SIGNATURE/i.test(msg)) return true
    if (
      /certificate/i.test(msg) &&
      /verify|verification|invalid|unable/i.test(msg)
    ) {
      return true
    }
    if (i === 0 && /fetch failed/i.test(msg) && e.cause) {
      // Likely undici / Node fetch wrapping TLS or connection errors
      return true
    }
    e = e.cause
  }
  return false
}

function logAuthMiddlewareError(err, context) {
  console.error('[auth]', context, err?.message ?? err)
  if (err?.stack) console.error(err.stack)
  if (err?.cause != null) {
    console.error('[auth] cause:', err.cause?.message ?? err.cause)
    if (err.cause?.stack) console.error(err.cause.stack)
  }
}

/**
 * Supabase auth-js returns { error } (does not throw) when TLS/network breaks before JWT validation.
 * Those must be 503 — not 401 — or the app looks "logged out" while the real issue is connectivity.
 */
function isSupabaseAuthTransportError(error) {
  if (error == null || typeof error !== 'object') return false
  const msg = String(error.message ?? '')
  if (/fetch failed/i.test(msg)) return true
  if (/network error|failed to fetch|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ECONNRESET/i.test(msg))
    return true
  if (
    /certificate|TLS|SSL|UNABLE_TO_VERIFY/i.test(msg) &&
    /verify|invalid|unable|failed/i.test(msg)
  ) {
    return true
  }
  const name = String(error.name ?? '')
  if (/AuthRetryableFetchError|AuthUnknownError/i.test(name)) return true
  return false
}

export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Missing or malformed authorization header',
      })
    }

    const token = authHeader.slice('Bearer '.length).trim()
    if (!token) {
      return res.status(401).json({
        error: 'Missing or malformed authorization header',
      })
    }

    if (!supabase) {
      console.warn('[auth] Supabase anon client is not initialized')
      return res.status(503).json({
        error:
          'Authentication service temporarily unavailable (server configuration).',
      })
    }

    const { data, error } = await supabase.auth.getUser(token)

    if (error) {
      if (isSupabaseAuthTransportError(error)) {
        console.error('[auth] Supabase Auth unreachable:', error.message ?? error)
        return res.status(503).json({
          error:
            'Authentication service temporarily unavailable (network or TLS). Check API logs.',
        })
      }
      return res.status(401).json({
        error: error.message || 'Invalid token',
      })
    }

    if (!data?.user) {
      return res.status(401).json({
        error: 'Invalid token',
      })
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single()

    if (profileError) {
      console.error('[auth] Error fetching profile:', profileError.message ?? profileError)
    }

    req.user = { ...data.user, role: normalizePlatformRole(profile?.role) }
    next()
  } catch (err) {
    logAuthMiddlewareError(err, 'requireAuth unexpected error')
    if (isAuthUpstreamFailure(err)) {
      return res.status(503).json({
        error:
          'Authentication service temporarily unavailable (network or TLS). Check API logs.',
      })
    }
    res.status(500).json({
      error: 'Internal Server Error during authentication',
    })
  }
}
