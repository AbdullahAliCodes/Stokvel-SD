import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals'

const mockCreateClient = jest.fn()
const ORIGINAL_ENV = { ...process.env }

async function loadGetServiceSupabase() {
  jest.unstable_mockModule('@supabase/supabase-js', () => ({
    createClient: mockCreateClient,
  }))
  const mod = await import('./supabaseAdmin.js')
  return mod.getServiceSupabase
}

describe('getServiceSupabase', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
    process.env = { ...ORIGINAL_ENV }
    delete process.env.SUPABASE_URL
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
  })

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  it('returns null when SUPABASE_URL is missing', async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'
    const getServiceSupabase = await loadGetServiceSupabase()

    const result = getServiceSupabase()

    expect(result).toBeNull()
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('returns null when SUPABASE_SERVICE_ROLE_KEY is missing', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co'
    const getServiceSupabase = await loadGetServiceSupabase()

    const result = getServiceSupabase()

    expect(result).toBeNull()
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('returns null when env vars are empty strings', async () => {
    process.env.SUPABASE_URL = ''
    process.env.SUPABASE_SERVICE_ROLE_KEY = ''
    const getServiceSupabase = await loadGetServiceSupabase()

    const result = getServiceSupabase()

    expect(result).toBeNull()
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('creates and returns service client when env vars are set', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'
    const fakeClient = { tag: 'service-client' }
    mockCreateClient.mockReturnValue(fakeClient)
    const getServiceSupabase = await loadGetServiceSupabase()

    const result = getServiceSupabase()

    expect(mockCreateClient).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'service-role-key',
      {
        auth: { persistSession: false, autoRefreshToken: false },
      },
    )
    expect(result).toBe(fakeClient)
  })

  it('memoizes client and does not recreate on subsequent calls', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'
    const fakeClient = { tag: 'service-client' }
    mockCreateClient.mockReturnValue(fakeClient)
    const getServiceSupabase = await loadGetServiceSupabase()

    const first = getServiceSupabase()
    const second = getServiceSupabase()

    expect(first).toBe(fakeClient)
    expect(second).toBe(fakeClient)
    expect(mockCreateClient).toHaveBeenCalledTimes(1)
  })
})
