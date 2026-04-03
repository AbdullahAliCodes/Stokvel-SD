import { createClient } from '@supabase/supabase-js'

function normalizeSupabaseUrl(url) {
  const u = String(url ?? '').trim()
  return u.replace(/\/+$/, '')
}

const supabaseUrl = normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL)
const supabaseKey = String(
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
    import.meta.env.VITE_SUPABASE_ANON_KEY ??
    ''
).trim()

export const supabase = createClient(supabaseUrl, supabaseKey)
