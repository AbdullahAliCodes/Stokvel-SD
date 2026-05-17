import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ReportExportActions from './ReportExportActions'

const downloadCsvMock = vi.fn()
const downloadPdfMock = vi.fn()

vi.mock('../utils/reportExport', () => ({
  downloadCsv: (...args) => downloadCsvMock(...args),
  downloadPdf: (...args) => downloadPdfMock(...args),
}))

const baseProps = {
  title: 'Payout schedule',
  subtitle: 'Alpha Group',
  filenameBase: 'alpha_payout_schedule',
  headers: ['Date', 'Member'],
  rows: [['1 Apr', 'Ada']],
}

describe('ReportExportActions', () => {
  beforeEach(() => {
    downloadCsvMock.mockReset()
    downloadPdfMock.mockReset()
  })

  it('renders CSV and PDF export buttons', () => {
    render(<ReportExportActions {...baseProps} />)
    expect(screen.getByRole('button', { name: 'CSV' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'PDF' })).toBeEnabled()
    expect(screen.getByRole('group', { name: 'Export Payout schedule' })).toBeInTheDocument()
  })

  it('disables buttons when rows are empty', () => {
    render(<ReportExportActions {...baseProps} rows={[]} />)
    expect(screen.getByRole('button', { name: 'CSV' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'PDF' })).toBeDisabled()
  })

  it('disables buttons when disabled prop is true', () => {
    render(<ReportExportActions {...baseProps} disabled />)
    expect(screen.getByRole('button', { name: 'CSV' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'PDF' })).toBeDisabled()
  })

  it('calls downloadCsv with filename, headers, and rows', async () => {
    const user = userEvent.setup()
    render(<ReportExportActions {...baseProps} />)
    await user.click(screen.getByRole('button', { name: 'CSV' }))
    expect(downloadCsvMock).toHaveBeenCalledWith(
      'alpha_payout_schedule',
      ['Date', 'Member'],
      [['1 Apr', 'Ada']],
    )
    expect(downloadPdfMock).not.toHaveBeenCalled()
  })

  it('calls downloadPdf with report metadata', async () => {
    const user = userEvent.setup()
    render(<ReportExportActions {...baseProps} />)
    await user.click(screen.getByRole('button', { name: 'PDF' }))
    expect(downloadPdfMock).toHaveBeenCalledWith({
      title: 'Payout schedule',
      subtitle: 'Alpha Group',
      headers: ['Date', 'Member'],
      rows: [['1 Apr', 'Ada']],
      filenameBase: 'alpha_payout_schedule',
    })
    expect(downloadCsvMock).not.toHaveBeenCalled()
  })

  it('does not export when data is empty', async () => {
    const user = userEvent.setup()
    render(<ReportExportActions {...baseProps} headers={[]} rows={[]} />)
    await user.click(screen.getByRole('button', { name: 'CSV' }))
    await user.click(screen.getByRole('button', { name: 'PDF' }))
    expect(downloadCsvMock).not.toHaveBeenCalled()
    expect(downloadPdfMock).not.toHaveBeenCalled()
  })
})
