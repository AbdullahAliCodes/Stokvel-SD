import { useMemo, useRef, useState } from 'react'
import { BarChart3 } from 'lucide-react'
import { useAlert } from '../context/ModalContext'
import { EmptyState } from './ui'
import TableScrollArea from './ui/TableScrollArea'
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
import {
  aggregateMonthComplianceCounts,
  computeWeightedCompliancePct,
  paymentWindowFromStokvel,
  resolveMemberMonthStatus,
} from '../utils/complianceStatus.js'

const CHART_COLORS = {
  Paid: '#10B981',
  Late: '#F59E0B',
  Missed: '#EF4444',
  Unpaid: '#4B5563',
}

const STATUS_BADGE_CLASS = {
  Paid: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  Late: 'bg-amber-500/20 text-amber-600 border border-amber-500/30 dark:bg-amber-900/30 dark:text-amber-300',
  Missed: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
  Unpaid: 'bg-stone-100 text-stone-500 dark:bg-slate-800 dark:text-stone-400',
}

function memberDisplay(p) {
  const first = p?.first_name?.trim()
  const last = p?.last_name?.trim()
  if (first || last) return [first, last].filter(Boolean).join(' ')
  if (p?.full_name) return p.full_name
  if (p?.email) return p.email.split('@')[0]
  return 'Member'
}

function compliancePctBadgeClass(pct) {
  if (pct >= 75) {
    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
  }
  if (pct >= 50) {
    return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
  }
  return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
}

export default function ComplianceReportWidget({
  members = [],
  contributions = [],
  missedPayments = [],
  ledgerMonths = [],
  refMonth = null,
  paymentWindow = null,
}) {
  const showAlert = useAlert()
  const [view, setView] = useState('chart')
  const reportRef = useRef(null)

  const windowConfig = useMemo(
    () => paymentWindowFromStokvel(paymentWindow),
    [paymentWindow],
  )

  const sortedMembers = useMemo(
    () =>
      [...members].sort((a, b) =>
        memberDisplay(a.profiles).localeCompare(memberDisplay(b.profiles), 'en'),
      ),
    [members],
  )

  const monthlyChartData = useMemo(() => {
    return ledgerMonths.map((month) => {
      const counts = aggregateMonthComplianceCounts({
        members,
        contributions,
        missedPayments,
        month,
        refMonth,
        paymentWindow,
      })
      return { month, ...counts }
    })
  }, [ledgerMonths, members, contributions, missedPayments, refMonth, paymentWindow])

  const memberComplianceRows = useMemo(() => {
    if (ledgerMonths.length === 0) return []

    return sortedMembers.map((m) => {
      const name = memberDisplay(m.profiles)
      const monthStatuses = ledgerMonths.map((month) =>
        resolveMemberMonthStatus({
          contributions,
          missedPayments,
          userId: m.user_id,
          month,
          refMonth,
          windowConfig,
        }),
      )
      const compliancePct = computeWeightedCompliancePct(monthStatuses)
      return { name, monthStatuses, compliancePct }
    })
  }, [
    sortedMembers,
    ledgerMonths,
    contributions,
    missedPayments,
    refMonth,
    windowConfig,
  ])

  function handleExportCsv() {
    const headers = ['Member', ...ledgerMonths, 'Compliance %']
    const rows = memberComplianceRows.map((row) => [
      row.name,
      ...row.monthStatuses,
      `${row.compliancePct}%`,
    ])

    const csvContent = [headers, ...rows]
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
      .join('\n')

    const blob = new Blob([`\ufeff${csvContent}`], {
      type: 'text/csv;charset=utf-8;',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'compliance_report.csv'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  async function handleExportPdf() {
    if (!reportRef.current) return

    try {
      const dataUrl = await toPng(reportRef.current, {
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        filter: (node) => {
          if (node?.classList?.contains?.('recharts-tooltip-wrapper')) return false
          return true
        },
      })

      const img = new Image()
      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
        img.src = dataUrl
      })

      const imgW = img.naturalWidth
      const imgH = img.naturalHeight

      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      const pageWidth = pdf.internal.pageSize.getWidth()

      pdf.setFontSize(16)
      pdf.setTextColor(5, 150, 105)
      pdf.text('Contribution Compliance Report', 14, 16)
      pdf.setFontSize(9)
      pdf.setTextColor(80, 80, 80)
      pdf.text(
        'Statuses: Paid (on time), Late (after window), Missed, Unpaid. Compliance % weights Late at 50%.',
        14,
        22,
      )
      pdf.setTextColor(0, 0, 0)

      const usableWidth = pageWidth - 28
      const scaledHeight = (imgH * usableWidth) / imgW
      pdf.addImage(dataUrl, 'PNG', 14, 28, usableWidth, scaledHeight)

      pdf.save('compliance_report.pdf')
    } catch (err) {
      console.error('PDF generation failed:', err)
      await showAlert({
        type: 'error',
        title: 'PDF export failed',
        message: 'Failed to generate PDF. Check the console for details.',
      })
    }
  }

  if (ledgerMonths.length === 0) {
    return (
      <section className={`${cardLight} p-5`}>
        <EmptyState
          icon={BarChart3}
          title="No compliance data yet"
          description="Contribution cycles will appear here once members start paying in or missed payments are recorded on the Payments page."
        />
      </section>
    )
  }

  return (
    <section className={`${cardLight} p-5`}>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="border-b border-stone-200 pb-2 text-lg font-bold text-emerald-800 dark:border-slate-700 dark:text-emerald-300">
            Contribution Compliance Report
          </h3>
          <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
            On-time vs late uses your group payment window (SAST). Compliance %: Paid
            = 100%, Late = 50%.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
            View:
          </span>
          <button
            type="button"
            onClick={() => setView('chart')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              view === 'chart'
                ? 'bg-emerald-700 text-white shadow dark:bg-emerald-600'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-slate-800 dark:text-stone-300 dark:hover:bg-slate-700'
            }`}
          >
            Chart
          </button>
          <button
            type="button"
            onClick={() => setView('table')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              view === 'table'
                ? 'bg-emerald-700 text-white shadow dark:bg-emerald-600'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-slate-800 dark:text-stone-300 dark:hover:bg-slate-700'
            }`}
          >
            Table
          </button>
        </div>
      </div>

      <div ref={reportRef} className="rounded-xl bg-white p-4 dark:bg-slate-900">
        {view === 'chart' ? (
          <ResponsiveContainer width="100%" height={360}>
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
              <Bar
                dataKey="Paid"
                stackId="a"
                fill={CHART_COLORS.Paid}
                isAnimationActive={false}
              />
              <Bar
                dataKey="Late"
                stackId="a"
                fill={CHART_COLORS.Late}
                isAnimationActive={false}
              />
              <Bar
                dataKey="Missed"
                stackId="a"
                fill={CHART_COLORS.Missed}
                isAnimationActive={false}
              />
              <Bar
                dataKey="Unpaid"
                stackId="a"
                fill={CHART_COLORS.Unpaid}
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : null}

        {view === 'table' ? (
          <TableScrollArea hint="Swipe sideways to see all months">
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
                          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${
                            STATUS_BADGE_CLASS[status] ?? STATUS_BADGE_CLASS.Unpaid
                          }`}
                        >
                          {status}
                        </span>
                      </td>
                    ))}

                    <td className="p-3 text-center">
                      <span
                        className={`inline-block min-w-12 rounded-full px-2 py-0.5 text-xs font-bold ${compliancePctBadgeClass(row.compliancePct)}`}
                      >
                        {row.compliancePct}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScrollArea>
        ) : null}
      </div>

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
