import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  adminPageBackTarget,
  groupDashboardPath,
  memberPageBackTarget,
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

  describe('memberPageBackTarget', () => {
    it('returns null on group dashboard home', () => {
      expect(memberPageBackTarget('/group/s1/dashboard')).toBeNull()
    })

    it('returns group dashboard for scoped sub-routes', () => {
      expect(memberPageBackTarget('/group/s1/payments')).toEqual({
        to: '/group/s1/dashboard',
        label: 'Back to dashboard',
      })
    })

    it('returns gateway or last group for global member routes', () => {
      expect(memberPageBackTarget('/account')).toEqual({
        to: '/dashboard',
        label: 'Back to dashboard',
      })
      localStorage.setItem('last_stokvel_id', 'last-1')
      expect(memberPageBackTarget('/support')).toEqual({
        to: '/group/last-1/dashboard',
        label: 'Back to dashboard',
      })
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
