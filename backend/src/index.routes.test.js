import { beforeEach, describe, expect, it, jest } from '@jest/globals'

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co'
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'anon-key'

const mockCreateClient = jest.fn()
const mockRequireAuth = jest.fn((req, _res, next) => {
  req.user = req.user || {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'creator@example.com',
    role: 'user',
  }
  req.headers = req.headers || {}
  req.headers.authorization = req.headers.authorization || 'Bearer token'
  next()
})
const mockGetServiceSupabase = jest.fn()
const mockCreateInvitation = jest.fn()
const mockSendInvitationEmail = jest.fn()
const mockSearchProfilesForMemberInvite = jest.fn((_req, res) => res.json({ users: [] }))
const mockFetchRepoRateFromFred = jest.fn()

const registered = {
  get: new Map(),
  post: new Map(),
}

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  }
}

function makeApp() {
  return {
    use: jest.fn(),
    get: jest.fn((path, ...handlers) => {
      registered.get.set(path, handlers[handlers.length - 1])
    }),
    post: jest.fn((path, ...handlers) => {
      registered.post.set(path, handlers)
    }),
    listen: jest.fn((_port, cb) => {
      if (typeof cb === 'function') cb()
      return { close: jest.fn() }
    }),
  }
}

jest.unstable_mockModule('express', () => {
  const express = jest.fn(() => makeApp())
  express.json = jest.fn(() => (_req, _res, next) => next())
  return { default: express }
})

jest.unstable_mockModule('cors', () => ({
  default: jest.fn(() => (_req, _res, next) => next()),
}))

jest.unstable_mockModule('multer', () => ({
  default: Object.assign(
    jest.fn(() => ({
    array: () => (_req, _res, next) => next(),
    })),
    { memoryStorage: jest.fn(() => ({})) },
  ),
}))

jest.unstable_mockModule('node-cron', () => ({
  default: { schedule: jest.fn() },
}))

jest.unstable_mockModule('@supabase/supabase-js', () => ({
  createClient: mockCreateClient,
}))

jest.unstable_mockModule('./middleware/auth.js', () => ({
  requireAuth: mockRequireAuth,
}))

jest.unstable_mockModule('./routes/stokvels.js', () => ({ default: jest.fn() }))
jest.unstable_mockModule('./routes/adminStokvels.js', () => ({ default: jest.fn() }))
jest.unstable_mockModule('./routes/profile.js', () => ({ default: jest.fn() }))
jest.unstable_mockModule('./routes/invitations.js', () => ({ default: jest.fn() }))
jest.unstable_mockModule('./routes/marketRates.js', () => ({ default: jest.fn() }))

jest.unstable_mockModule('./utils/supabaseAdmin.js', () => ({
  getServiceSupabase: mockGetServiceSupabase,
}))

jest.unstable_mockModule('./utils/platformAdminStokvelMembers.js', () => ({
  normalizeUuid: jest.fn((id) => {
    if (typeof id !== 'string') return ''
    const t = id.trim().toLowerCase()
    return /^[0-9a-f-]{36}$/.test(t) ? t : ''
  }),
}))

jest.unstable_mockModule('./utils/invitations.js', () => ({
  createInvitation: mockCreateInvitation,
  normalizeInviteEmail: jest.fn((v) =>
    typeof v === 'string' && v.includes('@') ? v.trim().toLowerCase() : '',
  ),
  sendInvitationEmail: mockSendInvitationEmail,
}))

jest.unstable_mockModule('./utils/profileUserSearch.js', () => ({
  searchProfilesForMemberInvite: mockSearchProfilesForMemberInvite,
}))

jest.unstable_mockModule('./jobs/fetchRates.js', () => ({
  fetchRepoRateFromFred: mockFetchRepoRateFromFred,
}))

await import('./index.js')

function stokvelPostHandler() {
  const handlers = registered.post.get('/api/stokvels')
  if (!handlers) throw new Error('POST /api/stokvels not registered')
  return handlers[handlers.length - 1]
}

describe('index.js top-level route branches', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetServiceSupabase.mockReturnValue(null)
  })

  it('POST /api/stokvels returns 400 for mandatory member-count rule (<2)', async () => {
    const userSupabase = { from: jest.fn() }
    mockCreateClient.mockReturnValue(userSupabase)

    const req = {
      headers: { authorization: 'Bearer token' },
      user: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'creator@example.com',
      },
      body: {
        name: 'My Group',
        membersCount: 1,
        treasurerUserId: '223e4567-e89b-12d3-a456-426614174000',
      },
    }
    const res = makeRes()

    await stokvelPostHandler()(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json.mock.calls[0][0].error).toMatch(/at least two people/i)
  })

  it('POST /api/stokvels returns 400 when treasurer is missing/invalid', async () => {
    const userSupabase = { from: jest.fn() }
    mockCreateClient.mockReturnValue(userSupabase)

    const req = {
      headers: { authorization: 'Bearer token' },
      user: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'creator@example.com',
      },
      body: {
        name: 'My Group',
        membersCount: 2,
        treasurerUserId: '',
      },
    }
    const res = makeRes()

    await stokvelPostHandler()(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json.mock.calls[0][0].error).toMatch(/treasurer/i)
  })

  it('POST /api/stokvels rolls back stokvel when creator-member insert fails', async () => {
    const eqDelete = jest.fn(async () => ({ error: null }))
    const userSupabase = {
      from: jest.fn((table) => {
        if (table === 'stokvels') {
          return {
            insert: () => ({
              select: () => ({
                single: async () => ({ data: { id: 's1', name: 'Group X' }, error: null }),
              }),
            }),
            delete: () => ({ eq: eqDelete }),
          }
        }
        if (table === 'stokvel_members') {
          return {
            insert: async () => ({ error: { message: 'member insert failed' } }),
          }
        }
        return {}
      }),
    }
    mockCreateClient.mockReturnValue(userSupabase)

    const req = {
      headers: { authorization: 'Bearer token' },
      user: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'creator@example.com',
      },
      body: {
        name: 'My Group',
        membersCount: 2,
        treasurerUserId: '223e4567-e89b-12d3-a456-426614174000',
      },
    }
    const res = makeRes()

    await stokvelPostHandler()(req, res)

    expect(eqDelete).toHaveBeenCalledWith('id', 's1')
    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json.mock.calls[0][0].error).toBe('member insert failed')
  })
})
