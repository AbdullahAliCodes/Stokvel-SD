import { describe, expect, it } from '@jest/globals'

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co'
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'anon-key-for-tests'

const {
  collectUuidsFromMemberDetails,
  normalizeDocuments,
  normalizeInitialMemberIds,
  normalizeMemberDetails,
  normalizeMembersCount,
  normalizeTreasurerUserIdMember,
} = await import('./index.js')

describe('index normalization helpers', () => {
  const validA = '123e4567-e89b-12d3-a456-426614174000'
  const validB = '987f6543-a21b-12d3-a456-426614174000'

  it('normalizes members count with range checks', () => {
    expect(normalizeMembersCount('3')).toBe(3)
    expect(normalizeMembersCount(500)).toBe(500)
    expect(normalizeMembersCount(0)).toBeNull()
    expect(normalizeMembersCount(501)).toBeNull()
    expect(normalizeMembersCount('abc')).toBeNull()
  })

  it('normalizes member details and keeps meaningful entries', () => {
    const rows = normalizeMemberDetails(
      [
        { userId: ` ${validA.toUpperCase()} `, name: '  Ada ', email: ' TEST@EXAMPLE.COM ', role: ' member ' },
        { userId: 'bad', name: ' ', email: '', role: '' },
      ],
      10,
    )

    expect(rows).toHaveLength(1)
    expect(rows[0]).toEqual({
      userId: validA,
      name: 'Ada',
      email: 'test@example.com',
      role: 'member',
    })
  })

  it('normalizes documents and initial member IDs', () => {
    expect(normalizeDocuments(['  a.pdf ', '', 'b.pdf'], 10)).toEqual(['a.pdf', 'b.pdf'])

    expect(
      normalizeInitialMemberIds([validA, validA.toUpperCase(), 'bad-id', validB]),
    ).toEqual([validA, validB])
  })

  it('normalizes treasurer ID and collects UUIDs from detail rows', () => {
    expect(normalizeTreasurerUserIdMember(` ${validA.toUpperCase()} `)).toBe(validA)
    expect(normalizeTreasurerUserIdMember('invalid')).toBe('')

    expect(
      collectUuidsFromMemberDetails([
        { userId: validA },
        { userId: 'bad' },
        { userId: validA.toUpperCase() },
        { userId: validB },
      ]),
    ).toEqual([validA, validB])
  })
})
