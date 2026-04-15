import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY

const missingVars = [
  !supabaseUrl && 'SUPABASE_URL',
  !supabaseAnonKey && 'SUPABASE_ANON_KEY',
].filter(Boolean)

if (missingVars.length > 0) {
  throw new Error(
    `Missing required backend environment variables: ${missingVars.join(', ')}. ` +
      'Create backend/.env and set these values before starting the API.',
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
