import { createClient } from '@supabase/supabase-js'
import { logSupabaseClientInitFailure } from './supabaseErrors.js'

let serviceClient = null

export function tryCreateSupabaseClient(url, key, options = {}, context = 'supabase') {
  const u = typeof url === 'string' ? url.trim() : ''
  const k = typeof key === 'string' ? key.trim() : ''
  if (!u || !k) return null
  try {
    return createClient(u, k, options)
  } catch (err) {
    logSupabaseClientInitFailure(context, err)
    return null
  }
}

/**
 * User JWT–scoped anon client (RLS). Returns null if env/token missing or createClient throws.
 * Call after requireAuth so Bearer token is present.
 */
export function createUserJwtSupabase(req, context = 'user-scoped supabase') {
  const authHeader = req?.headers?.authorization
  const raw = typeof authHeader === 'string' ? authHeader.trim() : ''
  const m = /^Bearer\s+(\S+)/i.exec(raw)
  const token = m?.[1]?.trim() ?? ''
  const url =
    typeof process.env.SUPABASE_URL === 'string'
      ? process.env.SUPABASE_URL.trim()
      : ''
  const anon =
    typeof process.env.SUPABASE_ANON_KEY === 'string'
      ? process.env.SUPABASE_ANON_KEY.trim()
      : ''
  if (!token) {
    console.warn(
      `[${context}] Cannot create Supabase client: missing Bearer token`,
    )
    return null
  }
  if (!url || !anon) {
    console.warn(
      `[${context}] Cannot create Supabase client: SUPABASE_URL or SUPABASE_ANON_KEY unset`,
    )
    return null
  }
  return tryCreateSupabaseClient(
    url,
    anon,
    {
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
    },
    context,
  )
}

/**
 * Service-role client (bypasses RLS). Set SUPABASE_SERVICE_ROLE_KEY in backend .env
 * for admin mutations and Auth Admin email lookup when profiles.email is missing.
 */
export function getServiceSupabase() {
  const url = typeof process.env.SUPABASE_URL === 'string'
    ? process.env.SUPABASE_URL.trim()
    : ''
  const key =
    typeof process.env.SUPABASE_SERVICE_ROLE_KEY === 'string'
      ? process.env.SUPABASE_SERVICE_ROLE_KEY.trim()
      : ''
  if (!url || !key) return null
  if (!serviceClient) {
    serviceClient = tryCreateSupabaseClient(
      url,
      key,
      {
        auth: { persistSession: false, autoRefreshToken: false },
      },
      'getServiceSupabase',
    )
    if (!serviceClient) return null
  }
  return serviceClient
}
