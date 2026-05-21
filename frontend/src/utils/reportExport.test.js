import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const pdfSave = vi.fn()
const pdfText = vi.fn()
const pdfSetFont = vi.fn()
const pdfSetFontSize = vi.fn()
const pdfSplitTextToSize = vi.fn(() => ['Subtitle line'])
const autoTableMock = vi.fn()

vi.mock('jspdf', () => {
  class JsPDF {
    constructor() {
      this.setFont = pdfSetFont
      this.setFontSize = pdfSetFontSize
      this.text = pdfText
      this.splitTextToSize = pdfSplitTextToSize
      this.save = pdfSave
    }
  }
  return { jsPDF: JsPDF }
})

vi.mock('jspdf-autotable', () => ({
  default: autoTableMock,
}))

import {
  buildCsvContent,
  downloadCsv,
  downloadPdf,
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

    it('returns empty string for nullish values', () => {
      expect(escapeCsvCell(null)).toBe('')
      expect(escapeCsvCell(undefined)).toBe('')
    })
  })

  describe('buildCsvContent', () => {
    it('includes UTF-8 BOM and header row', () => {
      const csv = buildCsvContent(['Name', 'Amount'], [['Alice', 'R 100']])
      expect(csv.startsWith('\uFEFF')).toBe(true)
      expect(csv).toContain('Name,Amount')
      expect(csv).toContain('Alice,R 100')
    })

    it('treats a null rows argument as an empty body', () => {
      const csv = buildCsvContent(['Only'], null)
      expect(csv).toBe('\uFEFFOnly')
    })
  })

  describe('safeExportFilename', () => {
    it('sanitizes unsafe characters', () => {
      expect(safeExportFilename('My Group / report!')).toBe('My_Group_report')
    })

    it('falls back to report when the cleaned name is empty', () => {
      expect(safeExportFilename('!!!')).toBe('report')
      expect(safeExportFilename()).toBe('report')
    })
  })

  describe('downloadPdf', () => {
    beforeEach(() => {
      pdfSave.mockClear()
      pdfText.mockClear()
      pdfSetFont.mockClear()
      pdfSetFontSize.mockClear()
      pdfSplitTextToSize.mockClear()
      autoTableMock.mockClear()
    })

    it('builds a PDF with subtitle and table data', async () => {
      await downloadPdf({
        title: 'Finance summary',
        subtitle: 'Group Alpha · April 2026',
        headers: ['Metric', 'Value'],
        rows: [['Total', 'R 500']],
        filenameBase: 'group_alpha_finance',
      })

      expect(pdfText).toHaveBeenCalledWith('Finance summary', 14, 16)
      expect(pdfSplitTextToSize).toHaveBeenCalled()
      expect(autoTableMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          head: [['Metric', 'Value']],
          body: [['Total', 'R 500']],
        }),
      )
      expect(pdfSave).toHaveBeenCalledWith('group_alpha_finance.pdf')
    })

    it('omits subtitle layout when subtitle is not provided', async () => {
      await downloadPdf({
        title: null,
        headers: ['Col'],
        rows: null,
        filenameBase: 'minimal',
      })

      expect(pdfText).toHaveBeenCalledWith('Report', 14, 16)
      expect(pdfSplitTextToSize).not.toHaveBeenCalled()
      expect(autoTableMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ body: [] }),
      )
      expect(pdfSave).toHaveBeenCalledWith('minimal.pdf')
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
