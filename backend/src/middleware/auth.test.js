import { jest, describe, it, expect, beforeEach } from '@jest/globals'

let mockSupabaseInstance = {
  auth: {
    getUser: jest.fn(),
  },
  from: jest.fn(),
}

// ESM-safe module mock
jest.unstable_mockModule('../utils/supabase.js', () => ({
  get supabase() {
    return mockSupabaseInstance
  },
}))

// Import AFTER mocking
const { requireAuth, normalizePlatformRole } = await import('./auth.js')
const { supabase } = await import('../utils/supabase.js')

describe('normalizePlatformRole', () => {
  it('returns user for null or empty', () => {
    expect(normalizePlatformRole(null)).toBe('user')
    expect(normalizePlatformRole('')).toBe('user')
  })

  it('normalizes admin case-insensitively', () => {
    expect(normalizePlatformRole('admin')).toBe('admin')
    expect(normalizePlatformRole('ADMIN')).toBe('admin')
    expect(normalizePlatformRole('Admin')).toBe('admin')
  })

  it('returns other roles as-is', () => {
    expect(normalizePlatformRole('moderator')).toBe('moderator')
  })
})

describe('requireAuth middleware', () => {
  let req, res, next

  beforeEach(() => {
    mockSupabaseInstance = {
      auth: { getUser: jest.fn() },
      from: jest.fn(),
    }
    req = { headers: {} }
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    }
    next = jest.fn()
    jest.clearAllMocks()
  })

  it('returns 401 if no authorization header', async () => {
    await requireAuth(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({
      error: 'Missing or malformed authorization header',
    })
  })

  it('returns 401 if header is malformed', async () => {
    req.headers.authorization = 'InvalidToken'
    await requireAuth(req, res, next)
    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('returns 401 when auth succeeds but user payload is missing', async () => {
    req.headers.authorization = 'Bearer token'
    supabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null })
    await requireAuth(req, res, next)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' })
  })

  it('returns 503 for certificate-related auth transport errors', async () => {
    req.headers.authorization = 'Bearer token'
    supabase.auth.getUser.mockResolvedValue({
      data: null,
      error: { message: 'certificate verify failed' },
    })
    await requireAuth(req, res, next)
    expect(res.status).toHaveBeenCalledWith(503)
  })

  it('returns 503 for Supabase transport errors with network message', async () => {
    req.headers.authorization = 'Bearer token'
    supabase.auth.getUser.mockResolvedValue({
      data: null,
      error: { message: 'ECONNREFUSED connecting to auth' },
    })
    await requireAuth(req, res, next)
    expect(res.status).toHaveBeenCalledWith(503)
  })

  it('returns 401 if Bearer token is empty', async () => {
    req.headers.authorization = 'Bearer   '
    await requireAuth(req, res, next)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({
      error: 'Missing or malformed authorization header',
    })
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 401 if token is invalid', async () => {
    req.headers.authorization = 'Bearer badtoken'

    supabase.auth.getUser.mockResolvedValue({
      data: null,
      error: { message: 'Invalid token' },
    })

    await requireAuth(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 503 when Supabase Auth transport fails (fetch failed)', async () => {
    req.headers.authorization = 'Bearer valid-looking-token'

    supabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'fetch failed' },
    })

    await requireAuth(req, res, next)

    expect(res.status).toHaveBeenCalledWith(503)
    expect(res.json).toHaveBeenCalledWith({
      error:
        'Authentication service temporarily unavailable (network or TLS). Check API logs.',
    })
    expect(next).not.toHaveBeenCalled()
  })

  it('sets user with default role if no profile', async () => {
    req.headers.authorization = 'Bearer validtoken'

    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: '123' } },
      error: null,
    })

    supabase.from.mockReturnValue({
      select: () => ({
        eq: () => ({
          single: jest.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        }),
      }),
    })

    await requireAuth(req, res, next)

    expect(req.user).toEqual({
      id: '123',
      role: 'user',
    })
    expect(next).toHaveBeenCalled()
  })

  it('sets user role from profile (admin normalized)', async () => {
    req.headers.authorization = 'Bearer validtoken'

    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: '123' } },
      error: null,
    })

    supabase.from.mockReturnValue({
      select: () => ({
        eq: () => ({
          single: jest.fn().mockResolvedValue({
            data: { role: 'ADMIN' },
            error: null,
          }),
        }),
      }),
    })

    await requireAuth(req, res, next)

    expect(req.user.role).toBe('admin')
    expect(next).toHaveBeenCalled()
  })

  it('continues if profile fetch fails', async () => {
    req.headers.authorization = 'Bearer validtoken'

    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: '123' } },
      error: null,
    })

    supabase.from.mockReturnValue({
      select: () => ({
        eq: () => ({
          single: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'DB error' },
          }),
        }),
      }),
    })

    await requireAuth(req, res, next)

    expect(next).toHaveBeenCalled()
  })

  it('returns 503 when Supabase Auth is unreachable (e.g. TLS/network)', async () => {
    req.headers.authorization = 'Bearer validtoken'
    const tlsErr = new Error('fetch failed')
    tlsErr.cause = Object.assign(new Error('cert'), {
      code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
    })
    supabase.auth.getUser.mockRejectedValue(tlsErr)

    await requireAuth(req, res, next)

    expect(res.status).toHaveBeenCalledWith(503)
    expect(res.json).toHaveBeenCalledWith({
      error:
        'Authentication service temporarily unavailable (network or TLS). Check API logs.',
    })
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 500 on unexpected error', async () => {
    req.headers.authorization = 'Bearer validtoken'
    supabase.auth.getUser.mockRejectedValue(new Error('Unexpected'))

    await requireAuth(req, res, next)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({
      error: 'Internal Server Error during authentication',
    })
  })
})