import { describe, it, expect } from 'vitest'
import { stokvelStatusOf, myStokvelsCacheKey } from './stokvelMembership'

describe('stokvelMembership utils', () => {
  it('normalizes stokvel status to lowercase', () => {
    expect(stokvelStatusOf({ stokvels: { status: 'ACTIVE' } })).toBe('active')
    expect(stokvelStatusOf({ stokvels: { status: 'Pending' } })).toBe('pending')
  })

  it('returns empty string for missing or null status payloads', () => {
    expect(stokvelStatusOf(null)).toBe('')
    expect(stokvelStatusOf({})).toBe('')
    expect(stokvelStatusOf({ stokvels: {} })).toBe('')
  })

  it('builds deterministic user cache key', () => {
    expect(myStokvelsCacheKey('user-123')).toBe('my_stokvels:user-123')
    expect(myStokvelsCacheKey('')).toBe('my_stokvels:')
  })
})
