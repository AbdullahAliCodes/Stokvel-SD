import request from 'supertest'
import express from 'express'
import { jest, describe, it, expect, beforeEach } from '@jest/globals'

const mockCreateClient = jest.fn()
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
  requireAuth: (req, _res, next) => {
    req.user = {
      id: '11111111-1111-4111-8111-111111111111',
      role: 'user',
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
  mockSearchProfilesForMemberInvite.mockImplementation((_req, res) =>
    res.json({ success: true, users: [] }),
  )
  mockNormalizeInviteEmail.mockImplementation((v) =>
    typeof v === 'string' && v.includes('@') ? v.trim().toLowerCase() : '',
  )
})

describe('stokvels routes', () => {
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
})
