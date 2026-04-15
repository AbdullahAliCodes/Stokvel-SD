import { useCallback, useEffect, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { apiUrl } from '../utils/api'

const CHART_MONTHS = [1, 2, 3, 6, 9, 12]

function buildProjectionPoints(contribution, primeRatePercent) {
  const pmt = Number(contribution) || 0
  const annual = Number(primeRatePercent)
  if (!Number.isFinite(annual)) return []

  const r = annual / 100 / 12
  return CHART_MONTHS.map((month) => {
    const fv =
      r === 0 ? pmt * month : pmt * ((Math.pow(1 + r, month) - 1) / r)
    return { month: `M${month}`, value: parseFloat(fv.toFixed(2)) }
  })
}

export default function MarketRatesWidget({ memberMonthlyContribution = 0 }) {
  const [rates, setRates] = useState(null)
  const [projection, setProjection] = useState([])
  const [error, setError] = useState(null)

  const contribution = Number(memberMonthlyContribution) || 0

  const loadRates = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch(apiUrl('/api/market-rates'))
      const text = await res.text()
      const data = text ? JSON.parse(text) : {}
      if (!res.ok) throw new Error(data?.error || text || `HTTP ${res.status}`)
      setRates(data)
    } catch (e) {
      setRates(null)
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    void loadRates()
  }, [loadRates])

  useEffect(() => {
    if (rates?.prime_rate == null || !Number.isFinite(Number(rates.prime_rate))) {
      setProjection([])
      return
    }
    setProjection(buildProjectionPoints(contribution, rates.prime_rate))
  }, [rates, contribution])

  if (error) {
    return (
      <div className="glass p-6">
        <p className="text-sm font-bold text-white">SA reference rates</p>
        <p className="mt-2 text-xs text-red-300">{error}</p>
      </div>
    )
  }

  if (!rates) {
    return (
      <div className="glass p-6">
        <p className="text-sm text-slate-400">Loading rates…</p>
      </div>
    )
  }

  return (
    <div className="glass flex flex-col gap-4 p-6">
      <p className="text-sm font-bold text-white">SA reference rates</p>
      <div className="flex flex-wrap gap-3 text-xs text-slate-200">
        <span className="rounded border border-cyan-500/30 bg-cyan-500/10 px-2 py-1">
          Repo: <strong className="text-cyan-100">{rates.repo_rate}%</strong>
        </span>
        <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1">
          Prime: <strong className="text-emerald-100">{rates.prime_rate}%</strong>
        </span>
        <span className="text-slate-500">
          Updated{' '}
          {rates.last_updated
            ? new Date(rates.last_updated).toLocaleString('en-ZA', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })
            : '—'}
        </span>
      </div>
      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Estimated savings growth
        </h4>
        {contribution <= 0 ? (
          <p className="text-xs text-slate-500">
            Set a monthly contribution on this group to see a projection curve.
          </p>
        ) : (
          <div className="h-[220px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={projection} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <YAxis
                  tick={{ fill: '#94a3b8', fontSize: 10 }}
                  tickFormatter={(v) =>
                    `R${Number(v).toLocaleString('en-ZA', { maximumFractionDigits: 0 })}`
                  }
                />
                <Tooltip
                  contentStyle={{
                    background: '#0f172a',
                    border: '1px solid rgba(148,163,184,0.3)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(v) => [
                    `R${Number(v).toLocaleString('en-ZA', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}`,
                    'Balance',
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#22d3ee"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#22d3ee' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}