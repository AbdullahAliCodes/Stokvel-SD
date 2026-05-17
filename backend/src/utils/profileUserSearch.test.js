import { jest, describe, it, expect, beforeEach } from '@jest/globals'

const mockCreateUserJwtSupabase = jest.fn()
const mockGetServiceSupabase = jest.fn()

jest.unstable_mockModule('./supabaseAdmin.js', () => ({
  getServiceSupabase: mockGetServiceSupabase,
  createUserJwtSupabase: mockCreateUserJwtSupabase,
}))

const { searchProfilesForMemberInvite } = await import('./profileUserSearch.js')

function makeReq({
  q = '',
  auth = 'Bearer token-123',
} = {}) {
  return {
    query: { q },
    headers: { authorization: auth },
  }
}

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  }
}

function makeClient(resultsByColumn = {}, throwOn = null) {
  return {
    from() {
      return {
        select() {
          return {
            ilike(col, pattern) {
              if (throwOn === col) {
                throw new Error(`boom:${col}`)
              }
              return {
                limit() {
                  return Promise.resolve(
                    resultsByColumn[col] || { data: [], error: null, _pattern: pattern },
                  )
                },
              }
            },
          }
        },
      }
    },
  }
}

describe('searchProfilesForMemberInvite', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetServiceSupabase.mockReturnValue(null)
    mockCreateUserJwtSupabase.mockReturnValue(null)
  })

  it('returns 503 when neither service nor user client is available', async () => {
    const req = makeReq({ q: 'jo' })
    const res = makeRes()

    await searchProfilesForMemberInvite(req, res)

    expect(res.status).toHaveBeenCalledWith(503)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringMatching(/unavailable/i) }),
    )
  })

  it('returns empty users when query length is less than 2', async () => {
    const req = makeReq({ q: 'a' })
    const res = makeRes()

    await searchProfilesForMemberInvite(req, res)

    expect(res.json).toHaveBeenCalledWith({ users: [] })
    expect(mockCreateUserJwtSupabase).not.toHaveBeenCalled()
  })

  it('uses service client when available', async () => {
    const client = makeClient()
    mockGetServiceSupabase.mockReturnValue(client)

    const req = makeReq({ q: 'john' })
    const res = makeRes()

    await searchProfilesForMemberInvite(req, res)

    expect(mockCreateUserJwtSupabase).not.toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith({ users: [] })
  })

  it('falls back to user-scoped client when service client is unavailable', async () => {
    const client = makeClient()
    mockCreateUserJwtSupabase.mockReturnValue(client)

    const req = makeReq({ q: 'john' })
    const res = makeRes()

    await searchProfilesForMemberInvite(req, res)

    expect(mockCreateUserJwtSupabase).toHaveBeenCalledWith(req, 'profile search')
    expect(res.json).toHaveBeenCalledWith({ users: [] })
  })

  it('returns 500 when any search query returns an error', async () => {
    const client = makeClient({
      first_name: { data: [], error: { message: 'db failed' } },
      last_name: { data: [], error: null },
      username: { data: [], error: null },
      email: { data: [], error: null },
    })
    mockGetServiceSupabase.mockReturnValue(client)

    const req = makeReq({ q: 'john' })
    const res = makeRes()

    await searchProfilesForMemberInvite(req, res)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({ error: 'db failed' })
  })

  it('returns database failure message when search error has no message', async () => {
    const client = makeClient({
      first_name: { data: [], error: {} },
      last_name: { data: [], error: null },
      username: { data: [], error: null },
      email: { data: [], error: null },
    })
    mockGetServiceSupabase.mockReturnValue(client)

    const req = makeReq({ q: 'john' })
    const res = makeRes()

    await searchProfilesForMemberInvite(req, res)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({
      error: 'Database request failed.',
    })
  })

  it('escapes ilike wildcard characters in query and returns mapped deduped users', async () => {
    const rowA = {
      id: 'u1',
      first_name: 'John',
      last_name: 'Doe',
      username: 'john',
      email: ' john@x.com ',
    }
    const rowB = {
      id: 'u2',
      first_name: '',
      last_name: '',
      username: '',
      email: 'plain@x.com',
    }
    const client = makeClient({
      first_name: { data: [rowA], error: null },
      last_name: { data: [rowA], error: null }, // duplicate id to test dedupe
      username: { data: [rowB], error: null },
      email: { data: [], error: null },
    })
    mockGetServiceSupabase.mockReturnValue(client)

    const req = makeReq({ q: 'jo%_hn\\' })
    const res = makeRes()

    await searchProfilesForMemberInvite(req, res)

    expect(res.json).toHaveBeenCalledWith({
      users: [
        {
          id: 'u1',
          username: 'john',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@x.com',
          label: '@john · John Doe',
        },
        {
          id: 'u2',
          username: '',
          firstName: '',
          lastName: '',
          email: 'plain@x.com',
          label: 'u2',
        },
      ],
    })
  })

  it('removes commas from query before searching', async () => {
    const captured = []
    const client = {
      from() {
        return {
          select() {
            return {
              ilike(_col, pattern) {
                captured.push(pattern)
                return {
                  limit() {
                    return Promise.resolve({ data: [], error: null })
                  },
                }
              },
            }
          },
        }
      },
    }
    mockGetServiceSupabase.mockReturnValue(client)

    const req = makeReq({ q: 'jo,hn' })
    const res = makeRes()
    await searchProfilesForMemberInvite(req, res)

    expect(captured[0]).toBe('%john%')
  })

  it('maps null name fields and non-string email to safe defaults', async () => {
    const client = makeClient({
      first_name: {
        data: [{ id: 'u3', first_name: null, last_name: undefined, username: 'abc', email: 123 }],
        error: null,
      },
      last_name: { data: [], error: null },
      username: { data: [], error: null },
      email: { data: [], error: null },
    })
    mockGetServiceSupabase.mockReturnValue(client)

    const req = makeReq({ q: 'ab' })
    const res = makeRes()
    await searchProfilesForMemberInvite(req, res)

    expect(res.json).toHaveBeenCalledWith({
      users: [
        {
          id: 'u3',
          username: 'abc',
          firstName: '',
          lastName: '',
          email: '',
          label: '@abc',
        },
      ],
    })
  })

  it('returns 500 with error message on unexpected exception inside query', async () => {
    const client = makeClient({}, 'first_name')
    mockGetServiceSupabase.mockReturnValue(client)

    const req = makeReq({ q: 'john' })
    const res = makeRes()

    await searchProfilesForMemberInvite(req, res)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({ error: 'boom:first_name' })
  })
})
