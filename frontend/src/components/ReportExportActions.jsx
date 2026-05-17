import { Download } from 'lucide-react'
import { btnGhost } from '../ui'
import { downloadCsv, downloadPdf } from '../utils/reportExport'

export default function ReportExportActions({
  title,
  subtitle,
  filenameBase,
  headers,
  rows,
  disabled = false,
  className = '',
}) {
  const empty = !headers?.length || !rows?.length

  function handleCsv() {
    if (disabled || empty) return
    downloadCsv(filenameBase, headers, rows)
  }

  function handlePdf() {
    if (disabled || empty) return
    void downloadPdf({ title, subtitle, headers, rows, filenameBase })
  }

  return (
    <div
      className={`flex flex-wrap items-center gap-1 ${className}`}
      role="group"
      aria-label={`Export ${title}`}
    >
      <button
        type="button"
        disabled={disabled || empty}
        onClick={handleCsv}
        className={`${btnGhost} inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40`}
        title={empty ? 'No data to export' : 'Download CSV'}
      >
        <Download className="h-3.5 w-3.5 shrink-0" aria-hidden />
        CSV
      </button>
      <button
        type="button"
        disabled={disabled || empty}
        onClick={handlePdf}
        className={`${btnGhost} inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40`}
        title={empty ? 'No data to export' : 'Download PDF'}
      >
        <Download className="h-3.5 w-3.5 shrink-0" aria-hidden />
        PDF
      </button>
    </div>
  )
}
