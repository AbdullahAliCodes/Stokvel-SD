import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'

const USER_ID = '11111111-1111-4111-8111-111111111111'
const GROUP_ID = '22222222-2222-4222-8222-222222222222'

function listQueryMock(result) {
  let eqCalls = 0
  const neededEq = 2
  const chain = {
    select: jest.fn().mockImplementation(() => chain),
    eq: jest.fn().mockImplementation(() => {
      eqCalls += 1
      if (eqCalls >= neededEq) return Promise.resolve(result)
      return chain
    }),
  }
  return chain
}

function meetingsQueryMock(result) {
  let eqCalls = 0
  const chain = {
    select: jest.fn().mockImplementation(() => chain),
    eq: jest.fn().mockImplementation(() => {
      eqCalls += 1
      if (eqCalls >= 1) return Promise.resolve(result)
      return chain
    }),
  }
  return chain
}

function memberQueryMock(result) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue(result),
  }
}

function mockSupabaseClient({
  contributions = { data: [], error: null },
  missed = { data: [], error: null },
  meetings = { data: [], error: null },
  member = { data: { created_at: '2025-01-15T10:00:00.000Z' }, error: null },
} = {}) {
  return {
    from: jest.fn((table) => {
      if (table === 'contributions') return listQueryMock(contributions)
      if (table === 'missed_payments') return listQueryMock(missed)
      if (table === 'meetings') return meetingsQueryMock(meetings)
      if (table === 'stokvel_members') return memberQueryMock(member)
      return listQueryMock({ data: [], error: null })
    }),
  }
}

const { calculateHealthScore } = await import('./healthScoreService.js')

describe('calculateHealthScore', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      text: async () => '',
    })
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('returns nodata row when there are no counted contribution months', async () => {
    const client = mockSupabaseClient()
    const { row, meta } = await calculateHealthScore(USER_ID, GROUP_ID, client)

    expect(row.model_version).toBe('nodata')
    expect(row.score).toBe(50)
    expect(meta.insufficientData).toBe(true)
    expect(meta.note).toMatch(/not enough data/i)
  })

  it('uses weighted fallback when ML service is unavailable', async () => {
    const client = mockSupabaseClient({
      contributions: {
        data: [
          {
            paid_at: '2026-04-02T10:00:00.000Z',
            target_month: '2026-04',
            treasurer_approval_status: 'approved',
            amount: 500,
            user_id: USER_ID,
            stokvel_id: GROUP_ID,
          },
        ],
        error: null,
      },
    })

    const { row, meta } = await calculateHealthScore(USER_ID, GROUP_ID, client)

    expect(meta.insufficientData).toBe(false)
    expect(row.model_version).toBe('fallback')
    expect(row.score).toBeGreaterThan(0)
    expect(meta.summaryLine).toMatch(/paid on time/i)
  })

  it('uses ML prediction when service returns a valid score', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          score: 88.5,
          grade: 'Excellent',
          confidence: 72,
          feature_importances: { on_time_rate: 0.4 },
        }),
    })

    const client = mockSupabaseClient({
      contributions: {
        data: [
          {
            paid_at: '2026-04-02T10:00:00.000Z',
            target_month: '2026-04',
            treasurer_approval_status: 'approved',
          },
          {
            paid_at: '2026-03-28T10:00:00.000Z',
            target_month: '2026-03',
            treasurer_approval_status: 'approved',
          },
        ],
        error: null,
      },
    })

    const { row, meta } = await calculateHealthScore(USER_ID, GROUP_ID, client)

    expect(row.model_version).toBe('v1')
    expect(row.score).toBe(88.5)
    expect(row.grade).toBe('Excellent')
    expect(meta.feature_importances).toEqual({ on_time_rate: 0.4 })
  })

  it('ignores rejected contributions and counts unresolved missed payments', async () => {
    const client = mockSupabaseClient({
      contributions: {
        data: [
          {
            paid_at: '2026-04-02T10:00:00.000Z',
            target_month: '2026-04',
            treasurer_approval_status: 'rejected',
          },
        ],
        error: null,
      },
      missed: {
        data: [{ id: 'm1', resolved_at: null }],
        error: null,
      },
    })

    const { row, meta } = await calculateHealthScore(USER_ID, GROUP_ID, client)

    expect(row.model_version).toBe('nodata')
    expect(meta.insufficientData).toBe(true)
    expect(row.missed_payments).toBe(1)
  })

  it('throws when a Supabase query fails', async () => {
    const client = mockSupabaseClient({
      contributions: { data: null, error: { message: 'db down' } },
    })

    await expect(calculateHealthScore(USER_ID, GROUP_ID, client)).rejects.toThrow('db down')
  })

  it('marks low confidence with a single tracked month', async () => {
    const client = mockSupabaseClient({
      contributions: {
        data: [
          {
            paid_at: '2026-04-02T10:00:00.000Z',
            target_month: '2026-04',
            treasurer_approval_status: 'approved',
          },
        ],
        error: null,
      },
      meetings: {
        data: [{ id: 'meet-1', meeting_date: '2026-04-10T10:00:00.000Z' }],
        error: null,
      },
    })

    const { meta } = await calculateHealthScore(USER_ID, GROUP_ID, client)

    expect(meta.lowConfidence).toBe(true)
    expect(meta.summaryLine).toMatch(/only one month/i)
  })
})
