// backend/src/routes/adminStokvels.test.js
import { jest, describe, it, expect, beforeEach } from '@jest/globals'

/**
 * ---- Dependency mocks (ESM-safe) ----
 */
const mockCreateClient = jest.fn()
const mockGetServiceSupabase = jest.fn()
const mockEnsurePlatformAdminsInStokvel = jest.fn()
const mockGroupRoleForUserProfile = jest.fn()
const mockNormalizeUsername = jest.fn()
const mockCreateInvitation = jest.fn()
const mockNormalizeInviteEmail = jest.fn()
const mockSendGroupAddedEmail = jest.fn()
const mockSendGroupStatusEmail = jest.fn()
const mockSendInvitationEmail = jest.fn()

jest.unstable_mockModule('@supabase/supabase-js', () => ({
  createClient: mockCreateClient,
}))

jest.unstable_mockModule('../middleware/auth.js', () => ({
  requireAuth: (_req, _res, next) => next(),
}))

jest.unstable_mockModule('../middleware/requireAdmin.js', () => ({
  requireAdmin: (_req, _res, next) => next(),
}))

jest.unstable_mockModule('../utils/supabaseAdmin.js', () => ({
  getServiceSupabase: mockGetServiceSupabase,
}))

jest.unstable_mockModule('../utils/platformAdminStokvelMembers.js', () => ({
  ensurePlatformAdminsInStokvel: mockEnsurePlatformAdminsInStokvel,
  groupRoleForUserProfile: mockGroupRoleForUserProfile,
}))

jest.unstable_mockModule('../utils/username.js', () => ({
  normalizeUsername: mockNormalizeUsername,
}))

jest.unstable_mockModule('../utils/invitations.js', () => ({
  createInvitation: mockCreateInvitation,
  normalizeInviteEmail: mockNormalizeInviteEmail,
  sendGroupAddedEmail: mockSendGroupAddedEmail,
  sendGroupStatusEmail: mockSendGroupStatusEmail,
  sendInvitationEmail: mockSendInvitationEmail,
}))

const mockActivateStokvel = jest.fn()
jest.unstable_mockModule('../utils/stokvelActivation.js', () => ({
  activateStokvel: (...args) => mockActivateStokvel(...args),
}))

const { default: router } = await import('./adminStokvels.js')

/**
 * ---- Tiny Supabase query builder mock ----
 * Queue keys are `${table}.${op}` where op is:
 * selectMaybeSingle, selectSingle, selectMany, insertSingle, insert, updateSelect, updateEq, deleteEq, upsert
 */
function createSupabaseMock() {
  const queue = new Map()

  const enqueue = (key, value) => {
    const list = queue.get(key) || []
    list.push(value)
    queue.set(key, list)
  }

  const dequeue = (key, fallback = { data: null, error: null }) => {
    const list = queue.get(key) || []
    if (!list.length) return fallback
    return list.shift()
  }

  const client = {
    from(table) {
      return {
        select() {
          const selectChain = {
            eq() {
              return selectChain
            },
            neq() {
              return selectChain
            },
            is() {
              return selectChain
            },
            in() {
              return selectChain
            },
            ilike() {
              return selectChain
            },
            limit() {
              return Promise.resolve(dequeue(`${table}.selectMany`, { data: [], error: null }))
            },
            order() {
              return Promise.resolve(dequeue(`${table}.selectMany`, { data: [], error: null }))
            },
            maybeSingle() {
              return Promise.resolve(
                dequeue(`${table}.selectMaybeSingle`, { data: null, error: null }),
              )
            },
            single() {
              return Promise.resolve(dequeue(`${table}.selectSingle`, { data: null, error: null }))
            },
            then(resolve) {
              resolve(dequeue(`${table}.selectMany`, { data: [], error: null }))
            },
          }
          return selectChain
        },
        insert() {
          return {
            select() {
              return {
                single() {
                  return Promise.resolve(
                    dequeue(`${table}.insertSingle`, { data: null, error: null }),
                  )
                },
              }
            },
            then(resolve) {
              resolve(dequeue(`${table}.insert`, { error: null }))
            },
          }
        },
        update() {
          const inner = {
            eq() {
              return inner
            },
            is() {
              return inner
            },
            select() {
              return Promise.resolve(
                dequeue(`${table}.updateSelect`, { data: [], error: null }),
              )
            },
            then(resolve) {
              resolve(dequeue(`${table}.updateEq`, { error: null }))
            },
          }
          return {
            eq() {
              return inner
            },
          }
        },
        delete() {
          return {
            eq() {
              return Promise.resolve(dequeue(`${table}.deleteEq`, { error: null }))
            },
          }
        },
        upsert() {
          return Promise.resolve(dequeue(`${table}.upsert`, { error: null }))
        },
      }
    },
    __enqueue: enqueue,
  }

  return client
}

function makeReq({
  params = {},
  query = {},
  body = {},
  user = { id: '11111111-1111-4111-8111-111111111111', email: 'admin@site.com' },
  auth = 'Bearer token-123',
} = {}) {
  return {
    params,
    query,
    body,
    user,
    headers: { authorization: auth },
  }
}

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  }
}

function getHandler(method, path) {
  const layer = router.stack.find(
    (l) => l.route?.path === path && Boolean(l.route.methods?.[method]),
  )
  if (!layer) throw new Error(`Route not found: ${method.toUpperCase()} ${path}`)
  return layer.route.stack[layer.route.stack.length - 1].handle
}

beforeEach(() => {
  jest.clearAllMocks()
  mockNormalizeUsername.mockImplementation((v) => String(v || '').trim().toLowerCase())
  mockNormalizeInviteEmail.mockImplementation((v) =>
    typeof v === 'string' && v.includes('@') ? v.trim().toLowerCase() : '',
  )
  mockGroupRoleForUserProfile.mockResolvedValue('member')
  mockEnsurePlatformAdminsInStokvel.mockResolvedValue({ error: null })
  mockCreateInvitation.mockResolvedValue({ data: { token: 'tok-1' }, error: null })
  mockGetServiceSupabase.mockReturnValue(null)
  mockActivateStokvel.mockReset()
  mockActivateStokvel.mockResolvedValue({ ok: true })
})

describe('adminStokvels routes', () => {
  describe('GET /users', () => {
    it('returns empty users array when query has fewer than 2 characters', async () => {
      const handler = getHandler('get', '/users')
      const req = makeReq({ query: { q: 'a' } })
      const res = makeRes()

      await handler(req, res)

      expect(res.json).toHaveBeenCalledWith({ users: [] })
    })

    it('returns 500 when profile search fails', async () => {
      const handler = getHandler('get', '/users')
      const client = createSupabaseMock()
      mockGetServiceSupabase.mockReturnValue(client)

      client.__enqueue('profiles.selectMany', { data: [], error: { message: 'DB down' } })
      client.__enqueue('profiles.selectMany', { data: [], error: null })
      client.__enqueue('profiles.selectMany', { data: [], error: null })
      client.__enqueue('profiles.selectMany', { data: [], error: null })

      const req = makeReq({ query: { q: 'john' } })
      const res = makeRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({ error: 'DB down' })
    })

    it('returns deduplicated and labeled users when search succeeds', async () => {
      const handler = getHandler('get', '/users')
      const client = createSupabaseMock()
      mockGetServiceSupabase.mockReturnValue(client)

      client.__enqueue('profiles.selectMany', {
        data: [{ id: 'u1', first_name: 'John', last_name: 'Doe', username: 'john', email: 'j@x.com' }],
        error: null,
      })
      client.__enqueue('profiles.selectMany', {
        data: [{ id: 'u1', first_name: 'John', last_name: 'Doe', username: 'john', email: 'j@x.com' }],
        error: null,
      })
      client.__enqueue('profiles.selectMany', {
        data: [{ id: 'u2', first_name: '', last_name: '', username: '', email: 'x@y.com' }],
        error: null,
      })
      client.__enqueue('profiles.selectMany', { data: [], error: null })

      const req = makeReq({ query: { q: 'john' } })
      const res = makeRes()

      await handler(req, res)

      expect(res.json).toHaveBeenCalledWith({
        users: [
          {
            id: 'u1',
            username: 'john',
            firstName: 'John',
            lastName: 'Doe',
            email: 'j@x.com',
            label: '@john · John Doe',
          },
          {
            id: 'u2',
            username: '',
            firstName: '',
            lastName: '',
            email: 'x@y.com',
            label: 'u2',
          },
        ],
      })
    })
  })

  describe('POST /stokvels', () => {
    it('returns 400 when group name is missing', async () => {
      const handler = getHandler('post', '/stokvels')
      const req = makeReq({ body: { name: '   ' } })
      const res = makeRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({ error: 'Group name is required' })
    })

    it('returns 400 when contribution amount is invalid', async () => {
      const handler = getHandler('post', '/stokvels')
      const req = makeReq({
        body: { name: 'A', contributionAmount: 0, type: 'Rotating', cycleLength: 1 },
      })
      const res = makeRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({
        error: 'Contribution amount must be a positive number',
      })
    })

    it('returns 400 when stokvel type is invalid', async () => {
      const handler = getHandler('post', '/stokvels')
      const req = makeReq({
        body: { name: 'A', contributionAmount: 10, type: 'Other', cycleLength: 1 },
      })
      const res = makeRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid stokvel type' })
    })

    it('returns 500 when duplicate check fails', async () => {
      const handler = getHandler('post', '/stokvels')
      const client = createSupabaseMock()
      mockGetServiceSupabase.mockReturnValue(client)
      client.__enqueue('stokvels.selectMaybeSingle', { data: null, error: { message: 'dup check failed' } })

      const req = makeReq({
        body: { name: 'Group A', contributionAmount: 100, type: 'Rotating', cycleLength: 6 },
      })
      const res = makeRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({ error: 'dup check failed' })
    })

    it('returns 409 when group name already exists', async () => {
      const handler = getHandler('post', '/stokvels')
      const client = createSupabaseMock()
      mockGetServiceSupabase.mockReturnValue(client)
      client.__enqueue('stokvels.selectMaybeSingle', { data: { id: 'existing' }, error: null })

      const req = makeReq({
        body: { name: 'Group A', contributionAmount: 100, type: 'Rotating', cycleLength: 6 },
      })
      const res = makeRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(409)
      expect(res.json).toHaveBeenCalledWith({
        error: 'A stokvel with this name already exists. Choose a different name.',
      })
    })

    it('returns 500 with constraint hint when creator member insert fails group_role_check', async () => {
      const handler = getHandler('post', '/stokvels')
      const client = createSupabaseMock()
      mockGetServiceSupabase.mockReturnValue(client)

      client.__enqueue('stokvels.selectMaybeSingle', { data: null, error: null })
      client.__enqueue('stokvels.insertSingle', { data: { id: 's1', name: 'Group A' }, error: null })
      client.__enqueue('stokvel_members.insert', { error: { message: 'group_role_check violated' } })
      client.__enqueue('stokvels.deleteEq', { error: null })

      const req = makeReq({
        body: {
          name: 'Group A',
          contributionAmount: 100,
          type: 'Rotating',
          cycleLength: 6,
        },
      })
      const res = makeRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json.mock.calls[0][0].error).toContain('group_role_check')
      expect(res.json.mock.calls[0][0].error).toContain('Run supabase/migrations')
    })

    it('returns 201 on successful create flow', async () => {
      const handler = getHandler('post', '/stokvels')
      const client = createSupabaseMock()
      mockGetServiceSupabase.mockReturnValue(client)

      client.__enqueue('stokvels.selectMaybeSingle', { data: null, error: null })
      client.__enqueue('stokvels.insertSingle', { data: { id: 's1', name: 'Group A' }, error: null })
      client.__enqueue('stokvel_members.insert', { error: null })
      client.__enqueue('profiles.selectMany', { data: [{ id: 'u2', role: 'user' }], error: null })
      client.__enqueue('stokvel_members.insert', { error: null })
      mockEnsurePlatformAdminsInStokvel.mockResolvedValue({ error: null })
      client.__enqueue('profiles.selectMaybeSingle', { data: { email: 'member@test.com' }, error: null })
      client.__enqueue('stokvels.selectMaybeSingle', {
        data: { id: 's1', name: 'Group A', status: 'active' },
        error: null,
      })

      const req = makeReq({
        body: {
          name: 'Group A',
          contributionAmount: 100,
          type: 'Rotating',
          cycleLength: 6,
          initialMemberIds: ['22222222-2222-4222-8222-222222222222'],
          treasurerUserId: '22222222-2222-4222-8222-222222222222',
          membersCount: 2,
          memberDetails: [],
          documents: [' doc1.pdf '],
        },
      })
      const res = makeRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(201)
      expect(mockActivateStokvel).toHaveBeenCalled()
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        stokvel: { id: 's1', name: 'Group A', status: 'active' },
      })
    })
  })

  describe('POST /stokvels/:stokvelId/members', () => {
    it('returns 400 when no identifier is provided', async () => {
      const handler = getHandler('post', '/stokvels/:stokvelId/members')
      const req = makeReq({ params: { stokvelId: 's1' }, body: {} })
      const res = makeRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json.mock.calls[0][0].error).toContain('Provide username')
    })

    it('returns 400 when username normalization fails', async () => {
      const handler = getHandler('post', '/stokvels/:stokvelId/members')
      mockNormalizeUsername.mockReturnValue('')

      const req = makeReq({
        params: { stokvelId: 's1' },
        body: { username: '$$' },
      })
      const res = makeRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json.mock.calls[0][0].error).toContain('Username must be 3')
    })

    it('returns 404 when target group does not exist', async () => {
      const handler = getHandler('post', '/stokvels/:stokvelId/members')
      const client = createSupabaseMock()
      mockGetServiceSupabase.mockReturnValue(client)

      mockNormalizeUsername.mockReturnValue('newmember')
      client.__enqueue('profiles.selectMaybeSingle', { data: { id: 'u2' }, error: null })
      client.__enqueue('stokvels.selectMaybeSingle', { data: null, error: null })

      const req = makeReq({
        params: { stokvelId: 's1' },
        body: { username: 'newmember' },
      })
      const res = makeRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(404)
      expect(res.json).toHaveBeenCalledWith({ error: 'Stokvel not found' })
    })

    it('returns 409 when member is already in group', async () => {
      const handler = getHandler('post', '/stokvels/:stokvelId/members')
      const client = createSupabaseMock()
      mockGetServiceSupabase.mockReturnValue(client)

      client.__enqueue('profiles.selectMaybeSingle', { data: { id: 'u2' }, error: null })
      client.__enqueue('stokvels.selectMaybeSingle', { data: { id: 's1', name: 'Group A' }, error: null })
      client.__enqueue('stokvel_members.selectMaybeSingle', { data: { id: 'already' }, error: null })

      const req = makeReq({
        params: { stokvelId: 's1' },
        body: { username: 'u2' },
      })
      const res = makeRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(409)
      expect(res.json).toHaveBeenCalledWith({
        error: 'That user is already a member of this stokvel.',
      })
    })

    it('returns 201 and userId when add member succeeds', async () => {
      const handler = getHandler('post', '/stokvels/:stokvelId/members')
      const client = createSupabaseMock()
      mockGetServiceSupabase.mockReturnValue(client)
      mockGroupRoleForUserProfile.mockResolvedValue('member')

      client.__enqueue('profiles.selectMaybeSingle', { data: { id: 'u2' }, error: null }) // resolve username
      client.__enqueue('stokvels.selectMaybeSingle', { data: { id: 's1', name: 'Group A' }, error: null }) // group
      client.__enqueue('stokvel_members.selectMaybeSingle', { data: null, error: null }) // duplicate check
      client.__enqueue('stokvel_members.insert', { error: null }) // insert member
      client.__enqueue('profiles.selectMaybeSingle', { data: { email: 'user2@site.com' }, error: null }) // notify lookup

      const req = makeReq({
        params: { stokvelId: 's1' },
        body: { username: 'u2' },
      })
      const res = makeRes()

      await handler(req, res)

      expect(mockSendGroupAddedEmail).toHaveBeenCalledWith({
        to: 'user2@site.com',
        groupName: 'Group A',
        role: 'member',
      })
      expect(res.status).toHaveBeenCalledWith(201)
      expect(res.json).toHaveBeenCalledWith({ success: true, userId: 'u2' })
    })
  })

  describe('POST /stokvels/:stokvelId/invitations', () => {
    it('returns 400 for invalid email input', async () => {
      const handler = getHandler('post', '/stokvels/:stokvelId/invitations')
      mockNormalizeInviteEmail.mockReturnValue('')

      const req = makeReq({ params: { stokvelId: 's1' }, body: { email: 'bad' } })
      const res = makeRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({ error: 'Provide a valid email address.' })
    })

    it('returns 201 added_existing_user when profile exists', async () => {
      const handler = getHandler('post', '/stokvels/:stokvelId/invitations')
      const client = createSupabaseMock()
      mockGetServiceSupabase.mockReturnValue(client)
      mockGroupRoleForUserProfile.mockResolvedValue('admin')

      client.__enqueue('stokvels.selectMaybeSingle', { data: { id: 's1', name: 'Group A' }, error: null })
      client.__enqueue('profiles.selectMaybeSingle', { data: { id: 'u2' }, error: null })
      client.__enqueue('stokvel_members.upsert', { error: null })

      const req = makeReq({
        params: { stokvelId: 's1' },
        body: { email: 'member@site.com' },
      })
      const res = makeRes()

      await handler(req, res)

      expect(mockSendGroupAddedEmail).toHaveBeenCalledWith({
        to: 'member@site.com',
        groupName: 'Group A',
        role: 'admin',
      })
      expect(res.status).toHaveBeenCalledWith(201)
      expect(res.json).toHaveBeenCalledWith({ success: true, mode: 'added_existing_user' })
    })

    it('returns 201 invite_sent when creating invitation for non-existing profile', async () => {
      const handler = getHandler('post', '/stokvels/:stokvelId/invitations')
      const client = createSupabaseMock()
      mockGetServiceSupabase.mockReturnValue(client)

      client.__enqueue('stokvels.selectMaybeSingle', { data: { id: 's1', name: 'Group A' }, error: null })
      client.__enqueue('profiles.selectMaybeSingle', { data: null, error: null })
      mockCreateInvitation.mockResolvedValue({ data: { token: 'token-xyz' }, error: null })

      const req = makeReq({
        params: { stokvelId: 's1' },
        body: { email: 'new@site.com' },
      })
      const res = makeRes()

      await handler(req, res)

      expect(mockSendInvitationEmail).toHaveBeenCalledWith({
        to: 'new@site.com',
        groupName: 'Group A',
        token: 'token-xyz',
      })
      expect(res.status).toHaveBeenCalledWith(201)
      expect(res.json).toHaveBeenCalledWith({ success: true, mode: 'invite_sent' })
    })
  })

  describe('GET /stokvels', () => {
    it('returns 500 when list query fails', async () => {
      const handler = getHandler('get', '/stokvels')
      const client = createSupabaseMock()
      mockGetServiceSupabase.mockReturnValue(client)
      client.__enqueue('stokvels.selectMany', { data: null, error: { message: 'read failed' } })

      const req = makeReq()
      const res = makeRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({ error: 'read failed' })
    })

    it('returns stokvel list on success', async () => {
      const handler = getHandler('get', '/stokvels')
      const client = createSupabaseMock()
      mockGetServiceSupabase.mockReturnValue(client)
      client.__enqueue('stokvels.selectMany', {
        data: [{ id: 's1', name: 'Group A' }],
        error: null,
      })

      const req = makeReq()
      const res = makeRes()

      await handler(req, res)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        stokvels: [{ id: 's1', name: 'Group A' }],
      })
    })
  })

  describe('GET /stokvels/:stokvelId', () => {
    it('returns 404 when stokvel does not exist', async () => {
      const handler = getHandler('get', '/stokvels/:stokvelId')
      const client = createSupabaseMock()
      mockGetServiceSupabase.mockReturnValue(client)
      client.__enqueue('stokvels.selectMaybeSingle', { data: null, error: null })

      const req = makeReq({ params: { stokvelId: 'missing' } })
      const res = makeRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(404)
      expect(res.json).toHaveBeenCalledWith({ error: 'Stokvel not found' })
    })

    it('returns stokvel details on success', async () => {
      const handler = getHandler('get', '/stokvels/:stokvelId')
      const client = createSupabaseMock()
      mockGetServiceSupabase.mockReturnValue(client)
      client.__enqueue('stokvels.selectMaybeSingle', { data: { id: 's1', name: 'Group A' }, error: null })

      const req = makeReq({ params: { stokvelId: 's1' } })
      const res = makeRes()

      await handler(req, res)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        stokvel: { id: 's1', name: 'Group A' },
      })
    })
  })

  describe('PATCH /stokvels/:stokvelId', () => {
    it('returns 400 when no valid patch fields are provided', async () => {
      const handler = getHandler('patch', '/stokvels/:stokvelId')
      const client = createSupabaseMock()
      mockGetServiceSupabase.mockReturnValue(client)
      client.__enqueue('stokvels.selectMaybeSingle', { data: { id: 's1' }, error: null })

      const req = makeReq({ params: { stokvelId: 's1' }, body: {} })
      const res = makeRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({ error: 'No valid fields to update.' })
    })

    it('returns 500 when update returns no rows and current row does not match patch', async () => {
      const handler = getHandler('patch', '/stokvels/:stokvelId')
      const client = createSupabaseMock()
      mockGetServiceSupabase.mockReturnValue(client)

      client.__enqueue('stokvels.selectMaybeSingle', { data: { id: 's1' }, error: null }) // existing
      client.__enqueue('stokvels.selectMaybeSingle', { data: null, error: null }) // dup name check
      client.__enqueue('stokvels.updateSelect', { data: [], error: null }) // update no rows
      client.__enqueue('stokvels.selectMaybeSingle', { data: { id: 's1', name: 'Old' }, error: null }) // refetch mismatch

      const req = makeReq({ params: { stokvelId: 's1' }, body: { name: 'Renamed' } })
      const res = makeRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json.mock.calls[0][0].error).toContain('No rows were updated')
    })

    it('returns success and processes pending group requests when status becomes active', async () => {
      const handler = getHandler('patch', '/stokvels/:stokvelId')
      const client = createSupabaseMock()
      mockGetServiceSupabase.mockReturnValue(client)

      // existing group
      client.__enqueue('stokvels.selectMaybeSingle', { data: { id: 's1' }, error: null })

      // pre-invite stokvel row (name for emails)
      client.__enqueue('stokvels.selectMaybeSingle', {
        data: { id: 's1', name: 'Group A', status: 'pending' },
        error: null,
      })

      // pending invites
      client.__enqueue('invitations.selectMany', {
        data: [
          { id: 'i1', email: 'existing@site.com', group_role: 'member' },
          { id: 'i2', email: 'new@site.com', group_role: 'admin' },
        ],
        error: null,
      })

      // existing profile branch
      client.__enqueue('profiles.selectMaybeSingle', { data: { id: 'u2' }, error: null })
      client.__enqueue('stokvel_members.upsert', { error: null })

      // new profile branch
      client.__enqueue('profiles.selectMaybeSingle', { data: null, error: null })
      mockCreateInvitation.mockResolvedValueOnce({ data: { token: 'inv-token' }, error: null })

      // processed status updates
      client.__enqueue('invitations.updateEq', { error: null })
      client.__enqueue('invitations.updateEq', { error: null })

      // final refetch after activation
      client.__enqueue('stokvels.selectMaybeSingle', {
        data: { id: 's1', name: 'Group A', status: 'active' },
        error: null,
      })

      // getGroupAndCreatorContact
      client.__enqueue('stokvels.selectMaybeSingle', { data: { id: 's1', name: 'Group A' }, error: null })
      client.__enqueue('stokvel_members.selectMaybeSingle', {
        data: { user_id: '22222222-2222-4222-8222-222222222222' },
        error: null,
      })
      client.__enqueue('profiles.selectMaybeSingle', { data: { email: 'treasurer@site.com' }, error: null })

      const req = makeReq({
        params: { stokvelId: 's1' },
        body: { status: 'active' },
      })
      const res = makeRes()

      await handler(req, res)

      expect(mockActivateStokvel).toHaveBeenCalledWith('s1', client)
      expect(mockSendGroupStatusEmail).toHaveBeenCalledWith({
        to: 'treasurer@site.com',
        groupName: 'Group A',
        status: 'active',
      })
      expect(mockSendGroupAddedEmail).toHaveBeenCalledWith({
        to: 'existing@site.com',
        groupName: 'Group A',
        role: 'member',
      })
      expect(mockSendInvitationEmail).toHaveBeenCalledWith({
        to: 'new@site.com',
        groupName: 'Group A',
        token: 'inv-token',
      })
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        stokvel: { id: 's1', name: 'Group A', status: 'active' },
      })
    })

    it('handles approving an already-approved stokvel gracefully', async () => {
      const handler = getHandler('patch', '/stokvels/:stokvelId')
      const client = createSupabaseMock()
      mockGetServiceSupabase.mockReturnValue(client)
      mockActivateStokvel.mockResolvedValue({ ok: true, skipped: true, payoutCount: 6 })

      client.__enqueue('stokvels.selectMaybeSingle', { data: { id: 's1' }, error: null })
      client.__enqueue('stokvels.selectMaybeSingle', {
        data: { id: 's1', name: 'Group A', status: 'active' },
        error: null,
      })
      client.__enqueue('invitations.selectMany', { data: [], error: null })
      client.__enqueue('stokvels.selectMaybeSingle', {
        data: { id: 's1', name: 'Group A', status: 'active' },
        error: null,
      })
      client.__enqueue('stokvels.selectMaybeSingle', {
        data: { id: 's1', name: 'Group A' },
        error: null,
      })
      client.__enqueue('stokvel_members.selectMaybeSingle', { data: null, error: null })

      const req = makeReq({ params: { stokvelId: 's1' }, body: { status: 'active' } })
      const res = makeRes()

      await handler(req, res)

      expect(mockActivateStokvel).toHaveBeenCalledWith('s1', client)
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        stokvel: { id: 's1', name: 'Group A', status: 'active' },
      })
    })

    it('returns 500 when update operation fails', async () => {
      const handler = getHandler('patch', '/stokvels/:stokvelId')
      const client = createSupabaseMock()
      mockGetServiceSupabase.mockReturnValue(client)

      client.__enqueue('stokvels.selectMaybeSingle', { data: { id: 's1' }, error: null })
      client.__enqueue('stokvels.selectMaybeSingle', { data: null, error: null }) // dup check
      client.__enqueue('stokvels.updateSelect', {
        data: null,
        error: { message: 'update failed hard' },
      })

      const req = makeReq({
        params: { stokvelId: 's1' },
        body: { name: 'Updated Name' },
      })
      const res = makeRes()

      await handler(req, res)
      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({ error: 'update failed hard' })
    })
  })

  describe('DELETE /stokvels/:stokvelId', () => {
    it('returns 404 when stokvel is not found', async () => {
      const handler = getHandler('delete', '/stokvels/:stokvelId')
      const client = createSupabaseMock()
      mockGetServiceSupabase.mockReturnValue(client)
      client.__enqueue('stokvels.selectMaybeSingle', { data: null, error: null })

      const req = makeReq({ params: { stokvelId: 's1' } })
      const res = makeRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(404)
      expect(res.json).toHaveBeenCalledWith({ error: 'Stokvel not found' })
    })

    it('returns 500 if deleting memberships fails', async () => {
      const handler = getHandler('delete', '/stokvels/:stokvelId')
      const client = createSupabaseMock()
      mockGetServiceSupabase.mockReturnValue(client)

      client.__enqueue('stokvels.selectMaybeSingle', { data: { id: 's1', name: 'Group A' }, error: null })
      client.__enqueue('stokvel_members.deleteEq', { error: { message: 'cannot delete members' } })

      const req = makeReq({ params: { stokvelId: 's1' } })
      const res = makeRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({ error: 'cannot delete members' })
    })

    it('returns success after full cascade delete', async () => {
      const handler = getHandler('delete', '/stokvels/:stokvelId')
      const client = createSupabaseMock()
      mockGetServiceSupabase.mockReturnValue(client)

      client.__enqueue('stokvels.selectMaybeSingle', { data: { id: 's1', name: 'Group A' }, error: null })
      client.__enqueue('stokvel_members.deleteEq', { error: null })
      client.__enqueue('invitations.deleteEq', { error: null })
      client.__enqueue('meetings.deleteEq', { error: null })
      client.__enqueue('contributions.deleteEq', { error: null })
      client.__enqueue('payouts.deleteEq', { error: null })
      client.__enqueue('issues.deleteEq', { error: null })
      client.__enqueue('stokvels.deleteEq', { error: null })

      const req = makeReq({ params: { stokvelId: 's1' } })
      const res = makeRes()

      await handler(req, res)

      expect(res.json).toHaveBeenCalledWith({ success: true, deletedId: 's1' })
    })
  })

  describe('db client fallback behavior', () => {
    it('uses user-scoped createClient when service client is unavailable', async () => {
      const handler = getHandler('get', '/stokvels')
      const fallbackClient = createSupabaseMock()

      mockGetServiceSupabase.mockReturnValue(null)
      mockCreateClient.mockReturnValue(fallbackClient)
      fallbackClient.__enqueue('stokvels.selectMany', { data: [], error: null })

      const req = makeReq({ auth: 'Bearer fallback-token' })
      const res = makeRes()

      await handler(req, res)

      expect(mockCreateClient).toHaveBeenCalled()
      expect(res.json).toHaveBeenCalledWith({ success: true, stokvels: [] })
    })
  })
})