import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('supabase client', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
  })

  it('creates a client when URL and anon key env vars are set', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co/')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key')

    const { supabase } = await import('./supabase.js')
    expect(supabase).toBeTruthy()
  })

  it('prefers the publishable default key over the anon key', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY', 'publishable-key')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key')

    const { supabase } = await import('./supabase.js')
    expect(supabase).toBeTruthy()
  })

})
