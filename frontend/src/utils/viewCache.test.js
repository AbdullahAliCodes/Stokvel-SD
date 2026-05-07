import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readViewCache, writeViewCache } from './viewCache'

describe('viewCache', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-15T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('writes and reads cache payload within TTL', () => {
    const payload = { a: 1, b: 'ok' }
    writeViewCache('dash', payload)
    expect(readViewCache('dash', 60_000)).toEqual(payload)
  })

  it('returns null when cache key is missing', () => {
    expect(readViewCache('missing')).toBeNull()
  })

  it('returns null when JSON is invalid', () => {
    sessionStorage.setItem('stokvel_cache_v1:bad', '{not-json')
    expect(readViewCache('bad')).toBeNull()
  })

  it('returns null when parsed value is not an object', () => {
    sessionStorage.setItem('stokvel_cache_v1:bad-shape', JSON.stringify(42))
    expect(readViewCache('bad-shape')).toBeNull()
  })

  it('returns null for invalid or expired timestamps', () => {
    sessionStorage.setItem('stokvel_cache_v1:no-ts', JSON.stringify({ data: { ok: true } }))
    expect(readViewCache('no-ts')).toBeNull()

    sessionStorage.setItem(
      'stokvel_cache_v1:expired',
      JSON.stringify({ ts: Date.now() - 10_000, data: { ok: true } }),
    )
    expect(readViewCache('expired', 1_000)).toBeNull()
  })

  it('returns null when cached data is missing (nullish coalescing branch)', () => {
    sessionStorage.setItem('stokvel_cache_v1:null-data', JSON.stringify({ ts: Date.now() }))
    expect(readViewCache('null-data')).toBeNull()
  })

  it('swallows sessionStorage write errors', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })
    expect(() => writeViewCache('x', { y: 1 })).not.toThrow()
    expect(spy).toHaveBeenCalled()
  })
})
