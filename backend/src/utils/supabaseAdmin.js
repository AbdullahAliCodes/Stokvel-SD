import { createClient } from '@supabase/supabase-js'

let serviceClient = null

/**
 * Service-role client (bypasses RLS). Set SUPABASE_SERVICE_ROLE_KEY in backend .env
 * for admin mutations and Auth Admin email lookup when profiles.email is missing.
 */
export function getServiceSupabase() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  if (!serviceClient) {
    serviceClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return serviceClient
}
