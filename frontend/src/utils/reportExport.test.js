import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  buildCsvContent,
  downloadCsv,
  escapeCsvCell,
  safeExportFilename,
} from './reportExport'

describe('reportExport', () => {
  describe('escapeCsvCell', () => {
    it('quotes values with commas or newlines', () => {
      expect(escapeCsvCell('a,b')).toBe('"a,b"')
      expect(escapeCsvCell('line\nbreak')).toBe('"line\nbreak"')
    })

    it('doubles embedded quotes', () => {
      expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""')
    })
  })

  describe('buildCsvContent', () => {
    it('includes UTF-8 BOM and header row', () => {
      const csv = buildCsvContent(['Name', 'Amount'], [['Alice', 'R 100']])
      expect(csv.startsWith('\uFEFF')).toBe(true)
      expect(csv).toContain('Name,Amount')
      expect(csv).toContain('Alice,R 100')
    })
  })

  describe('safeExportFilename', () => {
    it('sanitizes unsafe characters', () => {
      expect(safeExportFilename('My Group / report!')).toBe('My_Group_report')
    })
  })

  describe('downloadCsv', () => {
    beforeEach(() => {
      vi.stubGlobal('URL', {
        createObjectURL: vi.fn(() => 'blob:mock'),
        revokeObjectURL: vi.fn(),
      })
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('triggers a download with a .csv filename', () => {
      const click = vi.fn()
      const anchor = { href: '', download: '', style: {}, click }
      const createElement = vi.spyOn(document, 'createElement').mockReturnValue(anchor)
      const appendChild = vi.spyOn(document.body, 'appendChild').mockImplementation(() => {})
      const removeChild = vi.spyOn(document.body, 'removeChild').mockImplementation(() => {})

      downloadCsv('group_report', ['Col'], [['val']])

      expect(URL.createObjectURL).toHaveBeenCalled()
      expect(createElement).toHaveBeenCalledWith('a')
      expect(anchor.download).toBe('group_report.csv')
      expect(click).toHaveBeenCalled()
      expect(appendChild).toHaveBeenCalledWith(anchor)
      expect(removeChild).toHaveBeenCalledWith(anchor)
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock')

      createElement.mockRestore()
      appendChild.mockRestore()
      removeChild.mockRestore()
    })
  })
})
