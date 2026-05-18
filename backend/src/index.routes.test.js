import { beforeEach, describe, expect, it, jest } from '@jest/globals'

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co'
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'anon-key'

const mockCreateClient = jest.fn()
const mockCreateUserJwtSupabase = jest.fn(() => mockCreateClient())
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

let multerFiles = []
jest.unstable_mockModule('multer', () => ({
  default: Object.assign(
    jest.fn(() => ({
      array: () => (req, _res, next) => {
        req.files = multerFiles
        if (typeof next === 'function') {
          return Promise.resolve(next())
        }
      },
    })),
    { memoryStorage: jest.fn(() => ({})) },
  ),
}))

jest.unstable_mockModule('node-cron', () => ({
  default: { schedule: jest.fn() },
}))

jest.unstable_mockModule('./middleware/auth.js', () => ({
  requireAuth: mockRequireAuth,
}))

jest.unstable_mockModule('./routes/stokvels.js', () => ({ default: jest.fn() }))
jest.unstable_mockModule('./routes/adminStokvels.js', () => ({ default: jest.fn() }))
jest.unstable_mockModule('./routes/profile.js', () => ({ default: jest.fn() }))
jest.unstable_mockModule('./routes/invitations.js', () => ({ default: jest.fn() }))
jest.unstable_mockModule('./routes/healthScore.js', () => ({ default: jest.fn() }))
jest.unstable_mockModule('./routes/marketRates.js', () => ({ default: jest.fn() }))

jest.unstable_mockModule('./utils/supabaseAdmin.js', () => ({
  getServiceSupabase: mockGetServiceSupabase,
  createUserJwtSupabase: mockCreateUserJwtSupabase,
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

function getRouteHandler(method, path) {
  const map = method === 'get' ? registered.get : registered.post
  const handler = map.get(path)
  if (!handler) throw new Error(`${method.toUpperCase()} ${path} not registered`)
  if (Array.isArray(handler)) return handler[handler.length - 1]
  return handler
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

describe('index.js health and dashboard routes', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetServiceSupabase.mockReturnValue(null)
  })

  it('GET / returns API status payload', async () => {
    const res = makeRes()
    await getRouteHandler('get', '/')( {}, res)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'online',
        message: expect.stringMatching(/running/i),
      }),
    )
  })

  it('GET /api/health returns ok', async () => {
    const res = makeRes()
    await getRouteHandler('get', '/api/health')({}, res)
    expect(res.json).toHaveBeenCalledWith({ status: 'ok', service: 'Stokvel API' })
  })

  it('GET /api/me returns authenticated user', async () => {
    const res = makeRes()
    const req = {
      user: { id: '123e4567-e89b-12d3-a456-426614174000', email: 'u@test.com', role: 'user' },
    }
    await getRouteHandler('get', '/api/me')(req, res)
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      user: {
        id: req.user.id,
        email: req.user.email,
        role: req.user.role,
      },
    })
  })

  it('GET /api/public/stokvels returns 503 without service client', async () => {
    const res = makeRes()
    await getRouteHandler('get', '/api/public/stokvels')({}, res)
    expect(res.status).toHaveBeenCalledWith(503)
  })

  it('GET /api/public/stokvels returns active public groups', async () => {
    const svc = {
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: [{ id: 's1', name: 'Public Group' }],
          error: null,
        }),
      })),
    }
    mockGetServiceSupabase.mockReturnValue(svc)
    const res = makeRes()
    await getRouteHandler('get', '/api/public/stokvels')({}, res)
    expect(res.json).toHaveBeenCalledWith([{ id: 's1', name: 'Public Group' }])
  })

  it('GET /api/my-stokvels returns memberships', async () => {
    const userSupabase = {
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          data: [
            {
              stokvel_id: 's1',
              group_role: 'member',
              stokvels: { id: 's1', name: 'Alpha', status: 'active' },
            },
          ],
          error: null,
        }),
      })),
    }
    mockCreateClient.mockReturnValue(userSupabase)
    const res = makeRes()
    const req = {
      headers: { authorization: 'Bearer token' },
      user: { id: '123e4567-e89b-12d3-a456-426614174000', email: 'u@test.com' },
    }
    await getRouteHandler('get', '/api/my-stokvels')(req, res)
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      memberships: expect.any(Array),
    })
  })

  it('GET /api/my-meetings returns empty list when user has no groups', async () => {
    const userSupabase = {
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: [], error: null }),
      })),
    }
    mockCreateClient.mockReturnValue(userSupabase)
    const res = makeRes()
    const req = {
      headers: { authorization: 'Bearer token' },
      user: { id: '123e4567-e89b-12d3-a456-426614174000', email: 'u@test.com' },
    }
    await getRouteHandler('get', '/api/my-meetings')(req, res)
    expect(res.json).toHaveBeenCalledWith({ success: true, meetings: [] })
  })

  it('POST /api/stokvels returns 201 on successful create pipeline', async () => {
    const creatorId = '123e4567-e89b-12d3-a456-426614174000'
    const treasurerId = '223e4567-e89b-12d3-a456-426614174000'
    const stokvelId = '44444444-4444-4444-8444-444444444444'

    const userSupabase = {
      from: jest.fn((table) => {
        if (table === 'stokvels') {
          return {
            insert: () => ({
              select: () => ({
                single: async () => ({
                  data: { id: stokvelId, name: 'My Group' },
                  error: null,
                }),
              }),
            }),
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { id: stokvelId, name: 'My Group' },
                  error: null,
                }),
              }),
            }),
            delete: () => ({ eq: async () => ({ error: null }) }),
          }
        }
        if (table === 'stokvel_members') {
          return { insert: async () => ({ error: null }) }
        }
        return {}
      }),
    }

    const svc = {
      from: jest.fn((table) => {
        if (table === 'stokvel_members') {
          return { insert: async () => ({ error: null }) }
        }
        if (table === 'profiles') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: async () => ({ data: { email: 'treasurer@test.com' }, error: null }),
          }
        }
        if (table === 'stokvels') {
          return {
            update: jest.fn().mockReturnThis(),
            eq: async () => ({ error: null }),
          }
        }
        return {}
      }),
    }

    mockCreateClient.mockReturnValue(userSupabase)
    mockGetServiceSupabase.mockReturnValue(svc)
    mockCreateInvitation.mockResolvedValue({ data: { token: 'invite-token' }, error: null })

    const req = {
      headers: { authorization: 'Bearer token' },
      user: { id: creatorId, email: 'creator@example.com' },
      body: {
        name: 'My Group',
        membersCount: 2,
        treasurerUserId: treasurerId,
        memberDetails: [{ email: 'pending@example.com', name: 'Pending', role: 'member' }],
        type: 'Rotating',
        cycleLength: 12,
      },
    }
    const res = makeRes()
    await stokvelPostHandler()(req, res)

    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json.mock.calls[0][0].success).toBe(true)
    expect(mockCreateInvitation).toHaveBeenCalled()
    expect(mockSendInvitationEmail).toHaveBeenCalled()
  })

  it('POST /api/stokvels returns 503 when service role is missing after stokvel insert', async () => {
    const creatorId = '123e4567-e89b-12d3-a456-426614174000'
    const treasurerId = '223e4567-e89b-12d3-a456-426614174000'
    const stokvelId = '55555555-5555-4555-8555-555555555555'
    const deleteEq = jest.fn(async () => ({ error: null }))

    const userSupabase = {
      from: jest.fn((table) => {
        if (table === 'stokvels') {
          return {
            insert: () => ({
              select: () => ({
                single: async () => ({
                  data: { id: stokvelId, name: 'Rollback Group' },
                  error: null,
                }),
              }),
            }),
            delete: () => ({ eq: deleteEq }),
          }
        }
        if (table === 'stokvel_members') {
          return {
            insert: async () => ({ error: null }),
            delete: () => ({ eq: deleteEq }),
          }
        }
        return {}
      }),
    }

    mockCreateClient.mockReturnValue(userSupabase)
    mockGetServiceSupabase.mockReturnValue(null)

    const req = {
      headers: { authorization: 'Bearer token' },
      user: { id: creatorId, email: 'creator@example.com' },
      body: {
        name: 'Rollback Group',
        membersCount: 2,
        treasurerUserId: treasurerId,
      },
    }
    const res = makeRes()
    await stokvelPostHandler()(req, res)

    expect(res.status).toHaveBeenCalledWith(503)
    expect(deleteEq).toHaveBeenCalled()
  })

  it('POST /api/stokvels returns 400 when group name is missing', async () => {
    mockCreateClient.mockReturnValue({ from: jest.fn() })
    const req = {
      headers: { authorization: 'Bearer token' },
      user: { id: '123e4567-e89b-12d3-a456-426614174000', email: 'creator@example.com' },
      body: { membersCount: 2, treasurerUserId: '223e4567-e89b-12d3-a456-426614174000' },
    }
    const res = makeRes()
    await stokvelPostHandler()(req, res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json.mock.calls[0][0].error).toMatch(/name is required/i)
  })

  it('GET /api/my-stokvels serves cached payload on second request', async () => {
    const cacheUserId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
    const userSupabase = {
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          data: [
            {
              stokvel_id: 's1',
              group_role: 'member',
              stokvels: { id: 's1', name: 'Alpha', status: 'active' },
            },
          ],
          error: null,
        }),
      })),
    }
    mockCreateClient.mockReturnValue(userSupabase)
    const req = {
      headers: { authorization: 'Bearer token' },
      user: { id: cacheUserId, email: 'cache-user@test.com' },
    }
    const handler = getRouteHandler('get', '/api/my-stokvels')
    const res1 = makeRes()
    await handler(req, res1)
    const res2 = makeRes()
    await handler(req, res2)
    expect(userSupabase.from).toHaveBeenCalledTimes(1)
    expect(res2.json).toHaveBeenCalledWith(res1.json.mock.calls[0][0])
  })

  it('GET /api/my-meetings returns meetings with group names', async () => {
    const userSupabase = {
      from: jest.fn((table) => {
        if (table === 'stokvel_members') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockResolvedValue({
              data: [{ stokvel_id: 's1' }],
              error: null,
            }),
          }
        }
        if (table === 'meetings') {
          return {
            select: jest.fn().mockReturnThis(),
            in: jest.fn().mockReturnThis(),
            order: jest.fn().mockResolvedValue({
              data: [
                {
                  id: 'm1',
                  stokvel_id: 's1',
                  title: 'Check-in',
                  meeting_date: '2026-05-10T10:00:00.000Z',
                },
              ],
              error: null,
            }),
          }
        }
        if (table === 'stokvels') {
          return {
            select: jest.fn().mockReturnThis(),
            in: jest.fn().mockResolvedValue({
              data: [{ id: 's1', name: 'Alpha Group' }],
              error: null,
            }),
          }
        }
        return {}
      }),
    }
    mockCreateClient.mockReturnValue(userSupabase)
    const req = {
      headers: { authorization: 'Bearer token' },
      user: { id: '123e4567-e89b-12d3-a456-426614174000', email: 'u@test.com' },
    }
    const res = makeRes()
    await getRouteHandler('get', '/api/my-meetings')(req, res)
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      meetings: [
        expect.objectContaining({
          id: 'm1',
          groupName: 'Alpha Group',
        }),
      ],
    })
  })
})

describe('index.js join route', () => {
  const creatorId = '123e4567-e89b-12d3-a456-426614174000'
  const stokvelId = '33333333-3333-4333-8333-333333333333'

  function joinHandler() {
    return getRouteHandler('post', '/api/stokvels/:id/join')
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('POST join returns 400 for invalid stokvel id', async () => {
    mockCreateClient.mockReturnValue({ from: jest.fn() })
    const res = makeRes()
    await joinHandler()(
      {
        params: { id: 'bad' },
        headers: { authorization: 'Bearer token' },
        user: { id: creatorId },
      },
      res,
    )
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('POST join returns 400 when stokvel is not public', async () => {
    const userSupabase = {
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      })),
    }
    mockCreateClient.mockReturnValue(userSupabase)
    const res = makeRes()
    await joinHandler()(
      {
        params: { id: stokvelId },
        headers: { authorization: 'Bearer token' },
        user: { id: creatorId },
      },
      res,
    )
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json.mock.calls[0][0].error).toMatch(/not available to join/i)
  })

  it('POST join returns 400 when user is already a member', async () => {
    let call = 0
    const userSupabase = {
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockImplementation(async () => {
          call += 1
          if (call === 1) {
            return {
              data: { id: stokvelId, is_public: true, status: 'active' },
              error: null,
            }
          }
          return { data: { user_id: creatorId }, error: null }
        }),
      })),
    }
    mockCreateClient.mockReturnValue(userSupabase)
    const res = makeRes()
    await joinHandler()(
      {
        params: { id: stokvelId },
        headers: { authorization: 'Bearer token' },
        user: { id: creatorId },
      },
      res,
    )
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json.mock.calls[0][0].error).toMatch(/already a member/i)
  })

  it('POST join returns 500 when stokvel lookup fails', async () => {
    const userSupabase = {
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'stokvel lookup failed' },
        }),
      })),
    }
    mockCreateClient.mockReturnValue(userSupabase)
    const res = makeRes()
    await joinHandler()(
      {
        params: { id: stokvelId },
        headers: { authorization: 'Bearer token' },
        user: { id: creatorId },
      },
      res,
    )
    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json.mock.calls[0][0].error).toBe('stokvel lookup failed')
  })

  it('POST join returns 500 when membership insert fails', async () => {
    let call = 0
    const userSupabase = {
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockImplementation(async () => {
          call += 1
          if (call === 1) {
            return {
              data: { id: stokvelId, is_public: true, status: 'active' },
              error: null,
            }
          }
          return { data: null, error: null }
        }),
        insert: jest.fn().mockResolvedValue({ error: { message: 'insert failed' } }),
      })),
    }
    mockCreateClient.mockReturnValue(userSupabase)
    const res = makeRes()
    await joinHandler()(
      {
        params: { id: stokvelId },
        headers: { authorization: 'Bearer token' },
        user: { id: creatorId },
      },
      res,
    )
    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json.mock.calls[0][0].error).toBe('insert failed')
  })

  it('POST join creates membership for public active stokvel', async () => {
    let call = 0
    const insert = jest.fn().mockResolvedValue({ error: null })
    const userSupabase = {
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockImplementation(async () => {
          call += 1
          if (call === 1) {
            return {
              data: { id: stokvelId, is_public: true, status: 'active' },
              error: null,
            }
          }
          return { data: null, error: null }
        }),
        insert,
      })),
    }
    mockCreateClient.mockReturnValue(userSupabase)
    const res = makeRes()
    await joinHandler()(
      {
        params: { id: stokvelId },
        headers: { authorization: 'Bearer token' },
        user: { id: creatorId },
      },
      res,
    )
    expect(res.status).toHaveBeenCalledWith(201)
    expect(insert).toHaveBeenCalled()
  })
})

describe('index.js document uploads', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    multerFiles = []
  })

  it('POST /api/uploads/documents returns 400 when no files attached', async () => {
    mockGetServiceSupabase.mockReturnValue({
      storage: {
        createBucket: jest.fn().mockResolvedValue({ error: null }),
        from: jest.fn(),
      },
    })
    const handlers = registered.post.get('/api/uploads/documents')
    const req = {
      user: { id: '123e4567-e89b-12d3-a456-426614174000' },
      headers: { authorization: 'Bearer token' },
    }
    const res = makeRes()
    await handlers[handlers.length - 1](req, res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json.mock.calls[0][0].error).toMatch(/at least one document/i)
  })

  it('POST /api/uploads/documents returns 500 when bucket creation fails', async () => {
    multerFiles = [
      {
        buffer: Buffer.from('pdf'),
        originalname: 'rules.pdf',
        mimetype: 'application/pdf',
      },
    ]
    mockGetServiceSupabase.mockReturnValue({
      storage: {
        createBucket: jest.fn().mockResolvedValue({ error: { message: 'bucket denied' } }),
        from: jest.fn(),
      },
    })
    const handlers = registered.post.get('/api/uploads/documents')
    const req = {
      user: { id: '123e4567-e89b-12d3-a456-426614174000' },
      headers: { authorization: 'Bearer token' },
    }
    const res = makeRes()
    await handlers[handlers.length - 1](req, res)
    await new Promise((resolve) => setImmediate(resolve))
    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json.mock.calls[0][0].error).toBe('bucket denied')
  })

  it('POST /api/uploads/documents returns 503 without service client', async () => {
    multerFiles = [
      {
        buffer: Buffer.from('pdf'),
        originalname: 'rules.pdf',
        mimetype: 'application/pdf',
      },
    ]
    mockGetServiceSupabase.mockReturnValue(null)
    const handlers = registered.post.get('/api/uploads/documents')
    const req = {
      user: { id: '123e4567-e89b-12d3-a456-426614174000' },
      headers: { authorization: 'Bearer token' },
    }
    const res = makeRes()
    await handlers[handlers.length - 1](req, res)
    expect(res.status).toHaveBeenCalledWith(503)
  })

  it('POST /api/uploads/documents uploads files and returns public URLs', async () => {
    multerFiles = [
      {
        buffer: Buffer.from('pdf-bytes'),
        originalname: 'constitution.pdf',
        mimetype: 'application/pdf',
      },
    ]
    const upload = jest.fn().mockResolvedValue({ error: null })
    const getPublicUrl = jest.fn(() => ({ data: { publicUrl: 'https://cdn.example/constitution.pdf' } }))
    mockGetServiceSupabase.mockReturnValue({
      storage: {
        createBucket: jest.fn().mockResolvedValue({ error: null }),
        from: jest.fn(() => ({ upload, getPublicUrl })),
      },
    })

    const handlers = registered.post.get('/api/uploads/documents')
    const req = {
      user: { id: '123e4567-e89b-12d3-a456-426614174000' },
      headers: { authorization: 'Bearer token' },
    }
    const res = makeRes()
    await handlers[handlers.length - 1](req, res)
    await new Promise((resolve) => setImmediate(resolve))

    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      documents: ['https://cdn.example/constitution.pdf'],
    })
    expect(upload).toHaveBeenCalled()
  })
})

describe('index.js dashboard error paths', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetServiceSupabase.mockReturnValue(null)
    mockCreateUserJwtSupabase.mockImplementation(() => mockCreateClient())
  })

  it('GET /api/public/stokvels returns 500 when query fails', async () => {
    const svc = {
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: null, error: { message: 'public list failed' } }),
      })),
    }
    mockGetServiceSupabase.mockReturnValue(svc)
    const res = makeRes()
    await getRouteHandler('get', '/api/public/stokvels')({}, res)
    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json.mock.calls[0][0].error).toBe('public list failed')
  })

  it('GET /api/my-stokvels returns 500 when membership query fails', async () => {
    const userSupabase = {
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'memberships failed' },
        }),
      })),
    }
    mockCreateClient.mockReturnValue(userSupabase)
    mockCreateUserJwtSupabase.mockImplementation(() => userSupabase)
    const res = makeRes()
    await getRouteHandler('get', '/api/my-stokvels')(
      {
        headers: { authorization: 'Bearer token' },
        user: { id: '123e4567-e89b-12d3-a456-426614174000', email: 'u@test.com' },
      },
      res,
    )
    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json.mock.calls[0][0].error).toBe('memberships failed')
  })

  it('GET /api/my-stokvels returns 503 when user supabase cannot be created', async () => {
    mockCreateUserJwtSupabase.mockImplementation(() => null)
    const res = makeRes()
    const req = {
      headers: { authorization: 'Bearer token' },
      user: { id: '123e4567-e89b-12d3-a456-426614174000', email: 'u@test.com' },
    }
    await getRouteHandler('get', '/api/my-stokvels')(req, res)
    expect(res.status).toHaveBeenCalledWith(503)
  })

  it('GET /api/my-meetings returns 500 when meetings query fails', async () => {
    const userSupabase = {
      from: jest.fn((table) => {
        if (table === 'stokvel_members') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockResolvedValue({ data: [{ stokvel_id: 's1' }], error: null }),
          }
        }
        if (table === 'meetings') {
          return {
            select: jest.fn().mockReturnThis(),
            in: jest.fn().mockReturnThis(),
            order: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'meetings failed' },
            }),
          }
        }
        if (table === 'stokvels') {
          return {
            select: jest.fn().mockReturnThis(),
            in: jest.fn().mockResolvedValue({ data: [{ id: 's1', name: 'Group' }], error: null }),
          }
        }
        return {}
      }),
    }
    mockCreateClient.mockReturnValue(userSupabase)
    mockCreateUserJwtSupabase.mockImplementation(() => userSupabase)
    const res = makeRes()
    await getRouteHandler('get', '/api/my-meetings')(
      {
        headers: { authorization: 'Bearer token' },
        user: { id: '123e4567-e89b-12d3-a456-426614174000', email: 'u@test.com' },
      },
      res,
    )
    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json.mock.calls[0][0].error).toBe('meetings failed')
  })

  it('GET /api/my-meetings returns 500 when group name query fails', async () => {
    const userSupabase = {
      from: jest.fn((table) => {
        if (table === 'stokvel_members') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockResolvedValue({ data: [{ stokvel_id: 's1' }], error: null }),
          }
        }
        if (table === 'meetings') {
          return {
            select: jest.fn().mockReturnThis(),
            in: jest.fn().mockReturnThis(),
            order: jest.fn().mockResolvedValue({
              data: [{ id: 'm1', stokvel_id: 's1', title: 'A', meeting_date: '2026-05-01' }],
              error: null,
            }),
          }
        }
        if (table === 'stokvels') {
          return {
            select: jest.fn().mockReturnThis(),
            in: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'groups query failed' },
            }),
          }
        }
        return {}
      }),
    }
    mockCreateClient.mockReturnValue(userSupabase)
    mockCreateUserJwtSupabase.mockImplementation(() => userSupabase)
    const res = makeRes()
    await getRouteHandler('get', '/api/my-meetings')(
      {
        headers: { authorization: 'Bearer token' },
        user: { id: '123e4567-e89b-12d3-a456-426614174000', email: 'u@test.com' },
      },
      res,
    )
    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json.mock.calls[0][0].error).toBe('groups query failed')
  })

  it('GET /api/my-meetings serves cached payload on second request', async () => {
    const cacheUserId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    const userSupabase = {
      from: jest.fn((table) => {
        if (table === 'stokvel_members') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockResolvedValue({ data: [{ stokvel_id: 's1' }], error: null }),
          }
        }
        if (table === 'meetings') {
          return {
            select: jest.fn().mockReturnThis(),
            in: jest.fn().mockReturnThis(),
            order: jest.fn().mockResolvedValue({
              data: [{ id: 'm1', stokvel_id: 's1', title: 'Sync', meeting_date: '2026-05-01' }],
              error: null,
            }),
          }
        }
        if (table === 'stokvels') {
          return {
            select: jest.fn().mockReturnThis(),
            in: jest.fn().mockResolvedValue({ data: [{ id: 's1', name: 'Group' }], error: null }),
          }
        }
        return {}
      }),
    }
    mockCreateClient.mockReturnValue(userSupabase)
    mockCreateUserJwtSupabase.mockImplementation(() => userSupabase)
    const req = {
      headers: { authorization: 'Bearer token' },
      user: { id: cacheUserId, email: 'cache-meetings@test.com' },
    }
    const handler = getRouteHandler('get', '/api/my-meetings')
    const res1 = makeRes()
    await handler(req, res1)
    const res2 = makeRes()
    await handler(req, res2)
    expect(userSupabase.from).toHaveBeenCalledTimes(3)
    expect(res2.json).toHaveBeenCalledWith(res1.json.mock.calls[0][0])
  })
})
