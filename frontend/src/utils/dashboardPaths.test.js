import { describe, it, expect, beforeEach, afterEach } from 'vitest'
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
  })

  describe('stokvelIdFromPath', () => {
    it('extracts id from group routes', () => {
      expect(stokvelIdFromPath('/group/abc-1/payments')).toBe('abc-1')
    })

    it('returns null for non-group routes', () => {
      expect(stokvelIdFromPath('/account')).toBeNull()
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
    })
  })

  describe('adminPageBackTarget', () => {
    it('returns null on admin groups hub', () => {
      expect(adminPageBackTarget('/admin/groups')).toBeNull()
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
