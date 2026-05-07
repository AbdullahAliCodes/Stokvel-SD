import { describe, it, expect } from 'vitest'
import {
  toLocalDateKey,
  toDisplayMeetingDate,
  buildMonthGrid,
  groupMeetingsByLocalDateKey,
} from './meetingCalendarUtils'

describe('meetingCalendarUtils', () => {
  describe('toLocalDateKey', () => {
    it('returns yyyy-mm-dd for valid date strings and Date objects', () => {
      expect(toLocalDateKey('2026-05-07T09:30:00.000Z')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(toLocalDateKey(new Date('2026-05-07T09:30:00.000Z'))).toMatch(
        /^\d{4}-\d{2}-\d{2}$/,
      )
    })

    it('returns null for invalid dates', () => {
      expect(toLocalDateKey('not-a-date')).toBeNull()
    })
  })

  describe('toDisplayMeetingDate', () => {
    it('returns em dash when value is missing', () => {
      expect(toDisplayMeetingDate('')).toBe('—')
      expect(toDisplayMeetingDate(null)).toBe('—')
    })

    it('returns original value when date parsing fails', () => {
      expect(toDisplayMeetingDate('bad-date')).toBe('bad-date')
    })

    it('returns formatted en-ZA string for valid date', () => {
      const out = toDisplayMeetingDate('2026-05-07T09:30:00.000Z')
      expect(typeof out).toBe('string')
      expect(out.length).toBeGreaterThan(0)
      expect(out).not.toBe('—')
    })
  })

  describe('buildMonthGrid', () => {
    it('builds full week grid with empties for regular month boundary', () => {
      const grid = buildMonthGrid(2026, 4) // May 2026
      expect(grid.length % 7).toBe(0)
      expect(grid.some((c) => c.type === 'empty')).toBe(true)
      expect(grid.filter((c) => c.type === 'day')).toHaveLength(31)
    })

    it('handles leap year february correctly', () => {
      const leapGrid = buildMonthGrid(2024, 1) // Feb 2024
      expect(leapGrid.filter((c) => c.type === 'day')).toHaveLength(29)
    })
  })

  describe('groupMeetingsByLocalDateKey', () => {
    it('groups by local date key and sorts each day by meeting_date', () => {
      const meetings = [
        { id: 'm2', meeting_date: '2026-05-07T12:00:00.000Z' },
        { id: 'm1', meeting_date: '2026-05-07T08:00:00.000Z' },
        { id: 'm3', meeting_date: '2026-05-08T09:00:00.000Z' },
      ]

      const grouped = groupMeetingsByLocalDateKey(meetings)
      const key1 = toLocalDateKey('2026-05-07T12:00:00.000Z')
      const key2 = toLocalDateKey('2026-05-08T09:00:00.000Z')
      expect(grouped.get(key1).map((x) => x.id)).toEqual(['m1', 'm2'])
      expect(grouped.get(key2).map((x) => x.id)).toEqual(['m3'])
    })

    it('skips invalid meeting dates', () => {
      const grouped = groupMeetingsByLocalDateKey([
        { id: 'ok', meeting_date: '2026-01-01T10:00:00.000Z' },
        { id: 'bad', meeting_date: 'nope' },
      ])
      const all = [...grouped.values()].flat()
      expect(all.map((x) => x.id)).toContain('ok')
      expect(all.map((x) => x.id)).not.toContain('bad')
    })
  })
})
