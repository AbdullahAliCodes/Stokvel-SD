import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { apiUrl } from '../utils/api'
import { cardLight, errorBox, tableHead, tableRow, tableWrap } from '../ui'

function formatZAR(n) {
  const num = Number(n)
  if (Number.isNaN(num)) return 'R 0'
  return `R ${Math.round(num).toLocaleString('en-ZA')}`
}

function memberDisplay(p) {
  const first = p?.first_name?.trim()
  const last = p?.last_name?.trim()
  if (first || last) return [first, last].filter(Boolean).join(' ')
  return 'Member'
}

function formatScheduleDate(iso) {
  if (!iso) return '—'
  const t = new Date(`${String(iso).slice(0, 10)}T12:00:00`)
  if (Number.isNaN(t.getTime())) return String(iso)
  return t.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

function parseApiError(text) {
  try {
    const json = JSON.parse(text)
    return json.error || text || 'Request failed'
  } catch {
    return text || 'Request failed'
  }
}

function statusLabel(status) {
  return String(status || '').toLowerCase() === 'completed' ? 'Completed' : 'Pending'
}

function PayoutTable({ rows, emptyMessage, showStatus }) {
  if (!rows?.length) {
    return (
      <p className="py-4 text-center text-sm italic text-stone-500 dark:text-stone-400">{emptyMessage}</p>
    )
  }

  return (
    <div className={tableWrap}>
      <table className="w-full min-w-[300px] text-left text-sm text-stone-800 dark:text-stone-100">
        <thead>
          <tr className={tableHead}>
            <th className="p-3">Date</th>
            <th className="p-3">Cycle</th>
            <th className="p-3">Recipient</th>
            <th className="p-3">Projected amount</th>
            {showStatus ? <th className="p-3">Status</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id ?? `${row.user_id}-${row.target_month}`}
              className={`${tableRow} ${row.is_mine ? 'bg-emerald-50/60 dark:bg-emerald-950/25' : ''}`}
            >
              <td className="p-3 whitespace-nowrap">{formatScheduleDate(row.scheduled_payout_date)}</td>
              <td className="p-3 whitespace-nowrap">{row.target_month ?? '—'}</td>
              <td className="p-3">
                {memberDisplay(row.profile)}
                {row.is_mine ? (
                  <span className="ml-2 text-xs font-medium text-emerald-800 dark:text-emerald-300">(you)</span>
                ) : null}
              </td>
              <td className="p-3">{formatZAR(row.expected_amount)}</td>
              {showStatus ? (
                <td className="p-3 capitalize">{statusLabel(row.status)}</td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function PayoutReportPanel({ stokvelId, accessToken, enabled = true }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [report, setReport] = useState(null)

  const load = useCallback(async () => {
    if (!enabled || !stokvelId || !accessToken) {
      setLoading(false)
      setReport(null)
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch(apiUrl(`/api/stokvels/${stokvelId}/payout-report`), {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const text = await res.text()
      if (!res.ok) throw new Error(parseApiError(text))
      const json = text ? JSON.parse(text) : {}
      setReport(json.report ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setReport(null)
    } finally {
      setLoading(false)
    }
  }, [accessToken, enabled, stokvelId])

  useEffect(() => {
    void load()
  }, [load])

  const mySummary = report?.my_summary
  const nextExpected = mySummary?.next_expected

  return (
    <section id="payout-report" className={`${cardLight} mb-8 scroll-mt-6 p-5`}>
      <h2 className="mb-4 text-lg font-bold text-emerald-800 dark:text-emerald-300">
        Payout history &amp; projections
      </h2>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" aria-label="Loading payout report" />
        </div>
      ) : null}

      {error ? <p className={`mb-4 text-sm ${errorBox}`}>{error}</p> : null}

      {!loading && !error && report ? (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-stone-200 bg-stone-50/80 p-4 dark:border-slate-600 dark:bg-slate-800/50">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
                Your next expected payout
              </p>
              <p className="mt-2 text-xl font-bold text-emerald-800 dark:text-emerald-200">
                {nextExpected ? formatZAR(nextExpected.expected_amount) : '—'}
              </p>
              <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                {nextExpected
                  ? `${formatScheduleDate(nextExpected.scheduled_payout_date)} · cycle ${nextExpected.target_month ?? ''}`
                  : 'No upcoming slot assigned to you yet.'}
              </p>
            </div>
            <div className="rounded-lg border border-stone-200 bg-stone-50/80 p-4 dark:border-slate-600 dark:bg-slate-800/50">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
                Total received (YTD)
              </p>
              <p className="mt-2 text-xl font-bold text-emerald-800 dark:text-emerald-200">
                {formatZAR(mySummary?.total_received_ytd ?? 0)}
              </p>
              <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                Completed payouts to you this calendar year
              </p>
            </div>
          </div>

          <div className="space-y-8">
            <div>
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-stone-700 dark:text-stone-200">
                Payout history
              </h3>
              <PayoutTable
                rows={report.history}
                emptyMessage="No completed or past-due payouts yet."
                showStatus
              />
            </div>

            <div>
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-stone-700 dark:text-stone-200">
                Upcoming projections
              </h3>
              <PayoutTable
                rows={report.upcoming_projections}
                emptyMessage="No upcoming payouts scheduled."
                showStatus={false}
              />
            </div>
          </div>
        </>
      ) : null}
    </section>
  )
}
