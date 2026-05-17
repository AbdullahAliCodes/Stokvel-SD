import { describe, it, expect, jest } from '@jest/globals'
import {
  isTransportLayerFailure,
  logSupabaseClientInitFailure,
  sendSupabaseFailure,
} from './supabaseErrors.js'

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  }
}

describe('supabaseErrors', () => {
  describe('isTransportLayerFailure', () => {
    it('detects fetch failed and network codes', () => {
      expect(isTransportLayerFailure({ message: 'fetch failed' })).toBe(true)
      expect(isTransportLayerFailure({ code: 'ECONNREFUSED' })).toBe(true)
      expect(isTransportLayerFailure({ code: 'SUPABASE_CLIENT_UNAVAILABLE' })).toBe(true)
      expect(isTransportLayerFailure({ message: 'certificate verify failed' })).toBe(true)
    })

    it('walks error.cause chain', () => {
      expect(
        isTransportLayerFailure({
          message: 'outer',
          cause: { code: 'ETIMEDOUT' },
        }),
      ).toBe(true)
    })

    it('returns false for ordinary errors', () => {
      expect(isTransportLayerFailure(null)).toBe(false)
      expect(isTransportLayerFailure({ message: 'duplicate key' })).toBe(false)
    })
  })

  describe('logSupabaseClientInitFailure', () => {
    it('logs warning without throwing', () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
      logSupabaseClientInitFailure('test-context', new Error('init broke'))
      expect(warn).toHaveBeenCalled()
      warn.mockRestore()
    })
  })

  describe('sendSupabaseFailure', () => {
    it('responds 503 for client unavailable', () => {
      const res = makeRes()
      sendSupabaseFailure(res, { code: 'SUPABASE_CLIENT_UNAVAILABLE', message: 'nope' }, 'ctx')
      expect(res.status).toHaveBeenCalledWith(503)
      expect(res.json.mock.calls[0][0].error).toMatch(/unavailable/i)
    })

    it('responds 503 for transport failures', () => {
      const res = makeRes()
      sendSupabaseFailure(res, { message: 'fetch failed' }, 'ctx')
      expect(res.status).toHaveBeenCalledWith(503)
      expect(res.json.mock.calls[0][0].error).toMatch(/temporarily unavailable/i)
    })

    it('responds 500 with message for other errors', () => {
      const res = makeRes()
      sendSupabaseFailure(res, { message: 'row level security' }, 'ctx')
      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json.mock.calls[0][0].error).toBe('row level security')
    })

    it('sanitizes object-shaped messages', () => {
      const res = makeRes()
      sendSupabaseFailure(res, { message: '[object Object]' }, 'ctx')
      expect(res.json.mock.calls[0][0].error).toBe('Database request failed.')
    })
  })
})
