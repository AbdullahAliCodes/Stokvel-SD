import { useMemo, useRef, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  btnPrimary,
  btnSecondary,
  cardLight,
  tableHead,
  tableRow,
} from '../ui'
import { jsPDF } from 'jspdf'
import { toPng } from 'html-to-image'

const TARGET_MONTH_RE = /^\d{4}-\d{2}$/

// ---------------------------------------------------------------------------
// Data helpers — mirror the logic in Payments.jsx so we stay in sync
// ---------------------------------------------------------------------------

/** Returns true when a member has at least one contribution row for that month. */
function memberPaidForMonth(contributions, userId, month) {
  return (contributions ?? []).some(
    (c) =>
      c?.user_id === userId &&
      c?.target_month === month &&
      TARGET_MONTH_RE.test(String(month)),
  )
}

/** Returns true when a member has an unresolved missed-payment flag for that month. */
function memberFlaggedForMonth(missedPayments, userId, month) {
  return (missedPayments ?? []).some(
    (r) =>
      r?.user_id === userId &&
      r?.target_month === month &&
      r?.resolved_at == null &&
      TARGET_MONTH_RE.test(String(month)),
  )
}

/** Derive a readable display name from the member's profile object. */
function memberDisplay(p) {
  const first = p?.first_name?.trim()
  const last = p?.last_name?.trim()
  if (first || last) return [first, last].filter(Boolean).join(' ')
  if (p?.full_name) return p.full_name
  if (p?.email) return p.email.split('@')[0]
  return 'Member'
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ComplianceReportWidget({
  members = [],
  contributions = [],
  missedPayments = [],
  ledgerMonths = [],
}) {

  // Toggle between "chart" and "table" views
  const [view, setView] = useState('chart')

  // Ref attached to the snapshot container (chart OR table)
  const reportRef = useRef(null)

  // --- Sort members alphabetically so table rows are consistent ---
  const sortedMembers = useMemo(
    () =>
      [...members].sort((a, b) =>
        memberDisplay(a.profiles).localeCompare(memberDisplay(b.profiles), 'en'),
      ),
    [members],
  )

  // ---------------------------------------------------------------------------
  // Build per-month group compliance data (for the chart)
  // ---------------------------------------------------------------------------
  const monthlyChartData = useMemo(() => {
    return ledgerMonths.map((month) => {
      let paid = 0
      let missed = 0

      // Count how many members paid vs missed for this month
      for (const m of members) {
        if (memberPaidForMonth(contributions, m.user_id, month)) {
          paid += 1
        } else {
          missed += 1
        }
      }

      return { month, Paid: paid, Missed: missed }
    })
  }, [ledgerMonths, members, contributions])

  // ---------------------------------------------------------------------------
  // Build per-member compliance grid  (for the table + CSV export)
  // ---------------------------------------------------------------------------
  const memberComplianceRows = useMemo(() => {
    if (ledgerMonths.length === 0) return []

    return sortedMembers.map((m) => {
      const name = memberDisplay(m.profiles)
      let paidCount = 0

      // Determine status for each month
      const monthStatuses = ledgerMonths.map((month) => {
        const paid = memberPaidForMonth(contributions, m.user_id, month)
        const flagged = memberFlaggedForMonth(missedPayments, m.user_id, month)

        if (paid) {
          paidCount += 1
          return 'Paid'
        }
        if (flagged) return 'Missed'
        return 'Unpaid'
      })

      // Calculate overall compliance percentage
      const compliancePct =
        ledgerMonths.length > 0
          ? Math.round((paidCount / ledgerMonths.length) * 100)
          : 0

      return { name, monthStatuses, compliancePct }
    })
  }, [sortedMembers, ledgerMonths, contributions, missedPayments])

  // ---------------------------------------------------------------------------
  // CSV export — creates a downloadable CSV from the table data
  // ---------------------------------------------------------------------------
  function handleExportCsv() {
    // Build header row
    const headers = ['Member', ...ledgerMonths, 'Compliance %']
    const rows = memberComplianceRows.map((row) => [
      row.name,
      ...row.monthStatuses,
      `${row.compliancePct}%`,
    ])

    // Join everything into a CSV string
    const csvContent = [headers, ...rows]
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
      .join('\n')

    // Trigger a browser download
    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'compliance_report.csv'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // ---------------------------------------------------------------------------
  // PDF export — uses html-to-image (toPng) to snapshot the container.
  //
  // Why html-to-image instead of html2canvas?
  //   • html2canvas cannot parse Tailwind v4's oklch() color functions.
  //   • html2canvas struggles with SVG elements inside ResponsiveContainer.
  //   html-to-image uses the browser's native foreignObject SVG rendering
  //   which correctly handles both oklch and nested Recharts SVGs.
  // ---------------------------------------------------------------------------
  async function handleExportPdf() {
    if (!reportRef.current) return

    try {
      // Capture the visible container (chart OR table) as a high-res PNG.
      // We pass a filter that skips the Recharts tooltip portal (invisible
      // overlay that can cause blank captures).
      const dataUrl = await toPng(reportRef.current, {
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        filter: (node) => {
          // Skip the tooltip overlay that Recharts renders off-screen
          if (node?.classList?.contains?.('recharts-tooltip-wrapper')) return false
          return true
        },
      })

      // Load the PNG into an Image so we can measure its pixel dimensions
      const img = new Image()
      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
        img.src = dataUrl
      })

      const imgW = img.naturalWidth
      const imgH = img.naturalHeight

      // Build an A4-landscape PDF sized to fit the snapshot
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      const pageWidth = pdf.internal.pageSize.getWidth()

      // Title
      pdf.setFontSize(16)
      pdf.setTextColor(5, 150, 105) // emerald-600
      pdf.text('Contribution Compliance Report', 14, 16)
      pdf.setTextColor(0, 0, 0)

      // Scale the image to fit the page width with margins
      const usableWidth = pageWidth - 28 // 14mm margin each side
      const scaledHeight = (imgH * usableWidth) / imgW
      pdf.addImage(dataUrl, 'PNG', 14, 24, usableWidth, scaledHeight)

      pdf.save('compliance_report.pdf')
    } catch (err) {
      console.error('PDF generation failed:', err)
      alert('Failed to generate PDF. Check the console for details.')
    }
  }

  // ---------------------------------------------------------------------------
  // Render nothing if there are no months to report on
  // ---------------------------------------------------------------------------
  if (ledgerMonths.length === 0) return null

  return (
    <section className={`${cardLight} p-5`}>
      {/* ---- Header row ---- */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="border-b border-stone-200 pb-2 text-lg font-bold text-emerald-800 dark:border-slate-700 dark:text-emerald-300">
          Contribution Compliance Report
        </h3>

        {/* View toggle */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
            View:
          </span>
          <button
            type="button"
            onClick={() => setView('chart')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${view === 'chart'
              ? 'bg-emerald-700 text-white shadow dark:bg-emerald-600'
              : 'bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-slate-800 dark:text-stone-300 dark:hover:bg-slate-700'
              }`}
          >
            Chart
          </button>
          <button
            type="button"
            onClick={() => setView('table')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${view === 'table'
              ? 'bg-emerald-700 text-white shadow dark:bg-emerald-600'
              : 'bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-slate-800 dark:text-stone-300 dark:hover:bg-slate-700'
              }`}
          >
            Table
          </button>
        </div>
      </div>

      {/* ---- Snapshot container (captured by html-to-image) ---- */}
      <div ref={reportRef} className="rounded-xl bg-white p-4 dark:bg-slate-900">
        {/* ============ CHART VIEW ============ */}
        {view === 'chart' ? (
          <ResponsiveContainer width="100%" height={340}>
            <BarChart
              data={monthlyChartData}
              margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#d6d3d1" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12, fill: '#57534e' }}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 12, fill: '#57534e' }}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: '0.75rem',
                  border: '1px solid #d6d3d1',
                  fontSize: '0.8rem',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '0.75rem' }} />
              <Bar dataKey="Paid" fill="#059669" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="Missed" fill="#dc2626" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        ) : null}

        {/* ============ TABLE VIEW ============ */}
        {view === 'table' ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm text-stone-800 dark:text-stone-100">
              <thead>
                <tr className={tableHead}>
                  <th className="p-3">Member</th>
                  {ledgerMonths.map((m) => (
                    <th key={m} className="p-3 text-center">
                      {m}
                    </th>
                  ))}
                  <th className="p-3 text-center">Compliance %</th>
                </tr>
              </thead>
              <tbody>
                {memberComplianceRows.map((row) => (
                  <tr key={row.name} className={tableRow}>
                    <td className="p-3 font-medium">{row.name}</td>

                    {row.monthStatuses.map((status, idx) => (
                      <td key={ledgerMonths[idx]} className="p-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${status === 'Paid'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
                            : status === 'Missed'
                              ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
                              : 'bg-stone-100 text-stone-500 dark:bg-slate-800 dark:text-stone-400'
                            }`}
                        >
                          {status}
                        </span>
                      </td>
                    ))}

                    <td className="p-3 text-center">
                      <span
                        className={`inline-block min-w-[3rem] rounded-full px-2 py-0.5 text-xs font-bold ${row.compliancePct >= 75
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
                          : row.compliancePct >= 50
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
                          }`}
                      >
                        {row.compliancePct}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      {/* ---- Export buttons ---- */}
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" onClick={handleExportCsv} className={`${btnSecondary} text-xs`}>
          <span className="mr-1.5">📄</span> Export CSV
        </button>
        <button
          type="button"
          onClick={() => void handleExportPdf()}
          className={`${btnPrimary} text-xs`}
        >
          <span className="mr-1.5">📑</span> Export PDF
        </button>
      </div>
    </section>
  )
}
