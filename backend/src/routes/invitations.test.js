import request from 'supertest'
import express from 'express'
import { jest, describe, it, expect, beforeEach } from '@jest/globals'

const mockCreateClient = jest.fn()
const mockGetServiceSupabase = jest.fn()
const mockGroupRoleForUserProfile = jest.fn()
const mockNormalizeInviteEmail = jest.fn()

jest.unstable_mockModule('@supabase/supabase-js', () => ({
  createClient: mockCreateClient,
}))

jest.unstable_mockModule('../middleware/auth.js', () => ({
  requireAuth: (req, _res, next) => {
    req.user = {
      id: '11111111-1111-4111-8111-111111111111',
      email: 'auth@site.com',
    }
    req.headers = req.headers || {}
    req.headers.authorization = req.headers.authorization || 'Bearer test-token'
    next()
  },
}))

jest.unstable_mockModule('../utils/supabaseAdmin.js', () => ({
  getServiceSupabase: mockGetServiceSupabase,
}))

jest.unstable_mockModule('../utils/platformAdminStokvelMembers.js', () => ({
  groupRoleForUserProfile: mockGroupRoleForUserProfile,
}))

jest.unstable_mockModule('../utils/invitations.js', () => ({
  normalizeInviteEmail: mockNormalizeInviteEmail,
}))

const { default: invitationsRouter } = await import('./invitations.js')

function makeClient(overrides = {}) {
  const state = {
    maybeSingleQueue: [],
    upsertQueue: [],
    updateEqQueue: [],
    ...overrides,
  }

  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockImplementation(async () => {
      if (state.maybeSingleQueue.length > 0) return state.maybeSingleQueue.shift()
      return { data: null, error: null }
    }),
    upsert: jest.fn().mockImplementation(async () => {
      if (state.upsertQueue.length > 0) return state.upsertQueue.shift()
      return { error: null }
    }),
    update: jest.fn().mockReturnThis(),
    then: undefined,
  }

  chain.eq = jest.fn().mockImplementation(async () => {
    if (state.updateEqQueue.length > 0) return state.updateEqQueue.shift()
    return { error: null }
  })

  // Keep select/eq chain for queries and update().eq() path
  const from = jest.fn().mockImplementation(() => {
    const queryChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: chain.maybeSingle,
      upsert: chain.upsert,
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockImplementation(async () => {
          if (state.updateEqQueue.length > 0) return state.updateEqQueue.shift()
          return { error: null }
        }),
      }),
    }
    return queryChain
  })

  return { from, _state: state }
}

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/invitations', invitationsRouter)
  return app
}

beforeEach(() => {
  jest.clearAllMocks()
  mockNormalizeInviteEmail.mockImplementation((v) =>
    typeof v === 'string' && v.includes('@') ? v.trim().toLowerCase() : '',
  )
  mockGroupRoleForUserProfile.mockResolvedValue('member')
})

describe('Invitations router', () => {
  describe('GET /api/invitations/:token', () => {
    it('returns 400 when token is missing', async () => {
      const app = makeApp()
      const res = await request(app).get('/api/invitations/%20')

      expect(res.status).toBe(400)
      expect(res.body).toEqual({ error: 'Invitation token is required.' })
    })

    it('returns 500 when service role client is missing', async () => {
      mockGetServiceSupabase.mockReturnValue(null)
      const app = makeApp()
      const res = await request(app).get('/api/invitations/token123')

      expect(res.status).toBe(500)
      expect(res.body).toEqual({ error: 'Server missing service role configuration.' })
    })

    it('returns 500 when invitation lookup query fails', async () => {
      const client = makeClient()
      mockGetServiceSupabase.mockReturnValue(client)
      client._state.maybeSingleQueue.push({ data: null, error: { message: 'db error' } })

      const app = makeApp()
      const res = await request(app).get('/api/invitations/token123')

      expect(res.status).toBe(500)
      expect(res.body).toEqual({ error: 'db error' })
    })

    it('returns 404 when invitation does not exist', async () => {
      const client = makeClient()
      mockGetServiceSupabase.mockReturnValue(client)
      client._state.maybeSingleQueue.push({ data: null, error: null })

      const app = makeApp()
      const res = await request(app).get('/api/invitations/token123')

      expect(res.status).toBe(404)
      expect(res.body).toEqual({ error: 'Invitation not found.' })
    })

    it('returns 404 when invitation status is not pending', async () => {
      const client = makeClient()
      mockGetServiceSupabase.mockReturnValue(client)
      client._state.maybeSingleQueue.push({
        data: { id: 'i1', status: 'accepted', email: 'x@x.com', stokvels: { id: 's1', name: 'G' } },
        error: null,
      })

      const app = makeApp()
      const res = await request(app).get('/api/invitations/token123')

      expect(res.status).toBe(404)
      expect(res.body).toEqual({ error: 'Invitation not found.' })
    })

    it('returns invitation details when token is valid and pending', async () => {
      const client = makeClient()
      mockGetServiceSupabase.mockReturnValue(client)
      client._state.maybeSingleQueue.push({
        data: {
          id: 'i1',
          status: 'pending',
          email: 'member@site.com',
          stokvels: { id: 's1', name: 'Group A', status: 'active' },
        },
        error: null,
      })

      const app = makeApp()
      const res = await request(app).get('/api/invitations/token123')

      expect(res.status).toBe(200)
      expect(res.body).toEqual({
        success: true,
        invitation: {
          email: 'member@site.com',
          stokvel: { id: 's1', name: 'Group A', status: 'active' },
        },
      })
    })
  })

  describe('POST /api/invitations/accept', () => {
    it('returns 400 when token is missing', async () => {
      const app = makeApp()
      const res = await request(app).post('/api/invitations/accept').send({})

      expect(res.status).toBe(400)
      expect(res.body).toEqual({ error: 'Invitation token is required.' })
    })

    it('returns 500 when invitation lookup fails', async () => {
      const client = makeClient()
      mockGetServiceSupabase.mockReturnValue(client)
      client._state.maybeSingleQueue.push({ data: null, error: { message: 'lookup failed' } })

      const app = makeApp()
      const res = await request(app).post('/api/invitations/accept').send({ token: 'abc' })

      expect(res.status).toBe(500)
      expect(res.body).toEqual({ error: 'lookup failed' })
    })

    it('returns 404 when invitation is not pending', async () => {
      const client = makeClient()
      mockGetServiceSupabase.mockReturnValue(client)
      client._state.maybeSingleQueue.push({
        data: { id: 'i1', email: 'x@x.com', status: 'accepted', stokvel_id: 's1', group_role: null },
        error: null,
      })

      const app = makeApp()
      const res = await request(app).post('/api/invitations/accept').send({ token: 'abc' })

      expect(res.status).toBe(404)
      expect(res.body).toEqual({ error: 'Invitation not found.' })
    })

    it('returns 403 when invitation email belongs to another user', async () => {
      const client = makeClient()
      mockGetServiceSupabase.mockReturnValue(client)
      client._state.maybeSingleQueue.push({
        data: {
          id: 'i1',
          email: 'invite@site.com',
          status: 'pending',
          stokvel_id: 's1',
          group_role: null,
        },
        error: null,
      })
      client._state.maybeSingleQueue.push({
        data: { email: 'profile@site.com' },
        error: null,
      })

      const app = makeApp()
      const res = await request(app).post('/api/invitations/accept').send({ token: 'abc' })

      expect(res.status).toBe(403)
      expect(res.body).toEqual({ error: 'This invitation belongs to another email address.' })
    })

    it('returns 500 when member upsert fails', async () => {
      const client = makeClient()
      mockGetServiceSupabase.mockReturnValue(client)
      client._state.maybeSingleQueue.push({
        data: {
          id: 'i1',
          email: 'auth@site.com',
          status: 'pending',
          stokvel_id: 's1',
          group_role: null,
        },
        error: null,
      })
      client._state.maybeSingleQueue.push({ data: { email: 'auth@site.com' }, error: null })
      client._state.upsertQueue.push({ error: { message: 'upsert failed' } })

      const app = makeApp()
      const res = await request(app).post('/api/invitations/accept').send({ token: 'abc' })

      expect(mockGroupRoleForUserProfile).toHaveBeenCalledTimes(1)
      expect(res.status).toBe(500)
      expect(res.body).toEqual({ error: 'upsert failed' })
    })

    it('returns 500 when invitation status update fails', async () => {
      const client = makeClient()
      mockGetServiceSupabase.mockReturnValue(client)
      client._state.maybeSingleQueue.push({
        data: {
          id: 'i1',
          email: 'auth@site.com',
          status: 'pending',
          stokvel_id: 's1',
          group_role: 'admin',
        },
        error: null,
      })
      client._state.maybeSingleQueue.push({ data: { email: 'auth@site.com' }, error: null })
      client._state.upsertQueue.push({ error: null })
      client._state.updateEqQueue.push({ error: { message: 'update failed' } })

      const app = makeApp()
      const res = await request(app).post('/api/invitations/accept').send({ token: 'abc' })

      expect(mockGroupRoleForUserProfile).not.toHaveBeenCalled()
      expect(res.status).toBe(500)
      expect(res.body).toEqual({ error: 'update failed' })
    })

    it('returns success when accept flow completes with fallback db client', async () => {
      const fallbackClient = makeClient()
      mockGetServiceSupabase.mockReturnValue(null)
      mockCreateClient.mockReturnValue(fallbackClient)
      fallbackClient._state.maybeSingleQueue.push({
        data: {
          id: 'i1',
          email: 'auth@site.com',
          status: 'pending',
          stokvel_id: 's1',
          group_role: null,
        },
        error: null,
      })
      fallbackClient._state.maybeSingleQueue.push({ data: { email: 'auth@site.com' }, error: null })
      fallbackClient._state.upsertQueue.push({ error: null })
      fallbackClient._state.updateEqQueue.push({ error: null })
      mockGroupRoleForUserProfile.mockResolvedValue('member')

      const app = makeApp()
      const res = await request(app)
        .post('/api/invitations/accept')
        .set('authorization', 'Bearer fallback-token')
        .send({ token: 'abc' })

      expect(mockCreateClient).toHaveBeenCalled()
      expect(res.status).toBe(200)
      expect(res.body).toEqual({ success: true })
    })
  })
})
