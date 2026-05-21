import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  adminPageBackTarget,
  groupDashboardPath,
  readLastStokvelId,
  stokvelIdFromPath,
} from './dashboardPaths'

describe('dashboardPaths', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('readLastStokvelId', () => {
    it('returns stored id when present', () => {
      localStorage.setItem('last_stokvel_id', 'saved-42')
      expect(readLastStokvelId()).toBe('saved-42')
    })

    it('returns null when missing or empty', () => {
      expect(readLastStokvelId()).toBeNull()
      localStorage.setItem('last_stokvel_id', '')
      expect(readLastStokvelId()).toBeNull()
    })

    it('returns null when localStorage throws', () => {
      const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('storage blocked')
      })
      expect(readLastStokvelId()).toBeNull()
      getItem.mockRestore()
    })
  })

  describe('stokvelIdFromPath', () => {
    it('extracts id from group routes', () => {
      expect(stokvelIdFromPath('/group/abc-1/payments')).toBe('abc-1')
    })

    it('returns null for non-group routes', () => {
      expect(stokvelIdFromPath('/account')).toBeNull()
      expect(stokvelIdFromPath('')).toBeNull()
    })
  })

  describe('groupDashboardPath', () => {
    it('builds scoped dashboard path when id is provided', () => {
      expect(groupDashboardPath('x1')).toBe('/group/x1/dashboard')
    })

    it('falls back to last stokvel id', () => {
      localStorage.setItem('last_stokvel_id', 'saved-9')
      expect(groupDashboardPath(null)).toBe('/group/saved-9/dashboard')
    })

    it('falls back to gateway when no id is known', () => {
      expect(groupDashboardPath(null)).toBe('/dashboard')
      expect(groupDashboardPath('')).toBe('/dashboard')
    })

    it('treats an empty explicit id as missing and uses last_stokvel_id', () => {
      localStorage.setItem('last_stokvel_id', 'saved-9')
      expect(groupDashboardPath('')).toBe('/group/saved-9/dashboard')
    })
  })

  describe('adminPageBackTarget', () => {
    it('returns null on admin root and groups hub', () => {
      expect(adminPageBackTarget('/admin')).toBeNull()
      expect(adminPageBackTarget('/admin/groups')).toBeNull()
    })

    it('returns null for non-admin paths', () => {
      expect(adminPageBackTarget('/account')).toBeNull()
    })

    it('returns groups hub for other admin routes', () => {
      expect(adminPageBackTarget('/admin/groups/9/edit')).toEqual({
        to: '/admin/groups',
        label: 'Back to groups',
      })
      expect(adminPageBackTarget('/admin/tickets')).toEqual({
        to: '/admin/groups',
        label: 'Back to groups',
      })
    })
  })
})
