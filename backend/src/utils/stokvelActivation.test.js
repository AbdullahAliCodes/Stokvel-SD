import { describe, expect, it, jest } from '@jest/globals'
import { activateStokvel, shuffleMemberIds } from './stokvelActivation.js'

function createServiceSupabaseMock({
  stokvel,
  memberRows = [],
  payoutCount = 0,
  generateDeleteError = null,
  insertError = null,
  updateError = null,
}) {
  const payoutInsertMock = jest.fn(async () => ({ error: insertError }))
  const payoutDeleteEqMock = jest.fn(async () => ({ error: generateDeleteError }))
  const payoutsSelectEqMock = jest.fn(async () => ({ count: payoutCount, error: null }))
  const stokvelSelectEqMock = jest.fn(async () => ({ data: stokvel, error: null }))
  const membersEqMock = jest.fn(async () => ({ data: memberRows, error: null }))
  const stokvelUpdateEqMock = jest.fn(async () => ({ error: updateError }))

  return {
    from(table) {
      if (table === 'stokvels') {
        return {
          select() {
            return { eq: () => ({ maybeSingle: stokvelSelectEqMock }) }
          },
          update() {
            return { eq: stokvelUpdateEqMock }
          },
        }
      }
      if (table === 'stokvel_members') {
        return {
          select() {
            return { eq: membersEqMock }
          },
        }
      }
      if (table === 'payouts') {
        return {
          select() {
            return { eq: payoutsSelectEqMock }
          },
          delete() {
            return { eq: payoutDeleteEqMock }
          },
          insert: payoutInsertMock,
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    },
    _mocks: {
      payoutInsertMock,
      payoutDeleteEqMock,
      stokvelUpdateEqMock,
    },
  }
}

describe('shuffleMemberIds', () => {
  it('returns same values (possibly different order)', () => {
    const originalCrypto = global.crypto
    global.crypto = {
      getRandomValues(buf) {
        buf[0] = 1
        return buf
      },
    }

    const input = ['a', 'b', 'c']
    const out = shuffleMemberIds(input)

    expect(out).toHaveLength(3)
    expect(new Set(out)).toEqual(new Set(input))
    expect(input).toEqual(['a', 'b', 'c'])
    global.crypto = originalCrypto
  })
})

describe('activateStokvel', () => {
  it('fails when service client is missing', async () => {
    const result = await activateStokvel('stokvel-1', null)
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/required/i)
  })

  it('returns skipped when active stokvel already has payouts', async () => {
    const svc = createServiceSupabaseMock({
      stokvel: {
        id: 'stokvel-1',
        status: 'active',
        type: 'Rotating',
        cycle_length: 2,
        payout_order_type: 'randomize',
      },
      payoutCount: 2,
    })

    const result = await activateStokvel('stokvel-1', svc)
    expect(result).toEqual({ ok: true, skipped: true, payoutCount: 2 })
  })

  it('activates pending stokvel with manual payout sequence', async () => {
    const m1 = '123e4567-e89b-12d3-a456-426614174000'
    const m2 = '987f6543-a21b-12d3-a456-426614174000'
    const svc = createServiceSupabaseMock({
      stokvel: {
        id: 'stokvel-1',
        status: 'pending',
        type: 'Rotating',
        cycle_length: 2,
        payout_order_type: 'manual',
        proposed_payout_sequence: [m1, m2],
      },
      memberRows: [{ user_id: m1 }, { user_id: m2 }],
    })

    const result = await activateStokvel('stokvel-1', svc, {
      activationInstant: new Date('2026-01-15T00:00:00.000Z'),
    })

    expect(result.ok).toBe(true)
    expect(result.payoutCount).toBe(2)
    expect(svc._mocks.payoutDeleteEqMock).toHaveBeenCalledWith('stokvel_id', 'stokvel-1')
    expect(svc._mocks.payoutInsertMock).toHaveBeenCalledTimes(1)
    expect(svc._mocks.stokvelUpdateEqMock).toHaveBeenCalledWith('id', 'stokvel-1')
  })
})
