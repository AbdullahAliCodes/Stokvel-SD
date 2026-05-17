import { describe, expect, it, jest } from '@jest/globals'
import { activateStokvel, shuffleMemberIds } from './stokvelActivation.js'

function createServiceSupabaseMock({
  stokvel,
  memberRows = [],
  payoutCount = 0,
  inviteRows = [],
  inviteError = null,
  profileRows = [],
  profileError = null,
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
      if (table === 'profiles') {
        return {
          select() {
            return {
              in() {
                return Promise.resolve({ data: profileRows, error: profileError })
              },
            }
          },
        }
      }
      if (table === 'invitations') {
        return {
          select() {
            return {
              eq() {
                return {
                  in() {
                    return Promise.resolve({ data: inviteRows, error: inviteError })
                  },
                }
              },
            }
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
      membersEqMock,
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

  it('fails unified roster check with descriptive message', async () => {
    const m1 = '123e4567-e89b-12d3-a456-426614174000'
    const svc = createServiceSupabaseMock({
      stokvel: {
        id: 'stokvel-1',
        status: 'pending',
        type: 'Rotating',
        cycle_length: 6,
        payout_order_type: 'randomize',
      },
      memberRows: [{ user_id: m1 }],
      inviteRows: [],
      profileRows: [],
    })

    const result = await activateStokvel('stokvel-1', svc)
    expect(result.ok).toBe(false)
    expect(result.error).toBe(
      'Total roster (1 registered + 0 pending) must equal cycle_length (6).',
    )
  })

  it('activates with deferred ledger when open invitations remain', async () => {
    const m1 = '123e4567-e89b-12d3-a456-426614174001'
    const m2 = '123e4567-e89b-12d3-a456-426614174002'
    const m3 = '123e4567-e89b-12d3-a456-426614174003'
    const m4 = '123e4567-e89b-12d3-a456-426614174004'
    const m5 = '123e4567-e89b-12d3-a456-426614174005'

    const svc = createServiceSupabaseMock({
      stokvel: {
        id: 'stokvel-1',
        status: 'pending',
        type: 'Rotating',
        cycle_length: 6,
        payout_order_type: 'randomize',
      },
      memberRows: [
        { user_id: m1 },
        { user_id: m2 },
        { user_id: m3 },
        { user_id: m4 },
        { user_id: m5 },
      ],
      inviteRows: [{ id: 'inv-1', email: 'still-outstanding@example.com' }],
      profileRows: [],
    })

    const result = await activateStokvel('stokvel-1', svc)

    expect(result).toEqual({
      ok: true,
      deferred: true,
      payoutCount: 0,
      registeredCount: 5,
      pendingInviteCount: 1,
    })
    expect(svc._mocks.payoutInsertMock).not.toHaveBeenCalled()
    expect(svc._mocks.stokvelUpdateEqMock).toHaveBeenCalledWith('id', 'stokvel-1')
  })

  it('activates pending stokvel with manual payout sequence when roster is fully registered', async () => {
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
      inviteRows: [],
      profileRows: [],
    })

    const result = await activateStokvel('stokvel-1', svc, {
      activationInstant: new Date('2026-01-15T00:00:00.000Z'),
    })

    expect(result.ok).toBe(true)
    expect(result.deferred).toBe(false)
    expect(result.payoutCount).toBe(2)
    expect(svc._mocks.payoutDeleteEqMock).toHaveBeenCalledWith('stokvel_id', 'stokvel-1')
    expect(svc._mocks.payoutInsertMock).toHaveBeenCalledTimes(1)
    expect(svc._mocks.stokvelUpdateEqMock).toHaveBeenCalledWith('id', 'stokvel-1')
  })

  it('finalizes ledger when active with zero payouts and no pending invites', async () => {
    const m1 = '123e4567-e89b-12d3-a456-426614174010'
    const m2 = '987f6543-a21b-12d3-a456-426614174011'
    const svc = createServiceSupabaseMock({
      stokvel: {
        id: 'stokvel-1',
        status: 'active',
        type: 'Rotating',
        cycle_length: 2,
        payout_order_type: 'randomize',
      },
      memberRows: [{ user_id: m1 }, { user_id: m2 }],
      payoutCount: 0,
      inviteRows: [],
      profileRows: [],
    })

    const result = await activateStokvel('stokvel-1', svc, {
      activationInstant: new Date('2026-01-15T00:00:00.000Z'),
    })

    expect(result.ok).toBe(true)
    expect(result.deferred).toBe(false)
    expect(result.payoutCount).toBe(2)
    expect(svc._mocks.payoutInsertMock).toHaveBeenCalledTimes(1)
  })

  it('returns invitation query errors cleanly', async () => {
    const m1 = '123e4567-e89b-12d3-a456-426614174020'
    const svc = createServiceSupabaseMock({
      stokvel: {
        id: 'stokvel-1',
        status: 'pending',
        type: 'Rotating',
        cycle_length: 1,
        payout_order_type: 'randomize',
      },
      memberRows: [{ user_id: m1 }],
      inviteError: new Error('invite query failed'),
      profileRows: [],
    })

    const result = await activateStokvel('stokvel-1', svc)
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/invite query failed/)
  })

  it('dedupes pending invite when email already belongs to a registered member', async () => {
    const m1 = '123e4567-e89b-12d3-a456-426614174030'
    const m2 = '987f6543-a21b-12d3-a456-426614174031'
    const svc = createServiceSupabaseMock({
      stokvel: {
        id: 'stokvel-1',
        status: 'pending',
        type: 'Rotating',
        cycle_length: 2,
        payout_order_type: 'randomize',
      },
      memberRows: [{ user_id: m1 }, { user_id: m2 }],
      inviteRows: [{ id: 'inv-dup', email: 'member-two@example.com' }],
      profileRows: [
        { id: m1, email: 'member-one@example.com' },
        { id: m2, email: 'member-two@example.com' },
      ],
    })

    const result = await activateStokvel('stokvel-1', svc, {
      activationInstant: new Date('2026-01-15T00:00:00.000Z'),
    })

    expect(result.ok).toBe(true)
    expect(result.deferred).toBe(false)
    expect(result.payoutCount).toBe(2)
  })

  it('activates Investment stokvel without cycle_length roster match', async () => {
    const m1 = '123e4567-e89b-12d3-a456-426614174040'
    const m2 = '987f6543-a21b-12d3-a456-426614174041'
    const svc = createServiceSupabaseMock({
      stokvel: {
        id: 'stokvel-inv',
        status: 'pending',
        type: 'Investment',
        cycle_length: 99,
        maturity_date: '2027-06-15T00:00:00.000Z',
        payout_order_type: 'randomize',
      },
      memberRows: [{ user_id: m1 }, { user_id: m2 }],
      profileRows: [
        { id: m1, email: 'a@example.com' },
        { id: m2, email: 'b@example.com' },
      ],
    })

    const result = await activateStokvel('stokvel-inv', svc)

    expect(result.ok).toBe(true)
    expect(result.payoutCount).toBe(2)
    const updateArg = svc._mocks.stokvelUpdateEqMock.mock.calls[0]
    expect(updateArg).toBeDefined()
  })
})
