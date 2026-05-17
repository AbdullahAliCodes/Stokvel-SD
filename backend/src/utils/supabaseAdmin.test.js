import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals'

const mockCreateClient = jest.fn()
const ORIGINAL_ENV = { ...process.env }

async function loadSupabaseAdminModule() {
  jest.unstable_mockModule('@supabase/supabase-js', () => ({
    createClient: mockCreateClient,
  }))
  return import('./supabaseAdmin.js')
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
    const { getServiceSupabase } = await loadSupabaseAdminModule()

    const result = getServiceSupabase()

    expect(result).toBeNull()
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('returns null when SUPABASE_SERVICE_ROLE_KEY is missing', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co'
    const { getServiceSupabase } = await loadSupabaseAdminModule()

    const result = getServiceSupabase()

    expect(result).toBeNull()
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('returns null when env vars are empty strings', async () => {
    process.env.SUPABASE_URL = ''
    process.env.SUPABASE_SERVICE_ROLE_KEY = ''
    const { getServiceSupabase } = await loadSupabaseAdminModule()

    const result = getServiceSupabase()

    expect(result).toBeNull()
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('creates and returns service client when env vars are set', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'
    const fakeClient = { tag: 'service-client' }
    mockCreateClient.mockReturnValue(fakeClient)
    const { getServiceSupabase } = await loadSupabaseAdminModule()

    const result = getServiceSupabase()

    expect(mockCreateClient).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'service-role-key',
      expect.objectContaining({
        auth: { persistSession: false, autoRefreshToken: false },
      }),
    )
    expect(result).toBe(fakeClient)
  })

  it('memoizes client and does not recreate on subsequent calls', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'
    const fakeClient = { tag: 'service-client' }
    mockCreateClient.mockReturnValue(fakeClient)
    const { getServiceSupabase } = await loadSupabaseAdminModule()

    const first = getServiceSupabase()
    const second = getServiceSupabase()

    expect(first).toBe(fakeClient)
    expect(second).toBe(fakeClient)
    expect(mockCreateClient).toHaveBeenCalledTimes(1)
  })

  it('returns null when createClient throws', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'
    mockCreateClient.mockImplementation(() => {
      throw new Error('invalid client options')
    })
    const { getServiceSupabase } = await loadSupabaseAdminModule()

    expect(getServiceSupabase()).toBeNull()
    expect(mockCreateClient).toHaveBeenCalledTimes(1)
  })
})

describe('createUserJwtSupabase', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
    process.env = { ...ORIGINAL_ENV }
    process.env.SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_ANON_KEY = 'anon-key'
  })

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  it('returns null without Bearer token', async () => {
    const { createUserJwtSupabase } = await loadSupabaseAdminModule()
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})

    expect(createUserJwtSupabase({ headers: {} })).toBeNull()

    warn.mockRestore()
  })

  it('returns null when URL or anon key is missing', async () => {
    delete process.env.SUPABASE_ANON_KEY
    const { createUserJwtSupabase } = await loadSupabaseAdminModule()
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})

    expect(
      createUserJwtSupabase({
        headers: { authorization: 'Bearer abc' },
      }),
    ).toBeNull()

    warn.mockRestore()
  })

  it('creates client with Authorization header when token is present', async () => {
    const fakeClient = { tag: 'user-client' }
    mockCreateClient.mockReturnValue(fakeClient)
    const { createUserJwtSupabase } = await loadSupabaseAdminModule()

    const client = createUserJwtSupabase({
      headers: { authorization: 'Bearer user-jwt' },
    })

    expect(client).toBe(fakeClient)
    expect(mockCreateClient).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'anon-key',
      expect.objectContaining({
        global: { headers: { Authorization: 'Bearer user-jwt' } },
      }),
    )
  })
})
