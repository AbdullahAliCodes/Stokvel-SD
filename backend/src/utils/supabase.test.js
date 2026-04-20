import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals'

const mockCreateClient = jest.fn()
const ORIGINAL_ENV = { ...process.env }

async function importSupabaseModule() {
  jest.unstable_mockModule('dotenv/config', () => ({}))
  jest.unstable_mockModule('@supabase/supabase-js', () => ({
    createClient: mockCreateClient,
  }))
  return import('./supabase.js')
}

describe('supabase module', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
    process.env = { ...ORIGINAL_ENV }
    delete process.env.SUPABASE_URL
    delete process.env.SUPABASE_ANON_KEY
  })

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  it('throws with both variable names when SUPABASE_URL and SUPABASE_ANON_KEY are missing', async () => {
    await expect(importSupabaseModule()).rejects.toThrow(
      'Missing required backend environment variables: SUPABASE_URL, SUPABASE_ANON_KEY.',
    )
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('throws with SUPABASE_URL when only URL is missing', async () => {
    process.env.SUPABASE_ANON_KEY = 'anon-key'

    await expect(importSupabaseModule()).rejects.toThrow(
      'Missing required backend environment variables: SUPABASE_URL.',
    )
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('throws with SUPABASE_ANON_KEY when only anon key is missing', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co'

    await expect(importSupabaseModule()).rejects.toThrow(
      'Missing required backend environment variables: SUPABASE_ANON_KEY.',
    )
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('treats empty strings as missing env values', async () => {
    process.env.SUPABASE_URL = ''
    process.env.SUPABASE_ANON_KEY = ''

    await expect(importSupabaseModule()).rejects.toThrow(
      'Missing required backend environment variables: SUPABASE_URL, SUPABASE_ANON_KEY.',
    )
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('exports supabase client created with URL and anon key when env vars are present', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_ANON_KEY = 'anon-key'
    const fakeClient = { tag: 'supabase-client' }
    mockCreateClient.mockReturnValue(fakeClient)

    const mod = await importSupabaseModule()

    expect(mockCreateClient).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'anon-key',
    )
    expect(mod.supabase).toBe(fakeClient)
  })
})
