import request from 'supertest'
import express from 'express'
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals'

// ESM-safe mocks
jest.unstable_mockModule('../middleware/auth.js', () => ({
  requireAuth: (req, res, next) => {
    if (req.headers?.['x-test-unauth'] === '1') {
      return res.status(401).json({ error: 'Missing or malformed authorization header' })
    }
    req.user = { id: 'test-user-id', email: 'user@example.com' }
    req.headers = req.headers || {}
    req.headers.authorization = req.headers.authorization || 'Bearer fake-test-token'
    next()
  },
}))

jest.unstable_mockModule('../utils/supabaseAdmin.js', () => ({
  getServiceSupabase: jest.fn(),
  createUserJwtSupabase: jest.fn(),
}))

jest.unstable_mockModule('../utils/username.js', () => ({
  normalizeUsername: jest.fn((username) => {
    if (!username || username === 'invalid_name!') return ''
    return String(username).toLowerCase().trim()
  }),
}))

// Import AFTER mocks
const { default: profileRouter } = await import('./profile.js')
const { getServiceSupabase, createUserJwtSupabase } = await import('../utils/supabaseAdmin.js')
const { normalizeUsername } = await import('../utils/username.js')

// Helper: fluent supabase chain with configurable responses
function makeChain(overrides = {}) {
  const state = {
    maybeSingleQueue: [],
    singleQueue: [],
    insertResult: { error: null },
    updateResult: { error: null },
    ...overrides,
  }

  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockImplementation(async () => {
      if (state.maybeSingleQueue.length > 0) return state.maybeSingleQueue.shift()
      return { data: null, error: null }
    }),
    single: jest.fn().mockImplementation(async () => {
      if (state.singleQueue.length > 0) return state.singleQueue.shift()
      return { data: null, error: null }
    }),
    insert: jest.fn().mockImplementation(async () => state.insertResult),
    update: jest.fn().mockImplementation(() => ({
      eq: jest.fn().mockImplementation(async () => state.updateResult),
    })),
  }

  const client = {
    from: jest.fn().mockReturnValue(chain),
    _chain: chain,
    _state: state,
  }

  return client
}

describe('Profile Router', () => {
  let app
  let mockClient

  beforeEach(() => {
    jest.clearAllMocks()

    app = express()
    app.use(express.json())
    app.use('/api/profile', profileRouter)

    mockClient = makeChain()
    getServiceSupabase.mockReturnValue(mockClient)
    createUserJwtSupabase.mockReturnValue(mockClient)

    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    console.error.mockRestore()
  })

  describe('GET /api/profile/me', () => {
    it('returns profile on success', async () => {
      mockClient._state.maybeSingleQueue.push({
        data: { first_name: 'John', last_name: 'Doe', username: 'john_doe' },
        error: null,
      })

      const res = await request(app).get('/api/profile/me')

      expect(res.status).toBe(200)
      expect(res.body).toEqual({
        success: true,
        profile: {
          firstName: 'John',
          lastName: 'Doe',
          username: 'john_doe',
          email: 'user@example.com',
        },
      })
    })

    it('returns 500 when profile query fails', async () => {
      mockClient._state.maybeSingleQueue.push({
        data: null,
        error: { message: 'DB failed' },
      })

      const res = await request(app).get('/api/profile/me')

      expect(res.status).toBe(500)
      expect(res.body).toEqual({ error: 'DB failed' })
    })
  })

  describe('GET /api/profile/username-available', () => {
    it('returns invalid for bad username', async () => {
      const res = await request(app).get('/api/profile/username-available?u=invalid_name!')

      expect(res.status).toBe(200)
      expect(res.body).toEqual({ available: false, reason: 'invalid' })
    })

    it('returns skipped when service client missing', async () => {
      getServiceSupabase.mockReturnValue(null)

      const res = await request(app).get('/api/profile/username-available?u=john')

      expect(res.status).toBe(200)
      expect(res.body).toEqual({ available: null, skipped: true })
    })

    it('returns available false when username exists', async () => {
      mockClient._state.maybeSingleQueue.push({
        data: { id: 'existing-user' },
        error: null,
      })

      const res = await request(app).get('/api/profile/username-available?u=john')

      expect(res.status).toBe(200)
      expect(res.body).toEqual({ available: false })
    })
  })

  describe('POST /api/profile/username', () => {
    it('returns 400 for invalid username', async () => {
      const res = await request(app).post('/api/profile/username').send({ username: 'invalid_name!' })

      expect(res.status).toBe(400)
      expect(res.body.error).toContain('Username must be 3')
    })

    it('returns 409 when username is already taken', async () => {
      mockClient._state.maybeSingleQueue.push({
        data: { id: 'taken-id' },
        error: null,
      })

      const res = await request(app).post('/api/profile/username').send({ username: 'john' })

      expect(res.status).toBe(409)
      expect(res.body).toEqual({ error: 'That username is already taken.' })
    })

    it('inserts username when profile row does not exist', async () => {
      mockClient._state.maybeSingleQueue.push({ data: null, error: null })
      mockClient._state.maybeSingleQueue.push({ data: null, error: null })

      const res = await request(app).post('/api/profile/username').send({ username: 'new_user' })

      expect(res.status).toBe(200)
      expect(res.body).toEqual({ success: true, username: 'new_user' })
      expect(mockClient._chain.insert).toHaveBeenCalled()
    })

    it('saves username for existing profile', async () => {
      // 1) taken check => not taken
      // 2) existing profile lookup => exists
      mockClient._state.maybeSingleQueue.push({ data: null, error: null })
      mockClient._state.maybeSingleQueue.push({ data: { id: 'test-user-id' }, error: null })

      const res = await request(app).post('/api/profile/username').send({ username: 'John' })

      expect(res.status).toBe(200)
      expect(res.body).toEqual({ success: true, username: 'john' })
      expect(mockClient._chain.update).toHaveBeenCalled()
    })
  })

  describe('PATCH /api/profile/me', () => {
    it('returns 400 when body has no supported fields', async () => {
      const res = await request(app).patch('/api/profile/me').send({})

      expect(res.status).toBe(400)
      expect(res.body.error).toContain('Provide at least one field')
    })

    it('updates and returns fresh profile', async () => {
      // username taken check
      mockClient._state.maybeSingleQueue.push({ data: null, error: null })
      // existing profile lookup
      mockClient._state.maybeSingleQueue.push({ data: { id: 'test-user-id' }, error: null })
      // fresh profile read after update
      mockClient._state.singleQueue.push({
        data: { first_name: 'Jane', last_name: 'Smith', username: 'jane_smith', email: '' },
        error: null,
      })

      const res = await request(app)
        .patch('/api/profile/me')
        .send({ firstName: 'Jane', lastName: 'Smith', username: 'jane_smith' })

      expect(res.status).toBe(200)
      expect(res.body).toEqual({
        success: true,
        profile: {
          firstName: 'Jane',
          lastName: 'Smith',
          username: 'jane_smith',
          email: '',
        },
      })
      expect(normalizeUsername).toHaveBeenCalledWith('jane_smith')
    })

    it('returns 500 when profile update fails after successful auth and lookup', async () => {
      mockClient._state.maybeSingleQueue.push({ data: { id: 'test-user-id' }, error: null })
      mockClient._state.updateResult = { error: { message: 'profiles update failed' } }

      const res = await request(app).patch('/api/profile/me').send({ firstName: 'Jane' })

      expect(res.status).toBe(500)
      expect(res.body).toEqual({ error: 'profiles update failed' })
    })

    it('returns 400 for invalid email', async () => {
      const res = await request(app).patch('/api/profile/me').send({ email: 'not-an-email' })
      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/valid email/i)
    })

    it('inserts profile when user row does not exist yet', async () => {
      mockClient._state.maybeSingleQueue.push({ data: null, error: null })
      mockClient._state.singleQueue.push({
        data: { first_name: 'New', last_name: 'User', username: null, email: 'new@x.com' },
        error: null,
      })

      const res = await request(app)
        .patch('/api/profile/me')
        .send({ firstName: 'New', lastName: 'User', email: 'new@x.com' })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(mockClient._chain.insert).toHaveBeenCalled()
    })

    it('returns success without profile payload when post-update read fails', async () => {
      mockClient._state.maybeSingleQueue.push({ data: { id: 'test-user-id' }, error: null })
      mockClient._state.singleQueue.push({ data: null, error: { message: 'read failed' } })

      const res = await request(app).patch('/api/profile/me').send({ firstName: 'Only' })
      expect(res.status).toBe(200)
      expect(res.body).toEqual({ success: true })
    })

    it('clears username when null is sent', async () => {
      mockClient._state.maybeSingleQueue.push({ data: { id: 'test-user-id' }, error: null })
      mockClient._state.singleQueue.push({
        data: { first_name: '', last_name: '', username: null, email: '' },
        error: null,
      })

      const res = await request(app).patch('/api/profile/me').send({ username: null })
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
    })
  })

  describe('GET /api/profile/me client unavailable', () => {
    it('returns 503 when no supabase client can be created', async () => {
      getServiceSupabase.mockReturnValue(null)
      createUserJwtSupabase.mockReturnValue(null)

      const res = await request(app).get('/api/profile/me')
      expect(res.status).toBe(503)
    })
  })

  describe('GET /api/profile/username-available success path', () => {
    it('returns available true when username is free', async () => {
      mockClient._state.maybeSingleQueue.push({ data: null, error: null })
      const res = await request(app).get('/api/profile/username-available?username=free_name')
      expect(res.status).toBe(200)
      expect(res.body).toEqual({ available: true })
    })

    it('returns 500 when username lookup fails', async () => {
      mockClient._state.maybeSingleQueue.push({ data: null, error: { message: 'lookup failed' } })
      const res = await request(app).get('/api/profile/username-available?u=john')
      expect(res.status).toBe(500)
      expect(res.body.error).toBe('lookup failed')
    })
  })

  describe('auth and malformed payloads', () => {
    it('returns 401 on protected routes when session token is missing', async () => {
      const res = await request(app).get('/api/profile/me').set('x-test-unauth', '1')
      expect(res.status).toBe(401)
      expect(res.body).toEqual({ error: 'Missing or malformed authorization header' })
    })

    it('PATCH /me returns 400 for invalid username in body', async () => {
      const res = await request(app).patch('/api/profile/me').send({ username: 'invalid_name!' })
      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/Username must be 3/)
    })

    it('PATCH /me returns 500 when username availability check fails', async () => {
      mockClient._state.maybeSingleQueue.push({
        data: null,
        error: { message: 'username check failed' },
      })

      const res = await request(app).patch('/api/profile/me').send({ username: 'valid_user' })

      expect(res.status).toBe(500)
      expect(res.body.error).toBe('username check failed')
    })

    it('PATCH /me returns 500 when existing profile lookup fails', async () => {
      mockClient._state.maybeSingleQueue.push({
        data: null,
        error: { message: 'profile lookup failed' },
      })

      const res = await request(app).patch('/api/profile/me').send({ firstName: 'Jane' })

      expect(res.status).toBe(500)
      expect(res.body.error).toBe('profile lookup failed')
    })

    it('POST /username returns 400 when body is missing username', async () => {
      const res = await request(app).post('/api/profile/username').send({})
      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/Username must be 3/)
    })

    it('POST /username returns 503 when supabase client is unavailable', async () => {
      getServiceSupabase.mockReturnValue(null)
      createUserJwtSupabase.mockReturnValue(null)

      const res = await request(app).post('/api/profile/username').send({ username: 'new_user' })

      expect(res.status).toBe(503)
    })

    it('POST /username returns 500 when taken check fails', async () => {
      mockClient._state.maybeSingleQueue.push({
        data: null,
        error: { message: 'taken check failed' },
      })

      const res = await request(app).post('/api/profile/username').send({ username: 'new_user' })

      expect(res.status).toBe(500)
      expect(res.body.error).toBe('taken check failed')
    })

    it('POST /username returns 500 when insert fails for new profile', async () => {
      mockClient._state.maybeSingleQueue.push({ data: null, error: null })
      mockClient._state.maybeSingleQueue.push({ data: null, error: null })
      mockClient._state.insertResult = { error: { message: 'insert username failed' } }

      const res = await request(app).post('/api/profile/username').send({ username: 'new_user' })

      expect(res.status).toBe(500)
      expect(res.body.error).toBe('insert username failed')
    })

    it('POST /username returns 500 when update fails for existing profile', async () => {
      mockClient._state.maybeSingleQueue.push({ data: null, error: null })
      mockClient._state.maybeSingleQueue.push({ data: { id: 'test-user-id' }, error: null })
      mockClient._state.updateResult = { error: { message: 'update username failed' } }

      const res = await request(app).post('/api/profile/username').send({ username: 'renamed_user' })

      expect(res.status).toBe(500)
      expect(res.body.error).toBe('update username failed')
    })

    it('PATCH /me returns 500 when insert fails for new profile row', async () => {
      mockClient._state.maybeSingleQueue.push({ data: null, error: null })
      mockClient._state.insertResult = { error: { message: 'patch insert failed' } }

      const res = await request(app)
        .patch('/api/profile/me')
        .send({ firstName: 'New', email: 'new@example.com' })

      expect(res.status).toBe(500)
      expect(res.body.error).toBe('patch insert failed')
    })
  })
})