import request from 'supertest'
import express from 'express'
import { jest, describe, it, expect, beforeEach } from '@jest/globals'

const USER_ID = '11111111-1111-4111-8111-111111111111'
const GROUP_ID = '22222222-2222-4222-8222-222222222222'

const mockGetServiceSupabase = jest.fn()
const mockCalculateHealthScore = jest.fn()

jest.unstable_mockModule('../middleware/auth.js', () => ({
  requireAuth: (req, _res, next) => {
    req.user = { id: USER_ID, email: 'member@test.com' }
    req.headers = { authorization: 'Bearer token' }
    next()
  },
}))

jest.unstable_mockModule('../utils/supabaseAdmin.js', () => ({
  getServiceSupabase: mockGetServiceSupabase,
}))

jest.unstable_mockModule('../services/healthScoreService.js', () => ({
  calculateHealthScore: mockCalculateHealthScore,
}))

const { default: healthScoreRouter } = await import('./healthScore.js')

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/members', healthScoreRouter)
  return app
}

function membershipClient(found = true) {
  const tableChain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({
      data: found ? { user_id: USER_ID } : null,
      error: null,
    }),
    upsert: jest.fn().mockResolvedValue({ error: null }),
  }
  return {
    from: jest.fn(() => tableChain),
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  mockCalculateHealthScore.mockResolvedValue({
    row: {
      user_id: USER_ID,
      group_id: GROUP_ID,
      score: 82,
      grade: 'Good',
      confidence: 60,
      on_time_rate: 90,
      missed_payments: 0,
      avg_days_late: 0,
      streak_months: 2,
      engagement_score: 80,
      model_version: 'fallback',
      last_calculated_at: '2026-05-01T00:00:00.000Z',
    },
    meta: {
      insufficientData: false,
      lowConfidence: false,
      summaryLine: 'On track',
      onTimeMonths: 2,
      totalTrackedMonths: 2,
      feature_importances: null,
      note: null,
    },
  })
})

describe('healthScore routes', () => {
  it('GET returns 400 for invalid user id', async () => {
    const res = await request(makeApp()).get('/api/members/not-a-uuid/health-score')
    expect(res.status).toBe(400)
  })

  it('GET returns 403 when token user does not match param', async () => {
    const res = await request(makeApp()).get(
      `/api/members/99999999-9999-4999-8999-999999999999/health-score?groupId=${GROUP_ID}`,
    )
    expect(res.status).toBe(403)
  })

  it('GET returns 400 when groupId is missing', async () => {
    const res = await request(makeApp()).get(`/api/members/${USER_ID}/health-score`)
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/groupId/i)
  })

  it('GET returns 503 when service client is unavailable', async () => {
    mockGetServiceSupabase.mockReturnValue(null)
    const res = await request(makeApp()).get(
      `/api/members/${USER_ID}/health-score?groupId=${GROUP_ID}`,
    )
    expect(res.status).toBe(503)
  })

  it('GET returns 404 when user is not a group member', async () => {
    const svc = membershipClient(false)
    mockGetServiceSupabase.mockReturnValue(svc)
    const res = await request(makeApp()).get(
      `/api/members/${USER_ID}/health-score?groupId=${GROUP_ID}`,
    )
    expect(res.status).toBe(404)
  })

  it('GET returns computed score and upserts row', async () => {
    const svc = membershipClient(true)
    mockGetServiceSupabase.mockReturnValue(svc)
    const res = await request(makeApp()).get(
      `/api/members/${USER_ID}/health-score?groupId=${GROUP_ID}`,
    )
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.score).toBe(82)
    expect(mockCalculateHealthScore).toHaveBeenCalledWith(USER_ID, GROUP_ID, svc)
    expect(svc.from).toHaveBeenCalledWith('stokvel_members')
    expect(svc.from).toHaveBeenCalledWith('member_health_scores')
  })

  it('POST refresh uses the same handler', async () => {
    const svc = membershipClient(true)
    mockGetServiceSupabase.mockReturnValue(svc)
    const res = await request(makeApp()).post(
      `/api/members/${USER_ID}/health-score/refresh?groupId=${GROUP_ID}`,
    )
    expect(res.status).toBe(200)
    expect(res.body.grade).toBe('Good')
  })

  it('GET returns 400 for invalid groupId', async () => {
    const res = await request(makeApp()).get(
      `/api/members/${USER_ID}/health-score?groupId=not-a-uuid`,
    )
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/Invalid groupId/i)
  })

  it('GET returns 500 when membership lookup fails', async () => {
    const svc = {
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'membership db error' },
        }),
      })),
    }
    mockGetServiceSupabase.mockReturnValue(svc)
    const res = await request(makeApp()).get(
      `/api/members/${USER_ID}/health-score?groupId=${GROUP_ID}`,
    )
    expect(res.status).toBe(500)
    expect(res.body.error).toBe('membership db error')
  })

  it('GET returns 500 when score calculation throws', async () => {
    const svc = membershipClient(true)
    mockGetServiceSupabase.mockReturnValue(svc)
    mockCalculateHealthScore.mockRejectedValue(new Error('calc failed'))
    const res = await request(makeApp()).get(
      `/api/members/${USER_ID}/health-score?groupId=${GROUP_ID}`,
    )
    expect(res.status).toBe(500)
    expect(res.body.error).toBe('calc failed')
  })

  it('GET returns 500 when health score upsert fails', async () => {
    const tableChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: { user_id: USER_ID }, error: null }),
      upsert: jest.fn().mockResolvedValue({ error: { message: 'upsert failed' } }),
    }
    const svc = { from: jest.fn(() => tableChain) }
    mockGetServiceSupabase.mockReturnValue(svc)
    const res = await request(makeApp()).get(
      `/api/members/${USER_ID}/health-score?groupId=${GROUP_ID}`,
    )
    expect(res.status).toBe(500)
    expect(res.body.error).toBe('upsert failed')
  })
})
