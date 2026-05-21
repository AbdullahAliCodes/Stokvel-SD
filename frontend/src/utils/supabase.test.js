import { beforeEach, describe, expect, it, vi } from 'vitest'

const createClientMock = vi.fn(() => ({ auth: {} }))

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args) => createClientMock(...args),
}))

describe('supabase client', () => {
  beforeEach(() => {
    vi.resetModules()
    createClientMock.mockClear()
    vi.unstubAllEnvs()
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co/')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key')
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY', 'anon-key')
  })

  it('normalizes the Supabase URL and passes env keys to createClient', async () => {
    const { supabase } = await import('./supabase.js')

    expect(createClientMock).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'anon-key',
    )
    expect(supabase).toEqual({ auth: {} })
  })

  it('re-exports the client from supabaseClient.js', async () => {
    const client = await import('../supabaseClient.js')
    const { supabase: direct } = await import('./supabase.js')
    expect(client.supabase).toBe(direct)
  })
})
