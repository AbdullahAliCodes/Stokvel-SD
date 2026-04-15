import request from 'supertest'
import express from 'express'
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals'

// ESM-safe mocks
jest.unstable_mockModule('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}))

jest.unstable_mockModule('../middleware/auth.js', () => ({
  requireAuth: (req, _res, next) => {
    req.user = { id: 'test-user-id' }
    req.headers = req.headers || {}
    req.headers.authorization = 'Bearer fake-test-token'
    next()
  },
}))

jest.unstable_mockModule('../utils/supabaseAdmin.js', () => ({
  getServiceSupabase: jest.fn(),
}))

jest.unstable_mockModule('../utils/username.js', () => ({
  normalizeUsername: jest.fn((username) => {
    if (!username || username === 'invalid_name!') return ''
    return String(username).toLowerCase().trim()
  }),
}))

// Import AFTER mocks
const { default: profileRouter } = await import('./profile.js')
const { createClient } = await import('@supabase/supabase-js')
const { getServiceSupabase } = await import('../utils/supabaseAdmin.js')
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
    update: jest.fn().mockReturnThis(),
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
    createClient.mockReturnValue(mockClient)

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
      // existing profile lookup
      mockClient._state.maybeSingleQueue.push({ data: { id: 'test-user-id' }, error: null })
      // fresh profile read after update
      mockClient._state.singleQueue.push({
        data: { first_name: 'Jane', last_name: 'Smith', username: 'jane_smith' },
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
        },
      })
      expect(normalizeUsername).toHaveBeenCalledWith('jane_smith')
    })
  })
})