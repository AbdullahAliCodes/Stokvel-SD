import { jest, describe, it, expect, beforeEach } from '@jest/globals'

// ESM-safe module mock
jest.unstable_mockModule('../utils/supabase.js', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(),
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