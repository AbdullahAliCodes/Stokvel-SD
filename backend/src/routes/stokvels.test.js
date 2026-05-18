import request from 'supertest'
import express from 'express'
import { jest, describe, it, expect, beforeEach } from '@jest/globals'

const mockCreateClient = jest.fn()
const mockCreateUserJwtSupabase = jest.fn()
const mockGetServiceSupabase = jest.fn()
const mockNormalizeInviteEmail = jest.fn()
const mockSendMeetingScheduledEmail = jest.fn()
const mockSearchProfilesForMemberInvite = jest.fn((_req, res) =>
  res.json({ success: true, users: [] }),
)
const mockAxiosGet = jest.fn()

jest.unstable_mockModule('@supabase/supabase-js', () => ({
  createClient: mockCreateClient,
}))

jest.unstable_mockModule('../middleware/auth.js', () => ({
  requireAuth: (req, res, next) => {
    if (req.headers?.['x-test-unauth'] === '1') {
      return res.status(401).json({ error: 'Missing or malformed authorization header' })
    }
    const roleHeader = req.headers?.['x-test-role']
    req.user = {
      id: '11111111-1111-4111-8111-111111111111',
      role: typeof roleHeader === 'string' ? roleHeader : 'user',
      email: 'admin@site.com',
    }
    req.headers = req.headers || {}
    req.headers.authorization = req.headers.authorization || 'Bearer test-token'
    next()
  },
}))

jest.unstable_mockModule('../utils/invitations.js', () => ({
  normalizeInviteEmail: mockNormalizeInviteEmail,
  sendMeetingScheduledEmail: mockSendMeetingScheduledEmail,
}))

jest.unstable_mockModule('../utils/supabaseAdmin.js', () => ({
  getServiceSupabase: mockGetServiceSupabase,
  createUserJwtSupabase: mockCreateUserJwtSupabase,
}))

jest.unstable_mockModule('../utils/profileUserSearch.js', () => ({
  searchProfilesForMemberInvite: mockSearchProfilesForMemberInvite,
}))

jest.unstable_mockModule('axios', () => ({
  default: { get: mockAxiosGet },
}))

const { default: router } = await import('./stokvels.js')

function createSupabaseMock() {
  const q = new Map()
  const push = (key, value) => {
    const list = q.get(key) || []
    list.push(value)
    q.set(key, list)
  }
  const pop = (key, fallback = { data: null, error: null }) => {
    const list = q.get(key) || []
    if (!list.length) return fallback
    return list.shift()
  }

  const makeSelectChain = (table) => {
    const chain = {
      eq() {
        return chain
      },
      neq() {
        return chain
      },
      in() {
        return chain
      },
      is() {
        return chain
      },
      limit() {
        return Promise.resolve(pop(`${table}.selectLimit`, { data: [], error: null }))
      },
      order() {
        return Promise.resolve(pop(`${table}.selectMany`, { data: [], error: null }))
      },
      maybeSingle() {
        return Promise.resolve(pop(`${table}.selectMaybeSingle`, { data: null, error: null }))
      },
      single() {
        return Promise.resolve(pop(`${table}.selectSingle`, { data: null, error: null }))
      },
      then(resolve) {
        resolve(pop(`${table}.selectMany`, { data: [], error: null }))
      },
    }
    return chain
  }

  const makeInsertChain = (table) => {
    const chain = {
      select() {
        return {
          single() {
            return Promise.resolve(pop(`${table}.insertSingle`, { data: null, error: null }))
          },
        }
      },
      then(resolve) {
        resolve(pop(`${table}.insertDirect`, { data: null, error: null }))
      },
    }
    return chain
  }

  const makeUpdateChain = (table) => {
    const inner = {
      eq() {
        return inner
      },
      neq() {
        return inner
      },
      is() {
        return inner
      },
      select() {
        return {
          maybeSingle() {
            return Promise.resolve(
              pop(`${table}.updateSelectMaybeSingle`, { data: null, error: null }),
            )
          },
        }
      },
      then(resolve) {
        resolve(pop(`${table}.updateEq`, { error: null }))
      },
    }
    return {
      eq() {
        return inner
      },
    }
  }

  const makeDeleteChain = (table) => {
    const chain = {
      eq() {
        return chain
      },
      select() {
        return {
          maybeSingle() {
            return Promise.resolve(
              pop(`${table}.deleteSelectMaybeSingle`, { data: null, error: null }),
            )
          },
        }
      },
      then(resolve) {
        resolve(pop(`${table}.deleteEq`, { error: null }))
      },
    }
    return chain
  }

  return {
    from(table) {
      return {
        select() {
          return makeSelectChain(table)
        },
        insert() {
          return makeInsertChain(table)
        },
        update() {
          return makeUpdateChain(table)
        },
        delete() {
          return makeDeleteChain(table)
        },
      }
    },
    __push: push,
  }
}

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/stokvels', router)
  return app
}

beforeEach(() => {
  jest.resetAllMocks()
  mockGetServiceSupabase.mockReturnValue(null)
  mockCreateUserJwtSupabase.mockImplementation(() => mockCreateClient())
  mockSearchProfilesForMemberInvite.mockImplementation((_req, res) =>
    res.json({ success: true, users: [] }),
  )
  mockNormalizeInviteEmail.mockImplementation((v) =>
    typeof v === 'string' && v.includes('@') ? v.trim().toLowerCase() : '',
  )
})

describe('stokvels routes', () => {
  it('GET / returns 500 when membership query fails', async () => {
    const client = createSupabaseMock()
    mockCreateClient.mockReturnValue(client)
    client.__push('stokvel_members.selectMany', { data: null, error: { message: 'membership list failed' } })

    const res = await request(makeApp()).get('/api/stokvels/')
    expect(res.status).toBe(500)
    expect(res.body.error).toBe('membership list failed')
  })

  it('GET / returns memberships list', async () => {
    const client = createSupabaseMock()
    mockCreateClient.mockReturnValue(client)
    client.__push('stokvel_members.selectMany', {
      data: [{ group_role: 'member', stokvels: { id: 's1', name: 'A' } }],
      error: null,
    })

    const res = await request(makeApp()).get('/api/stokvels')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      success: true,
      memberships: [{ group_role: 'member', stokvels: { id: 's1', name: 'A' } }],
    })
  })

  it('GET /:id returns 404 for invalid stokvel id format', async () => {
    const res = await request(makeApp()).get('/api/stokvels/not-a-uuid')
    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: 'Not found' })
  })

  it('GET /:id returns full stokvel details with contributions and members', async () => {
    const client = createSupabaseMock()
    mockCreateClient.mockReturnValue(client)
    mockGetServiceSupabase.mockReturnValue(client)
    client.__push('stokvel_members.selectMaybeSingle', { data: { group_role: 'member' }, error: null })
    client.__push('stokvels.selectSingle', { data: { id: 's1', name: 'Group A' }, error: null })
    client.__push('stokvel_members.selectMany', {
      data: [{ user_id: 'u1', group_role: 'member', profiles: { first_name: 'A', last_name: 'B' } }],
      error: null,
    })
    client.__push('contributions.selectMany', {
      data: [
        {
          id: 'c1',
          amount: 100,
          user_id: 'u1',
          paid_at: '2026-04-01',
          target_month: '2026-04',
          paystack_reference: 'ref-1',
        },
      ],
      error: null,
    })
    client.__push('payouts.selectMany', {
      data: [
        {
          id: 'p1',
          stokvel_id: 's1',
          user_id: 'u1',
          target_month: '2026-04',
          scheduled_payout_date: '2026-04-05',
          cycle_index: 0,
          created_at: '2026-01-01',
        },
      ],
      error: null,
    })
    client.__push('missed_payments.selectMany', {
      data: [
        {
          id: 'mp1',
          stokvel_id: 's1',
          user_id: 'u1',
          target_month: '2026-03',
          resolved_at: null,
          flagged_by: '11111111-1111-4111-8111-111111111111',
          created_at: '2026-01-02',
        },
      ],
      error: null,
    })
    client.__push('profiles.selectMany', {
      data: [{ id: 'u1', first_name: 'A', last_name: 'B' }],
      error: null,
    })

    const res = await request(makeApp()).get('/api/stokvels/11111111-1111-1111-1111-111111111111')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.totalContribution).toBe(100)
    expect(res.body.contributions[0].profiles).toEqual({ first_name: 'A', last_name: 'B' })
    expect(res.body.contributions[0].target_month).toBe('2026-04')
    expect(res.body.contributions[0].paystack_reference).toBe('ref-1')
    expect(res.body.currentCycle).toHaveProperty('targetMonth')
    expect(res.body.currentCycle).toHaveProperty('inPaymentWindow')
    expect(res.body.payouts).toHaveLength(1)
    expect(res.body.missedPayments).toHaveLength(1)
  })

  it('GET /:id returns 404 for non-member access', async () => {
    const client = createSupabaseMock()
    mockCreateClient.mockReturnValue(client)
    client.__push('stokvel_members.selectMaybeSingle', { data: null, error: null })

    const res = await request(makeApp()).get('/api/stokvels/11111111-1111-1111-1111-111111111111')
    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: 'Not found' })
  })

  it('GET /:id allows platform admin without group membership', async () => {
    const client = createSupabaseMock()
    mockCreateClient.mockReturnValue(client)
    mockGetServiceSupabase.mockReturnValue(client)
    client.__push('stokvels.selectSingle', { data: { id: 's1', name: 'Admin View' }, error: null })
    client.__push('stokvel_members.selectMany', { data: [], error: null })
    client.__push('contributions.selectMany', { data: [], error: null })
    client.__push('payouts.selectMany', { data: [], error: null })
    client.__push('missed_payments.selectMany', { data: [], error: null })

    const res = await request(makeApp())
      .get('/api/stokvels/11111111-1111-1111-1111-111111111111')
      .set('x-test-role', 'admin')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.membership.group_role).toBe('admin')
  })

  it('POST /:id/missed-payments returns 403 when requester is not admin/treasurer', async () => {
    const client = createSupabaseMock()
    mockCreateClient.mockReturnValue(client)
    mockGetServiceSupabase.mockReturnValue(client)
    client.__push('stokvel_members.selectMaybeSingle', {
      data: { group_role: 'member' },
      error: null,
    })

    const res = await request(makeApp())
      .post('/api/stokvels/11111111-1111-1111-1111-111111111111/missed-payments')
      .send({
        user_id: '22222222-2222-4222-8222-222222222222',
        target_month: '2026-03',
      })

    expect(res.status).toBe(403)
  })

  it('POST /:id/missed-payments returns 201 when insert succeeds', async () => {
    const client = createSupabaseMock()
    mockCreateClient.mockReturnValue(client)
    mockGetServiceSupabase.mockReturnValue(client)
    client.__push('stokvel_members.selectMaybeSingle', {
      data: { group_role: 'treasurer' },
      error: null,
    })
    client.__push('stokvel_members.selectMaybeSingle', {
      data: { user_id: '22222222-2222-4222-8222-222222222222' },
      error: null,
    })
    client.__push('missed_payments.insertDirect', { data: [{ id: 'mp1' }], error: null })

    const res = await request(makeApp())
      .post('/api/stokvels/11111111-1111-1111-1111-111111111111/missed-payments')
      .send({
        user_id: '22222222-2222-4222-8222-222222222222',
        target_month: '2026-03',
      })

    expect(res.status).toBe(201)
    expect(res.body).toEqual({ success: true, alreadyFlagged: false })
  })

  it('POST /:id/missed-payments returns 200 alreadyFlagged on unique violation', async () => {
    const client = createSupabaseMock()
    mockCreateClient.mockReturnValue(client)
    mockGetServiceSupabase.mockReturnValue(client)
    client.__push('stokvel_members.selectMaybeSingle', {
      data: { group_role: 'admin' },
      error: null,
    })
    client.__push('stokvel_members.selectMaybeSingle', {
      data: { user_id: '22222222-2222-4222-8222-222222222222' },
      error: null,
    })
    client.__push('missed_payments.insertDirect', {
      data: null,
      error: { code: '23505', message: 'duplicate key' },
    })

    const res = await request(makeApp())
      .post('/api/stokvels/11111111-1111-1111-1111-111111111111/missed-payments')
      .send({
        user_id: '22222222-2222-4222-8222-222222222222',
        target_month: '2026-03',
      })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ success: true, alreadyFlagged: true })
  })

  it('POST /:id/missed-payments returns 400 for invalid target_month', async () => {
    const client = createSupabaseMock()
    mockCreateClient.mockReturnValue(client)
    mockGetServiceSupabase.mockReturnValue(client)
    client.__push('stokvel_members.selectMaybeSingle', {
      data: { group_role: 'admin' },
      error: null,
    })

    const res = await request(makeApp())
      .post('/api/stokvels/11111111-1111-1111-1111-111111111111/missed-payments')
      .send({
        user_id: '22222222-2222-4222-8222-222222222222',
        target_month: '2026-13',
      })

    expect(res.status).toBe(400)
  })

  it('GET /:id/meetings returns 404 when membership is missing', async () => {
    const client = createSupabaseMock()
    mockCreateClient.mockReturnValue(client)
    client.__push('stokvel_members.selectMaybeSingle', { data: null, error: null })

    const res = await request(makeApp()).get('/api/stokvels/s1/meetings')

    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: 'Not found' })
  })

  it('GET /:id/meetings returns meetings when access exists', async () => {
    const client = createSupabaseMock()
    mockCreateClient.mockReturnValue(client)
    client.__push('stokvel_members.selectMaybeSingle', { data: { group_role: 'member' }, error: null })
    client.__push('meetings.selectMany', { data: [{ id: 'm1', title: 'Planning' }], error: null })

    const res = await request(makeApp()).get('/api/stokvels/s1/meetings')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ success: true, meetings: [{ id: 'm1', title: 'Planning' }] })
  })

  it('POST /:id/meetings returns 403 when requester is not admin/treasurer', async () => {
    const client = createSupabaseMock()
    mockCreateClient.mockReturnValue(client)
    client.__push('stokvel_members.selectMaybeSingle', { data: { group_role: 'member' }, error: null })

    const res = await request(makeApp()).post('/api/stokvels/s1/meetings').send({
      title: 'Planning',
      meetingDate: '2026-04-30',
    })

    expect(res.status).toBe(403)
    expect(res.body).toEqual({ error: 'Only admin or treasurer can schedule meetings.' })
  })

  it('POST /:id/meetings returns 400 when title or date missing', async () => {
    const client = createSupabaseMock()
    mockCreateClient.mockReturnValue(client)
    client.__push('stokvel_members.selectMaybeSingle', { data: { group_role: 'admin' }, error: null })

    const res = await request(makeApp()).post('/api/stokvels/s1/meetings').send({ title: '' })

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'Title and meeting date are required.' })
  })

  it('POST /:id/meetings creates meeting and sends notifications', async () => {
    const client = createSupabaseMock()
    mockCreateClient.mockReturnValue(client)
    client.__push('stokvel_members.selectMaybeSingle', { data: { group_role: 'admin' }, error: null })
    client.__push('meetings.insertSingle', {
      data: { id: 'm1', title: 'Planning', meeting_date: '2026-05-01', meeting_link: null, agenda: null, notes: null },
      error: null,
    })
    client.__push('stokvels.selectMaybeSingle', { data: { name: 'Group A' }, error: null })
    client.__push('stokvel_members.selectMany', { data: [{ user_id: 'u1' }, { user_id: 'u2' }], error: null })
    client.__push('profiles.selectMany', {
      data: [{ id: 'u1', email: 'a@x.com' }, { id: 'u2', email: 'b@x.com' }],
      error: null,
    })

    const res = await request(makeApp()).post('/api/stokvels/s1/meetings').send({
      title: 'Planning',
      meetingDate: '2026-05-01',
      agenda: 'Agenda',
    })

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(mockSendMeetingScheduledEmail).toHaveBeenCalledTimes(2)
  })

  it('POST /:id/meetings loads profile emails via service client when configured', async () => {
    const userClient = createSupabaseMock()
    const svcClient = createSupabaseMock()
    mockCreateClient.mockReturnValue(userClient)
    mockGetServiceSupabase.mockReturnValue(svcClient)

    userClient.__push('stokvel_members.selectMaybeSingle', {
      data: { group_role: 'admin' },
      error: null,
    })
    svcClient.__push('meetings.insertSingle', {
      data: {
        id: 'm1',
        title: 'Planning',
        meeting_date: '2026-05-01',
        meeting_link: null,
        agenda: null,
        notes: null,
      },
      error: null,
    })
    userClient.__push('stokvels.selectMaybeSingle', { data: { name: 'Group A' }, error: null })
    userClient.__push('stokvel_members.selectMany', {
      data: [{ user_id: 'u1' }, { user_id: 'u2' }],
      error: null,
    })

    svcClient.__push('profiles.selectMany', {
      data: [
        { id: 'u1', email: 'a@x.com' },
        { id: 'u2', email: 'b@x.com' },
      ],
      error: null,
    })

    const res = await request(makeApp()).post('/api/stokvels/s1/meetings').send({
      title: 'Planning',
      meetingDate: '2026-05-01',
    })

    expect(res.status).toBe(201)
    expect(mockSendMeetingScheduledEmail).toHaveBeenCalledTimes(2)
  })

  it('PATCH /:id/meetings/:meetingId returns 400 with no patch fields', async () => {
    const client = createSupabaseMock()
    mockCreateClient.mockReturnValue(client)
    client.__push('stokvel_members.selectMaybeSingle', { data: { group_role: 'treasurer' }, error: null })

    const res = await request(makeApp()).patch('/api/stokvels/s1/meetings/m1').send({})

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'No valid fields provided.' })
  })

  it('PATCH /:id/meetings/:meetingId returns 404 when meeting missing', async () => {
    const client = createSupabaseMock()
    mockCreateClient.mockReturnValue(client)
    client.__push('stokvel_members.selectMaybeSingle', { data: { group_role: 'admin' }, error: null })
    client.__push('meetings.updateSelectMaybeSingle', { data: null, error: null })

    const res = await request(makeApp()).patch('/api/stokvels/s1/meetings/m1').send({ title: 'Updated' })

    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: 'Meeting not found.' })
  })

  it('PATCH /:id/meetings/:meetingId/minutes returns 403 for member role', async () => {
    const client = createSupabaseMock()
    mockCreateClient.mockReturnValue(client)
    client.__push('stokvel_members.selectMaybeSingle', { data: { group_role: 'member' }, error: null })

    const res = await request(makeApp())
      .patch('/api/stokvels/s1/meetings/m1/minutes')
      .send({ minutes: 'Notes' })

    expect(res.status).toBe(403)
    expect(res.body).toEqual({ error: 'Only admin or treasurer can record minutes.' })
  })

  it('PATCH /:id/meetings/:meetingId/minutes returns 404 when meeting missing', async () => {
    const client = createSupabaseMock()
    mockCreateClient.mockReturnValue(client)
    client.__push('stokvel_members.selectMaybeSingle', { data: { group_role: 'admin' }, error: null })
    client.__push('meetings.updateSelectMaybeSingle', { data: null, error: null })

    const res = await request(makeApp())
      .patch('/api/stokvels/s1/meetings/m1/minutes')
      .send({ minutes: 'Notes' })

    expect(res.status).toBe(404)
    expect(res.body.error).toMatch(/Meeting not found/i)
  })

  it('PATCH /:id/meetings/:meetingId/minutes saves minutes for treasurer', async () => {
    const client = createSupabaseMock()
    mockCreateClient.mockReturnValue(client)
    client.__push('stokvel_members.selectMaybeSingle', { data: { group_role: 'treasurer' }, error: null })
    client.__push('meetings.updateSelectMaybeSingle', {
      data: { id: 'm1', stokvel_id: 's1', minutes: 'Recorded notes' },
      error: null,
    })

    const res = await request(makeApp())
      .patch('/api/stokvels/s1/meetings/m1/minutes')
      .send({ minutes: 'Recorded notes' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.meeting.minutes).toBe('Recorded notes')
  })

  it('DELETE /:id/meetings/:meetingId deletes meeting when authorized', async () => {
    const client = createSupabaseMock()
    mockCreateClient.mockReturnValue(client)
    client.__push('stokvel_members.selectMaybeSingle', { data: { group_role: 'admin' }, error: null })
    client.__push('meetings.deleteSelectMaybeSingle', { data: { id: 'm1' }, error: null })

    const res = await request(makeApp()).delete('/api/stokvels/s1/meetings/m1')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ success: true, meetingId: 'm1' })
  })

  it('PATCH /:id/treasurer returns 400 when target user is missing', async () => {
    const res = await request(makeApp()).patch('/api/stokvels/s1/treasurer').send({})
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'Target user is required.' })
  })

  it('PATCH /:id/treasurer returns 403 when requester role not allowed', async () => {
    const client = createSupabaseMock()
    mockCreateClient.mockReturnValue(client)
    client.__push('stokvel_members.selectMaybeSingle', { data: { group_role: 'member' }, error: null })

    const res = await request(makeApp()).patch('/api/stokvels/s1/treasurer').send({ userId: 'u2' })

    expect(res.status).toBe(403)
    expect(res.body).toEqual({ error: 'Only an admin or treasurer can change treasurer.' })
  })

  it('PATCH /:id/treasurer updates treasurer successfully', async () => {
    const client = createSupabaseMock()
    mockCreateClient.mockReturnValue(client)
    client.__push('stokvel_members.selectMaybeSingle', { data: { group_role: 'admin' }, error: null })
    client.__push('stokvel_members.selectMaybeSingle', { data: { user_id: 'u2' }, error: null })
    client.__push('stokvel_members.updateEq', { error: null })
    client.__push('stokvel_members.updateEq', { error: null })

    const res = await request(makeApp()).patch('/api/stokvels/s1/treasurer').send({ userId: 'u2' })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ success: true, userId: 'u2' })
  })

  it('PATCH /:id returns 400 when name is empty string', async () => {
    const client = createSupabaseMock()
    mockCreateClient.mockReturnValue(client)
    client.__push('stokvel_members.selectMaybeSingle', { data: { group_role: 'admin' }, error: null })

    const res = await request(makeApp())
      .patch('/api/stokvels/11111111-1111-1111-1111-111111111111')
      .send({ name: '   ' })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/name must be a non-empty string/i)
  })

  it('PATCH /:id returns 400 when contribution_amount is not a positive number', async () => {
    const client = createSupabaseMock()
    mockCreateClient.mockReturnValue(client)
    client.__push('stokvel_members.selectMaybeSingle', { data: { group_role: 'admin' }, error: null })

    const res = await request(makeApp())
      .patch('/api/stokvels/11111111-1111-1111-1111-111111111111')
      .send({ contribution_amount: 'abc' })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/contribution_amount must be a number greater than 0/i)
  })

  it('PATCH /:id returns 500 when DB update fails with timeout', async () => {
    const client = createSupabaseMock()
    mockCreateClient.mockReturnValue(client)
    client.__push('stokvel_members.selectMaybeSingle', { data: { group_role: 'admin' }, error: null })
    client.__push('stokvels.updateSelectMaybeSingle', {
      data: null,
      error: { message: 'DB Timeout' },
    })

    const res = await request(makeApp())
      .patch('/api/stokvels/11111111-1111-1111-1111-111111111111')
      .send({ name: 'Renamed Group' })

    expect(res.status).toBe(500)
    expect(res.body).toEqual({ error: 'DB Timeout' })
  })

  it('PATCH /:id returns 403 when requester is not admin', async () => {
    const sid = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    const client = createSupabaseMock()
    mockCreateClient.mockReturnValue(client)
    client.__push('stokvel_members.selectMaybeSingle', { data: { group_role: 'member' }, error: null })

    const res = await request(makeApp()).patch(`/api/stokvels/${sid}`).send({ name: 'New Name' })

    expect(res.status).toBe(403)
    expect(res.body).toEqual({ error: 'Forbidden' })
  })

  it('PATCH /:id returns 400 when no valid fields provided', async () => {
    const sid = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    const client = createSupabaseMock()
    mockCreateClient.mockReturnValue(client)
    client.__push('stokvel_members.selectMaybeSingle', { data: { group_role: 'admin' }, error: null })

    const res = await request(makeApp()).patch(`/api/stokvels/${sid}`).send({ unknown: true })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/No valid fields/i)
  })

  it('PATCH /:id updates stokvel settings for admin', async () => {
    const sid = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    const client = createSupabaseMock()
    mockCreateClient.mockReturnValue(client)
    client.__push('stokvel_members.selectMaybeSingle', { data: { group_role: 'admin' }, error: null })
    client.__push('stokvels.updateSelectMaybeSingle', {
      data: {
        id: sid,
        name: 'Renamed',
        contribution_amount: 250,
        meeting_frequency: 'monthly',
        is_public: true,
      },
      error: null,
    })

    const res = await request(makeApp()).patch(`/api/stokvels/${sid}`).send({
      name: 'Renamed',
      contribution_amount: 250,
      meeting_frequency: 'monthly',
      is_public: true,
    })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.stokvel.name).toBe('Renamed')
  })

  it('PATCH /:id returns 400 for invalid meeting_frequency', async () => {
    const sid = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    const client = createSupabaseMock()
    mockCreateClient.mockReturnValue(client)
    client.__push('stokvel_members.selectMaybeSingle', { data: { group_role: 'admin' }, error: null })

    const res = await request(makeApp())
      .patch(`/api/stokvels/${sid}`)
      .send({ meeting_frequency: 'daily' })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/meeting_frequency/i)
  })

  it('PATCH /:id returns 400 when is_public is not boolean', async () => {
    const sid = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    const client = createSupabaseMock()
    mockCreateClient.mockReturnValue(client)
    client.__push('stokvel_members.selectMaybeSingle', { data: { group_role: 'admin' }, error: null })

    const res = await request(makeApp())
      .patch(`/api/stokvels/${sid}`)
      .send({ is_public: 'yes' })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/is_public must be a boolean/i)
  })

  it('POST /:id/contributions returns 400 for invalid amount', async () => {
    const res = await request(makeApp()).post('/api/stokvels/s1/contributions').send({ amount: 0 })
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'A valid amount is required' })
  })

  it('POST /:id/contributions returns 403 when user is not member', async () => {
    const client = createSupabaseMock()
    mockCreateClient.mockReturnValue(client)
    client.__push('stokvel_members.selectMaybeSingle', { data: null, error: null })

    const res = await request(makeApp()).post('/api/stokvels/s1/contributions').send({ amount: 100 })

    expect(res.status).toBe(403)
    expect(res.body).toEqual({ error: 'Not a member of this stokvel' })
  })

  it('POST /:id/contributions creates contribution for valid member', async () => {
    const client = createSupabaseMock()
    mockCreateClient.mockReturnValue(client)
    client.__push('stokvel_members.selectMaybeSingle', { data: { group_role: 'member' }, error: null })
    client.__push('contributions.insertSingle', { data: { id: 'c1', amount: 100 }, error: null })

    const res = await request(makeApp()).post('/api/stokvels/s1/contributions').send({ amount: 100 })

    expect(res.status).toBe(201)
    expect(res.body).toEqual({ success: true, contribution: { id: 'c1', amount: 100 } })
  })

  it('POST /:id/payments/verify returns 400 when reference missing', async () => {
    const res = await request(makeApp()).post('/api/stokvels/s1/payments/verify').send({})
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'Payment reference is required.' })
  })

  it('POST /:id/payments/verify returns 502 when Paystack request fails', async () => {
    const client = createSupabaseMock()
    mockGetServiceSupabase.mockReturnValue(client)
    client.__push('contributions.selectMaybeSingle', { data: null, error: null })
    mockAxiosGet.mockRejectedValue({
      response: { data: { message: 'Invalid key' } },
    })

    const sid = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    const res = await request(makeApp())
      .post(`/api/stokvels/${sid}/payments/verify`)
      .send({ reference: 'ref-1' })

    expect(res.status).toBe(502)
    expect(res.body.error).toContain('Paystack verify failed: Invalid key')
  })

  it('POST /:id/payments/verify returns 400 when payment status is not success', async () => {
    const client = createSupabaseMock()
    mockGetServiceSupabase.mockReturnValue(client)
    client.__push('contributions.selectMaybeSingle', { data: null, error: null })
    mockAxiosGet.mockResolvedValue({ data: { data: { status: 'failed', amount: 10000 } } })

    const sid = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    const res = await request(makeApp())
      .post(`/api/stokvels/${sid}/payments/verify`)
      .send({ reference: 'ref-1' })

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'Payment not successful' })
  })

  it('POST /:id/payments/verify inserts verified contribution on success', async () => {
    const client = createSupabaseMock()
    mockCreateClient.mockReturnValue(client)
    mockGetServiceSupabase.mockReturnValue(client)
    mockAxiosGet.mockResolvedValue({
      data: {
        data: {
          status: 'success',
          amount: 12345,
          paid_at: '2026-03-03T10:00:00.000Z',
        },
      },
    })
    client.__push('contributions.selectMaybeSingle', { data: null, error: null })
    client.__push('stokvels.selectMaybeSingle', {
      data: { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', type: 'Fixed', status: 'active' },
      error: null,
    })
    client.__push('stokvel_members.selectMaybeSingle', {
      data: { user_id: '11111111-1111-4111-8111-111111111111' },
      error: null,
    })
    client.__push('contributions.insertSingle', {
      data: {
        id: 'c1',
        stokvel_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        user_id: '11111111-1111-4111-8111-111111111111',
        amount: 123.45,
        target_month: '2026-03',
        paystack_reference: 'ref-1',
      },
      error: null,
    })
    client.__push('missed_payments.updateEq', { error: null })

    const sid = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    const res = await request(makeApp())
      .post(`/api/stokvels/${sid}/payments/verify`)
      .send({ reference: 'ref-1' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.contribution.amount).toBe(123.45)
  })

  it('GET /members/search delegates to profile search handler', async () => {
    const res = await request(makeApp()).get('/api/stokvels/members/search?q=a')
    expect(res.status).toBe(200)
    expect(mockSearchProfilesForMemberInvite).toHaveBeenCalled()
    expect(res.body).toEqual({ success: true, users: [] })
  })

  const sidTreasurer = '11111111-1111-1111-1111-111111111111'
  const contribUuid = '33333333-3333-4333-8333-333333333333'

  it('PATCH /:id/contributions/:contributionId/treasurer-approval returns 403 for member', async () => {
    const client = createSupabaseMock()
    mockCreateClient.mockReturnValue(client)
    mockGetServiceSupabase.mockReturnValue(client)
    client.__push('stokvel_members.selectMaybeSingle', {
      data: { group_role: 'member' },
      error: null,
    })

    const res = await request(makeApp())
      .patch(`/api/stokvels/${sidTreasurer}/contributions/${contribUuid}/treasurer-approval`)
      .send({ status: 'approved' })

    expect(res.status).toBe(403)
    expect(res.body.error).toMatch(/treasurer/i)
  })

  it('PATCH /:id/contributions/:contributionId/treasurer-approval returns 400 for invalid status', async () => {
    const client = createSupabaseMock()
    mockCreateClient.mockReturnValue(client)
    mockGetServiceSupabase.mockReturnValue(client)
    client.__push('stokvel_members.selectMaybeSingle', {
      data: { group_role: 'treasurer' },
      error: null,
    })

    const res = await request(makeApp())
      .patch(`/api/stokvels/${sidTreasurer}/contributions/${contribUuid}/treasurer-approval`)
      .send({ status: 'maybe' })

    expect(res.status).toBe(400)
  })

  it('PATCH /:id/contributions/:contributionId/treasurer-approval returns 404 when contribution missing', async () => {
    const client = createSupabaseMock()
    mockCreateClient.mockReturnValue(client)
    mockGetServiceSupabase.mockReturnValue(client)
    client.__push('stokvel_members.selectMaybeSingle', {
      data: { group_role: 'treasurer' },
      error: null,
    })
    client.__push('contributions.selectMaybeSingle', { data: null, error: null })

    const res = await request(makeApp())
      .patch(`/api/stokvels/${sidTreasurer}/contributions/${contribUuid}/treasurer-approval`)
      .send({ status: 'approved' })

    expect(res.status).toBe(404)
  })

  it('PATCH /:id/contributions/:contributionId/treasurer-approval updates when treasurer', async () => {
    const client = createSupabaseMock()
    mockCreateClient.mockReturnValue(client)
    mockGetServiceSupabase.mockReturnValue(client)
    client.__push('stokvel_members.selectMaybeSingle', {
      data: { group_role: 'treasurer' },
      error: null,
    })
    client.__push('contributions.selectMaybeSingle', {
      data: {
        id: contribUuid,
        stokvel_id: sidTreasurer,
        user_id: '44444444-4444-4444-8444-444444444444',
        target_month: '2026-04',
        paid_at: '2026-04-01T10:00:00.000Z',
      },
      error: null,
    })
    client.__push('contributions.updateSelectMaybeSingle', {
      data: {
        id: contribUuid,
        amount: 500,
        paid_at: '2026-04-01T10:00:00.000Z',
        user_id: '44444444-4444-4444-8444-444444444444',
        target_month: '2026-04',
        paystack_reference: 'ref-x',
        treasurer_approval_status: 'approved',
        treasurer_approved_at: '2026-04-02T10:00:00.000Z',
        treasurer_approved_by: '11111111-1111-4111-8111-111111111111',
      },
      error: null,
    })
    client.__push('profiles.selectMaybeSingle', {
      data: { id: '44444444-4444-4444-8444-444444444444', first_name: 'A', last_name: 'B' },
      error: null,
    })

    const res = await request(makeApp())
      .patch(`/api/stokvels/${sidTreasurer}/contributions/${contribUuid}/treasurer-approval`)
      .send({ status: 'approved' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.contribution.treasurer_approval_status).toBe('approved')
    expect(res.body.contribution.profiles.last_name).toBe('B')
  })

  it('PATCH /:id/contributions/:contributionId/treasurer-approval sets pending and clears audit fields', async () => {
    const client = createSupabaseMock()
    mockCreateClient.mockReturnValue(client)
    mockGetServiceSupabase.mockReturnValue(client)
    client.__push('stokvel_members.selectMaybeSingle', {
      data: { group_role: 'treasurer' },
      error: null,
    })
    client.__push('contributions.selectMaybeSingle', {
      data: {
        id: contribUuid,
        stokvel_id: sidTreasurer,
        user_id: '44444444-4444-4444-8444-444444444444',
        target_month: '2026-04',
        paid_at: '2026-04-01T10:00:00.000Z',
      },
      error: null,
    })
    client.__push('contributions.updateSelectMaybeSingle', {
      data: {
        id: contribUuid,
        amount: 500,
        paid_at: '2026-04-01T10:00:00.000Z',
        user_id: '44444444-4444-4444-8444-444444444444',
        target_month: '2026-04',
        paystack_reference: 'ref-x',
        treasurer_approval_status: 'pending',
        treasurer_approved_at: null,
        treasurer_approved_by: null,
      },
      error: null,
    })
    client.__push('profiles.selectMaybeSingle', {
      data: { id: '44444444-4444-4444-8444-444444444444', first_name: 'A', last_name: 'B' },
      error: null,
    })

    const res = await request(makeApp())
      .patch(`/api/stokvels/${sidTreasurer}/contributions/${contribUuid}/treasurer-approval`)
      .send({ status: 'pending' })

    expect(res.status).toBe(200)
    expect(res.body.contribution.treasurer_approval_status).toBe('pending')
    expect(res.body.contribution.treasurer_approved_at).toBeNull()
  })

  it('GET /:id/payout-report allows any member and returns history and projections', async () => {
    const client = createSupabaseMock()
    mockCreateClient.mockReturnValue(client)
    mockGetServiceSupabase.mockReturnValue(client)
    client.__push('stokvel_members.selectMaybeSingle', { data: { group_role: 'member' }, error: null })
    client.__push('stokvels.selectSingle', {
      data: {
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        name: 'Test Group',
        contribution_amount: 200,
        status: 'active',
      },
      error: null,
    })
    client.__push('stokvel_members.selectMany', {
      data: [
        {
          user_id: '11111111-1111-4111-8111-111111111111',
          group_role: 'member',
          profiles: { first_name: 'Me', last_name: 'Member' },
        },
        { user_id: 'u2', group_role: 'member', profiles: { first_name: 'Other', last_name: 'User' } },
      ],
      error: null,
    })
    client.__push('payouts.selectMany', {
      data: [
        {
          id: 'p-past',
          user_id: '11111111-1111-4111-8111-111111111111',
          target_month: '2026-03',
          scheduled_payout_date: '2026-04-01',
          cycle_index: 0,
          status: 'completed',
          disbursed_at: '2026-04-02T10:00:00Z',
        },
        {
          id: 'p-future',
          user_id: '11111111-1111-4111-8111-111111111111',
          target_month: '2026-07',
          scheduled_payout_date: '2099-07-01',
          cycle_index: 1,
          status: 'pending',
        },
      ],
      error: null,
    })
    client.__push('profiles.selectMany', {
      data: [
        { id: '11111111-1111-4111-8111-111111111111', first_name: 'Me', last_name: 'Member' },
        { id: 'u2', first_name: 'Other', last_name: 'User' },
      ],
      error: null,
    })

    const sid = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    const res = await request(makeApp()).get(`/api/stokvels/${sid}/payout-report`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.report.summary.expected_payout_amount).toBe(400)
    expect(res.body.report.history).toHaveLength(1)
    expect(res.body.report.upcoming_projections).toHaveLength(1)
    expect(res.body.report.my_summary.next_expected?.expected_amount).toBe(400)
  })

  it('GET /:id/payouts allows treasurer and returns profile-enriched payout list', async () => {
    const client = createSupabaseMock()
    mockCreateClient.mockReturnValue(client)
    mockGetServiceSupabase.mockReturnValue(client)
    client.__push('stokvel_members.selectMaybeSingle', { data: { group_role: 'treasurer' }, error: null })
    client.__push('payouts.selectMany', {
      data: [
        {
          id: 'p1',
          stokvel_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          user_id: 'u2',
          target_month: '2026-04',
          scheduled_payout_date: '2026-04-15',
          cycle_index: 0,
          status: 'pending',
          disbursed_at: null,
        },
      ],
      error: null,
    })
    client.__push('profiles.selectMany', {
      data: [{ id: 'u2', first_name: 'Jane', last_name: 'Doe', email: 'jane@x.com' }],
      error: null,
    })

    const sid = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    const res = await request(makeApp()).get(`/api/stokvels/${sid}/payouts`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.payouts[0].profile.first_name).toBe('Jane')
    expect(res.body.payouts[0].status).toBe('pending')
  })

  it('POST /:id/payouts/:payoutId/disburse returns 400 for invalid payout id', async () => {
    const sid = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    const client = createSupabaseMock()
    mockCreateClient.mockReturnValue(client)
    client.__push('stokvel_members.selectMaybeSingle', { data: { group_role: 'treasurer' }, error: null })

    const res = await request(makeApp()).post(`/api/stokvels/${sid}/payouts/not-a-uuid/disburse`)
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/Invalid payout id/i)
  })

  it('POST /:id/payouts/:payoutId/disburse returns 403 for non-treasurer', async () => {
    const sid = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    const pid = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    const client = createSupabaseMock()
    mockCreateClient.mockReturnValue(client)
    client.__push('stokvel_members.selectMaybeSingle', { data: { group_role: 'admin' }, error: null })

    const res = await request(makeApp()).post(`/api/stokvels/${sid}/payouts/${pid}/disburse`)
    expect(res.status).toBe(403)
    expect(res.body.error).toMatch(/Only treasurers/i)
  })

  it('POST /:id/payouts/:payoutId/disburse returns 503 without service client', async () => {
    const sid = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    const pid = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    const client = createSupabaseMock()
    mockCreateClient.mockReturnValue(client)
    client.__push('stokvel_members.selectMaybeSingle', { data: { group_role: 'treasurer' }, error: null })
    mockGetServiceSupabase.mockReturnValue(null)

    const res = await request(makeApp()).post(`/api/stokvels/${sid}/payouts/${pid}/disburse`)
    expect(res.status).toBe(503)
  })

  it('POST /:id/payouts/:payoutId/disburse returns 409 when payout already completed', async () => {
    const sid = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    const pid = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    const userClient = createSupabaseMock()
    mockCreateClient.mockReturnValue(userClient)
    userClient.__push('stokvel_members.selectMaybeSingle', { data: { group_role: 'treasurer' }, error: null })

    const svc = createSupabaseMock()
    mockGetServiceSupabase.mockReturnValue(svc)
    svc.__push('payouts.selectMaybeSingle', {
      data: {
        id: pid,
        stokvel_id: sid,
        status: 'completed',
        disbursed_at: '2026-01-01T00:00:00.000Z',
        scheduled_payout_date: '2026-01-01',
      },
      error: null,
    })

    const res = await request(makeApp()).post(`/api/stokvels/${sid}/payouts/${pid}/disburse`)
    expect(res.status).toBe(409)
  })

  it('POST /:id/payouts/:payoutId/disburse returns 404 when payout is missing', async () => {
    const sid = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    const pid = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    const userClient = createSupabaseMock()
    mockCreateClient.mockReturnValue(userClient)
    userClient.__push('stokvel_members.selectMaybeSingle', { data: { group_role: 'treasurer' }, error: null })

    const svc = createSupabaseMock()
    mockGetServiceSupabase.mockReturnValue(svc)
    svc.__push('payouts.selectMaybeSingle', { data: null, error: null })

    const res = await request(makeApp()).post(`/api/stokvels/${sid}/payouts/${pid}/disburse`)
    expect(res.status).toBe(404)
    expect(res.body.error).toMatch(/Payout not found/i)
  })

  it('POST /:id/payouts/:payoutId/disburse returns 400 when payout date is missing', async () => {
    const sid = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    const pid = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    const userClient = createSupabaseMock()
    mockCreateClient.mockReturnValue(userClient)
    userClient.__push('stokvel_members.selectMaybeSingle', { data: { group_role: 'treasurer' }, error: null })

    const svc = createSupabaseMock()
    mockGetServiceSupabase.mockReturnValue(svc)
    svc.__push('payouts.selectMaybeSingle', {
      data: {
        id: pid,
        stokvel_id: sid,
        status: 'pending',
        disbursed_at: null,
        scheduled_payout_date: null,
      },
      error: null,
    })

    const res = await request(makeApp()).post(`/api/stokvels/${sid}/payouts/${pid}/disburse`)
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/Payout date is missing/i)
  })

  it('POST /:id/payouts/:payoutId/disburse returns 400 when payout date not reached', async () => {
    const sid = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    const pid = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    const userClient = createSupabaseMock()
    mockCreateClient.mockReturnValue(userClient)
    userClient.__push('stokvel_members.selectMaybeSingle', { data: { group_role: 'treasurer' }, error: null })

    const svc = createSupabaseMock()
    mockGetServiceSupabase.mockReturnValue(svc)
    svc.__push('payouts.selectMaybeSingle', {
      data: {
        id: pid,
        stokvel_id: sid,
        status: 'pending',
        disbursed_at: null,
        scheduled_payout_date: '2099-12-01',
      },
      error: null,
    })

    const res = await request(makeApp()).post(`/api/stokvels/${sid}/payouts/${pid}/disburse`)
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/not been reached/i)
  })

  it('POST /:id/payouts/:payoutId/disburse returns 500 when update fails', async () => {
    const sid = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    const pid = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    const userClient = createSupabaseMock()
    mockCreateClient.mockReturnValue(userClient)
    userClient.__push('stokvel_members.selectMaybeSingle', { data: { group_role: 'treasurer' }, error: null })

    const svc = createSupabaseMock()
    mockGetServiceSupabase.mockReturnValue(svc)
    svc.__push('payouts.selectMaybeSingle', {
      data: {
        id: pid,
        stokvel_id: sid,
        status: 'pending',
        disbursed_at: null,
        scheduled_payout_date: '2020-01-01',
      },
      error: null,
    })
    svc.__push('payouts.updateSelectMaybeSingle', {
      data: null,
      error: { message: 'disburse update failed' },
    })

    const res = await request(makeApp()).post(`/api/stokvels/${sid}/payouts/${pid}/disburse`)
    expect(res.status).toBe(500)
    expect(res.body.error).toBe('disburse update failed')
  })

  it('POST /:id/payouts/:payoutId/disburse marks due pending payout as completed for treasurer', async () => {
    const client = createSupabaseMock()
    mockCreateClient.mockReturnValue(client)
    mockGetServiceSupabase.mockReturnValue(client)
    client.__push('stokvel_members.selectMaybeSingle', { data: { group_role: 'treasurer' }, error: null })
    client.__push('payouts.selectMaybeSingle', {
      data: {
        id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        stokvel_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        user_id: 'u2',
        target_month: '2026-04',
        scheduled_payout_date: '2026-01-01',
        status: 'pending',
        disbursed_at: null,
      },
      error: null,
    })
    client.__push('payouts.updateSelectMaybeSingle', {
      data: {
        id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        stokvel_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        user_id: 'u2',
        target_month: '2026-04',
        scheduled_payout_date: '2026-01-01',
        status: 'completed',
        disbursed_at: '2026-04-26T09:00:00.000Z',
      },
      error: null,
    })

    const sid = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    const pid = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    const res = await request(makeApp()).post(`/api/stokvels/${sid}/payouts/${pid}/disburse`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.payout.status).toBe('completed')
  })

  it('PATCH /:id/payout-order returns 404 for invalid stokvel id', async () => {
    const res = await request(makeApp())
      .patch('/api/stokvels/not-a-uuid/payout-order')
      .send({ orderedUpcomingPayoutIds: ['p1'] })
    expect(res.status).toBe(404)
  })

  it('PATCH /:id/payout-order returns 400 when orderedUpcomingPayoutIds is missing', async () => {
    const sid = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    const client = createSupabaseMock()
    mockCreateClient.mockReturnValue(client)
    client.__push('stokvel_members.selectMaybeSingle', { data: { group_role: 'treasurer' }, error: null })

    const res = await request(makeApp())
      .patch(`/api/stokvels/${sid}/payout-order`)
      .send({})

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/orderedUpcomingPayoutIds/i)
  })

  it('PATCH /:id/payout-order returns 403 for members', async () => {
    const sid = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    const client = createSupabaseMock()
    mockCreateClient.mockReturnValue(client)
    client.__push('stokvel_members.selectMaybeSingle', { data: { group_role: 'member' }, error: null })

    const res = await request(makeApp())
      .patch(`/api/stokvels/${sid}/payout-order`)
      .send({ orderedUpcomingPayoutIds: ['a', 'b'] })

    expect(res.status).toBe(403)
  })

  it('PATCH /:id/payout-order returns 503 without service role client', async () => {
    const sid = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    const client = createSupabaseMock()
    mockCreateClient.mockReturnValue(client)
    client.__push('stokvel_members.selectMaybeSingle', { data: { group_role: 'admin' }, error: null })
    mockGetServiceSupabase.mockReturnValue(null)

    const res = await request(makeApp())
      .patch(`/api/stokvels/${sid}/payout-order`)
      .send({ orderedUpcomingPayoutIds: ['p1', 'p2'] })

    expect(res.status).toBe(503)
  })

  it('PATCH /:id/payout-order reorders upcoming payouts successfully', async () => {
    const sid = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    const p1 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    const p2 = 'cccccccc-cccc-cccc-cccc-cccccccccccc'

    const userClient = createSupabaseMock()
    mockCreateClient.mockReturnValue(userClient)
    userClient.__push('stokvel_members.selectMaybeSingle', { data: { group_role: 'treasurer' }, error: null })

    const svc = createSupabaseMock()
    mockGetServiceSupabase.mockReturnValue(svc)

    const initialPayouts = [
      {
        id: p1,
        stokvel_id: sid,
        user_id: 'user-a',
        target_month: '2099-06',
        scheduled_payout_date: '2099-06-15',
        cycle_index: 0,
      },
      {
        id: p2,
        stokvel_id: sid,
        user_id: 'user-b',
        target_month: '2099-07',
        scheduled_payout_date: '2099-07-15',
        cycle_index: 1,
      },
    ]

    svc.__push('payouts.selectMany', { data: initialPayouts, error: null })
    svc.__push('payouts.updateEq', { error: null })
    svc.__push('payouts.updateEq', { error: null })
    svc.__push('payouts.selectMany', {
      data: [
        { ...initialPayouts[1], user_id: 'user-a' },
        { ...initialPayouts[0], user_id: 'user-b' },
      ],
      error: null,
    })

    const res = await request(makeApp())
      .patch(`/api/stokvels/${sid}/payout-order`)
      .send({ orderedUpcomingPayoutIds: [p2, p1] })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.payouts)).toBe(true)
  })

  it('PATCH /:id/payout-order returns 400 when ordered id is not an upcoming payout', async () => {
    const sid = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    const p1 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    const p2 = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
    const foreign = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
    const userClient = createSupabaseMock()
    mockCreateClient.mockReturnValue(userClient)
    userClient.__push('stokvel_members.selectMaybeSingle', { data: { group_role: 'treasurer' }, error: null })

    const svc = createSupabaseMock()
    mockGetServiceSupabase.mockReturnValue(svc)
    svc.__push('payouts.selectMany', {
      data: [
        { id: p1, stokvel_id: sid, user_id: 'u1', scheduled_payout_date: '2099-06-15', cycle_index: 0 },
        { id: p2, stokvel_id: sid, user_id: 'u2', scheduled_payout_date: '2099-07-15', cycle_index: 1 },
      ],
      error: null,
    })

    const res = await request(makeApp())
      .patch(`/api/stokvels/${sid}/payout-order`)
      .send({ orderedUpcomingPayoutIds: [foreign, p2] })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/not upcoming/i)
  })

  it('PATCH /:id returns 404 when update returns no row', async () => {
    const sid = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    const client = createSupabaseMock()
    mockCreateClient.mockReturnValue(client)
    client.__push('stokvel_members.selectMaybeSingle', { data: { group_role: 'admin' }, error: null })
    client.__push('stokvels.updateSelectMaybeSingle', { data: null, error: null })

    const res = await request(makeApp()).patch(`/api/stokvels/${sid}`).send({ name: 'Missing row' })
    expect(res.status).toBe(404)
  })

  it('PATCH /:id/payout-order returns 400 when only one upcoming payout exists', async () => {
    const sid = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    const p1 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    const userClient = createSupabaseMock()
    mockCreateClient.mockReturnValue(userClient)
    userClient.__push('stokvel_members.selectMaybeSingle', { data: { group_role: 'admin' }, error: null })

    const svc = createSupabaseMock()
    mockGetServiceSupabase.mockReturnValue(svc)
    svc.__push('payouts.selectMany', {
      data: [
        {
          id: p1,
          stokvel_id: sid,
          user_id: 'u1',
          scheduled_payout_date: '2099-06-15',
          cycle_index: 0,
        },
      ],
      error: null,
    })

    const res = await request(makeApp())
      .patch(`/api/stokvels/${sid}/payout-order`)
      .send({ orderedUpcomingPayoutIds: [p1] })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/not enough upcoming payouts/i)
  })

  it('PATCH /:id/payout-order returns 500 when payout list query fails', async () => {
    const sid = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    const userClient = createSupabaseMock()
    mockCreateClient.mockReturnValue(userClient)
    userClient.__push('stokvel_members.selectMaybeSingle', { data: { group_role: 'admin' }, error: null })

    const svc = createSupabaseMock()
    mockGetServiceSupabase.mockReturnValue(svc)
    svc.__push('payouts.selectMany', { data: null, error: { message: 'list failed' } })

    const res = await request(makeApp())
      .patch(`/api/stokvels/${sid}/payout-order`)
      .send({ orderedUpcomingPayoutIds: ['p1', 'p2'] })

    expect(res.status).toBe(500)
    expect(res.body.error).toBe('list failed')
  })

  it('PATCH /:id/payout-order returns 400 when ordered ids count mismatches upcoming', async () => {
    const sid = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    const p1 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    const p2 = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
    const userClient = createSupabaseMock()
    mockCreateClient.mockReturnValue(userClient)
    userClient.__push('stokvel_members.selectMaybeSingle', { data: { group_role: 'admin' }, error: null })

    const svc = createSupabaseMock()
    mockGetServiceSupabase.mockReturnValue(svc)
    svc.__push('payouts.selectMany', {
      data: [
        { id: p1, stokvel_id: sid, user_id: 'u1', scheduled_payout_date: '2099-06-15', cycle_index: 0 },
        { id: p2, stokvel_id: sid, user_id: 'u2', scheduled_payout_date: '2099-07-15', cycle_index: 1 },
      ],
      error: null,
    })

    const res = await request(makeApp())
      .patch(`/api/stokvels/${sid}/payout-order`)
      .send({ orderedUpcomingPayoutIds: [p1] })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/each upcoming payout exactly once/i)
  })

  it('PATCH /:id/payout-order returns 400 when ordered ids contain duplicates', async () => {
    const sid = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    const p1 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    const p2 = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
    const userClient = createSupabaseMock()
    mockCreateClient.mockReturnValue(userClient)
    userClient.__push('stokvel_members.selectMaybeSingle', { data: { group_role: 'treasurer' }, error: null })

    const svc = createSupabaseMock()
    mockGetServiceSupabase.mockReturnValue(svc)
    svc.__push('payouts.selectMany', {
      data: [
        { id: p1, stokvel_id: sid, user_id: 'u1', scheduled_payout_date: '2099-06-15', cycle_index: 0 },
        { id: p2, stokvel_id: sid, user_id: 'u2', scheduled_payout_date: '2099-07-15', cycle_index: 1 },
      ],
      error: null,
    })

    const res = await request(makeApp())
      .patch(`/api/stokvels/${sid}/payout-order`)
      .send({ orderedUpcomingPayoutIds: [p1, p1] })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/duplicates/i)
  })

  it('PATCH /:id/meetings/:meetingId updates meeting when authorized', async () => {
    const client = createSupabaseMock()
    mockCreateClient.mockReturnValue(client)
    client.__push('stokvel_members.selectMaybeSingle', { data: { group_role: 'treasurer' }, error: null })
    client.__push('meetings.updateSelectMaybeSingle', {
      data: {
        id: 'm1',
        stokvel_id: 's1',
        title: 'Updated title',
        meeting_date: '2026-08-01T10:00:00.000Z',
      },
      error: null,
    })

    const res = await request(makeApp())
      .patch('/api/stokvels/s1/meetings/m1')
      .send({ title: 'Updated title', meetingDate: '2026-08-01T10:00:00.000Z' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.meeting.title).toBe('Updated title')
  })

  describe('failure branches and auth', () => {
    const sid = '11111111-1111-4111-8111-111111111111'
    const memberId = '22222222-2222-4222-8222-222222222222'

    it('returns 401 when authorization header is missing', async () => {
      const res = await request(makeApp())
        .get('/api/stokvels/')
        .set('x-test-unauth', '1')

      expect(res.status).toBe(401)
      expect(res.body).toEqual({ error: 'Missing or malformed authorization header' })
    })

    it('GET /:id returns 500 when stokvel row query fails', async () => {
      const client = createSupabaseMock()
      mockCreateClient.mockReturnValue(client)
      client.__push('stokvel_members.selectMaybeSingle', { data: { group_role: 'member' }, error: null })
      client.__push('stokvels.selectSingle', { data: null, error: { message: 'stokvel read failed' } })

      const res = await request(makeApp()).get(`/api/stokvels/${sid}`)

      expect(res.status).toBe(500)
      expect(res.body.error).toBe('stokvel read failed')
    })

    it('GET /:id/meetings returns 500 when meetings query fails', async () => {
      const client = createSupabaseMock()
      mockCreateClient.mockReturnValue(client)
      client.__push('stokvel_members.selectMaybeSingle', { data: { group_role: 'member' }, error: null })
      client.__push('meetings.selectMany', { data: null, error: { message: 'meetings query failed' } })

      const res = await request(makeApp()).get(`/api/stokvels/${sid}/meetings`)

      expect(res.status).toBe(500)
      expect(res.body.error).toBe('meetings query failed')
    })

    it('POST /:id/missed-payments returns 503 without service role client', async () => {
      const client = createSupabaseMock()
      mockCreateClient.mockReturnValue(client)
      mockGetServiceSupabase.mockReturnValue(null)
      client.__push('stokvel_members.selectMaybeSingle', { data: { group_role: 'admin' }, error: null })
      client.__push('stokvel_members.selectMaybeSingle', {
        data: { user_id: memberId },
        error: null,
      })

      const res = await request(makeApp())
        .post(`/api/stokvels/${sid}/missed-payments`)
        .send({ user_id: memberId, target_month: '2026-03' })

      expect(res.status).toBe(503)
      expect(res.body.error).toMatch(/service role/i)
    })

    it('POST /:id/missed-payments returns 500 when insert fails', async () => {
      const client = createSupabaseMock()
      mockCreateClient.mockReturnValue(client)
      mockGetServiceSupabase.mockReturnValue(client)
      client.__push('stokvel_members.selectMaybeSingle', { data: { group_role: 'treasurer' }, error: null })
      client.__push('stokvel_members.selectMaybeSingle', { data: { user_id: memberId }, error: null })
      client.__push('missed_payments.insertDirect', {
        data: null,
        error: { message: 'insert failed', code: 'XX000' },
      })

      const res = await request(makeApp())
        .post(`/api/stokvels/${sid}/missed-payments`)
        .send({ user_id: memberId, target_month: '2026-03' })

      expect(res.status).toBe(500)
      expect(res.body.error).toBe('insert failed')
    })

    it('POST /:id/missed-payments returns 500 when target member lookup fails', async () => {
      const client = createSupabaseMock()
      mockCreateClient.mockReturnValue(client)
      mockGetServiceSupabase.mockReturnValue(client)
      client.__push('stokvel_members.selectMaybeSingle', { data: { group_role: 'admin' }, error: null })
      client.__push('stokvel_members.selectMaybeSingle', {
        data: null,
        error: { message: 'member lookup failed' },
      })

      const res = await request(makeApp())
        .post(`/api/stokvels/${sid}/missed-payments`)
        .send({ user_id: memberId, target_month: '2026-03' })

      expect(res.status).toBe(500)
      expect(res.body.error).toBe('member lookup failed')
    })

    it('POST /:id/contributions returns 500 when membership lookup fails', async () => {
      const client = createSupabaseMock()
      mockCreateClient.mockReturnValue(client)
      client.__push('stokvel_members.selectMaybeSingle', {
        data: null,
        error: { message: 'membership lookup failed' },
      })

      const res = await request(makeApp())
        .post(`/api/stokvels/${sid}/contributions`)
        .send({ amount: 100 })

      expect(res.status).toBe(500)
      expect(res.body.error).toBe('membership lookup failed')
    })

    it('POST /:id/contributions returns 500 when insert fails', async () => {
      const client = createSupabaseMock()
      mockCreateClient.mockReturnValue(client)
      client.__push('stokvel_members.selectMaybeSingle', { data: { group_role: 'member' }, error: null })
      client.__push('contributions.insertSingle', {
        data: null,
        error: { message: 'contribution insert failed' },
      })

      const res = await request(makeApp())
        .post(`/api/stokvels/${sid}/contributions`)
        .send({ amount: 250 })

      expect(res.status).toBe(500)
      expect(res.body.error).toBe('contribution insert failed')
    })

    it('POST /:id/missed-payments returns 400 for invalid user_id', async () => {
      const res = await request(makeApp())
        .post(`/api/stokvels/${sid}/missed-payments`)
        .send({ user_id: 'not-a-uuid', target_month: '2026-03' })

      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/Invalid user_id/i)
    })
  })
})
