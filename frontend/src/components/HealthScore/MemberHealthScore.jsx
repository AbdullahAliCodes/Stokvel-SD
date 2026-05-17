import { useCallback, useEffect, useId, useState } from 'react'
import { useSession } from '../../context/SessionContext'
import { apiUrl } from '../../utils/api'
import {
  btnSecondary,
  cardLight,
  errorBox,
  pageSubtitle,
} from '../../ui'

function parseApiError(text) {
  try {
    const j = JSON.parse(text)
    return j.error || text || 'Request failed'
  } catch {
    return text || 'Request failed'
  }
}

function formatWhen(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' })
}

function gradeBadgeClass(grade) {
  switch (String(grade || '')) {
    case 'Excellent':
      return 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
    case 'Good':
      return 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/30 dark:bg-amber-950/30 dark:text-amber-100'
    case 'Fair':
      return 'border-orange-200 bg-orange-50 text-orange-950 dark:border-orange-900/30 dark:bg-orange-950/25 dark:text-orange-100'
    case 'At Risk':
      return 'border-red-200 bg-red-50 text-red-900 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-100'
    default:
      return 'border-stone-200 bg-stone-50 text-stone-800 dark:border-slate-600 dark:bg-slate-800 dark:text-stone-100'
  }
}

function gradeEmoji(grade) {
  switch (String(grade || '')) {
    case 'Excellent':
      return '🟢'
    case 'Good':
      return '🟡'
    case 'Fair':
      return '🟠'
    case 'At Risk':
      return '🔴'
    default:
      return '⚪'
  }
}

function gaugeStroke(grade) {
  switch (String(grade || '')) {
    case 'Excellent':
      return '#047857'
    case 'Good':
      return '#ca8a04'
    case 'Fair':
      return '#ea580c'
    case 'At Risk':
      return '#b91c1c'
    default:
      return '#57534e'
  }
}

/** Semi-circle arc gauge (0–100), SVG — no chart libraries. */
function ScoreGauge({ score, grade }) {
  const gradId = useId().replace(/:/g, '')
  const r = 54
  const arcLen = Math.PI * r
  const pct = Math.min(100, Math.max(0, Number(score)))
  const filled = (pct / 100) * arcLen
  const stroke = gaugeStroke(grade)

  return (
    <div className="relative mx-auto flex h-36 w-44 shrink-0 items-end justify-center">
      <svg
        viewBox="0 0 140 90"
        className="h-full w-full overflow-visible"
        aria-hidden
      >
        <defs>
          <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.95" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0.55" />
          </linearGradient>
        </defs>
        <path
          d="M 22 82 A 54 54 0 0 1 118 82"
          fill="none"
          stroke="#e7e5e4"
          strokeWidth="12"
          strokeLinecap="round"
          className="dark:stroke-slate-700"
        />
        <path
          d="M 22 82 A 54 54 0 0 1 118 82"
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${arcLen}`}
          style={{ transition: 'stroke-dasharray 0.45s ease' }}
        />
      </svg>
      <div className="pointer-events-none absolute inset-x-0 bottom-2 flex flex-col items-center text-center">
        <span className="text-3xl font-bold tabular-nums tracking-tight text-stone-900 dark:text-stone-50">
          {Math.round(pct)}
        </span>
        <span className={`${pageSubtitle} mt-0.5`}>ML health score</span>
      </div>
    </div>
  )
}

function FeatureImportanceList({ fi }) {
  if (!fi || typeof fi !== 'object') return null
  const entries = Object.entries(fi)
    .map(([k, v]) => ({ k, v: Number(v) }))
    .filter((x) => Number.isFinite(x.v))
    .sort((a, b) => b.v - a.v)
    .slice(0, 7)
  if (!entries.length) return null
  return (
    <div className="rounded-xl border border-stone-100 bg-stone-50/80 px-3 py-3 dark:border-slate-700 dark:bg-slate-800/60">
      <p className={`${pageSubtitle} mb-2 text-xs uppercase tracking-wide`}>
        Model feature importance (RF)
      </p>
      <ul className="space-y-1.5 text-xs text-stone-700 dark:text-stone-200">
        {entries.map(({ k, v }) => (
          <li key={k} className="flex justify-between gap-2">
            <span className="font-medium text-stone-800 dark:text-stone-100">{k}</span>
            <span className="tabular-nums text-stone-600 dark:text-stone-400">
              {(v * 100).toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function MemberHealthScore({ userId, groupId }) {
  const { session } = useSession()
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [payload, setPayload] = useState(null)

  const canFetch =
    Boolean(session?.access_token) &&
    typeof userId === 'string' &&
    userId.trim().length > 0 &&
    typeof groupId === 'string' &&
    groupId.trim().length > 0

  const load = useCallback(async () => {
    if (!canFetch) return
    setLoading(true)
    setError('')
    try {
      const uid = encodeURIComponent(userId.trim())
      const q = `?groupId=${encodeURIComponent(groupId.trim())}`
      const res = await fetch(apiUrl(`/api/members/${uid}/health-score${q}`), {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const text = await res.text()
      if (!res.ok) throw new Error(parseApiError(text))
      const data = JSON.parse(text)
      setPayload(data)
    } catch (e) {
      setPayload(null)
      setError(e.message ?? String(e))
    } finally {
      setLoading(false)
    }
  }, [canFetch, groupId, session?.access_token, userId])

  useEffect(() => {
    load()
  }, [load])

  async function handleRefresh() {
    if (!canFetch) return
    setRefreshing(true)
    setError('')
    try {
      const uid = encodeURIComponent(userId.trim())
      const q = `?groupId=${encodeURIComponent(groupId.trim())}`
      const res = await fetch(
        apiUrl(`/api/members/${uid}/health-score/refresh${q}`),
        { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` } },
      )
      const text = await res.text()
      if (!res.ok) throw new Error(parseApiError(text))
      const data = JSON.parse(text)
      setPayload(data)
    } catch (e) {
      setError(e.message ?? String(e))
    } finally {
      setRefreshing(false)
    }
  }

  if (!userId || !groupId) {
    return (
      <section className={`${cardLight} p-6`}>
        <h2 className="text-lg font-semibold text-emerald-900 dark:text-emerald-300">
          Member health score
        </h2>
        <p className={`${pageSubtitle} mt-2`}>
          Select an active group to see your score (missing{' '}
          <span className="font-medium text-stone-700 dark:text-stone-300">userId</span>{' '}
          or{' '}
          <span className="font-medium text-stone-700 dark:text-stone-300">groupId</span>
          ).
        </p>
      </section>
    )
  }

  if (!session?.access_token) {
    return (
      <section className={`${cardLight} p-6`}>
        <h2 className="text-lg font-semibold text-emerald-900 dark:text-emerald-300">
          Member health score
        </h2>
        <p className={`${pageSubtitle} mt-2`}>Sign in to load your health score.</p>
      </section>
    )
  }

  const showNoteOnly = Boolean(payload?.note)
  const confidencePct =
    payload?.confidence != null && Number.isFinite(Number(payload.confidence))
      ? `${Math.round(Number(payload.confidence))}%`
      : null

  return (
    <section className={`${cardLight} p-6`}>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-1 flex-col gap-4 sm:flex-row sm:items-center">
          {!showNoteOnly ? (
            <ScoreGauge score={payload?.score ?? 50} grade={payload?.grade ?? 'Fair'} />
          ) : (
            <div className="flex h-36 w-full max-w-xs shrink-0 flex-col justify-center rounded-xl border border-dashed border-stone-200 bg-stone-50/90 px-4 py-3 text-center dark:border-slate-600 dark:bg-slate-800/50">
              <p className="text-sm font-semibold text-stone-900 dark:text-stone-50">
                Score not modeled yet
              </p>
              <p className={`${pageSubtitle} mt-2 text-sm`}>{payload.note}</p>
            </div>
          )}
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-emerald-900 dark:text-emerald-300">
                Financial health
              </h2>
              <span
                className={`rounded-full border px-3 py-0.5 text-xs font-semibold uppercase tracking-wide ${gradeBadgeClass(payload?.grade)}`}
                title="Grade from ML classifier"
              >
                <span className="mr-1.5" aria-hidden>
                  {gradeEmoji(payload?.grade)}
                </span>
                {payload?.grade ?? '…'}
              </span>
              {payload?.model_version ? (
                <span className={`${pageSubtitle} text-[11px]`}>
                  Model: <span className="font-mono">{payload.model_version}</span>
                </span>
              ) : null}
            </div>

            {loading ? (
              <p className={`${pageSubtitle}`}>Loading your ML reliability score…</p>
            ) : null}

            {error ? (
              <p className={errorBox} role="alert">
                {error}
              </p>
            ) : null}

            {confidencePct != null && !showNoteOnly ? (
              <p className="text-sm font-medium text-stone-800 dark:text-stone-100">
                Model confidence:{' '}
                <span className="tabular-nums text-emerald-800 dark:text-emerald-200">
                  {confidencePct}
                </span>
              </p>
            ) : null}

            {payload?.lowConfidence ? (
              <p className={`${pageSubtitle}`}>
                Low confidence: based on limited months — your score will settle as you contribute
                regularly.
              </p>
            ) : null}

            {payload?.summaryLine ? (
              <p className="text-sm leading-relaxed text-stone-700 dark:text-stone-200">
                {payload.summaryLine}
              </p>
            ) : null}

            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-xl border border-stone-100 bg-stone-50/80 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/60">
                <dt className={`${pageSubtitle} text-xs uppercase tracking-wide`}>On-time rate</dt>
                <dd className="font-semibold text-stone-900 dark:text-stone-50">
                  {payload?.on_time_rate != null ? `${payload.on_time_rate}%` : '—'}
                </dd>
              </div>
              <div className="rounded-xl border border-stone-100 bg-stone-50/80 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/60">
                <dt className={`${pageSubtitle} text-xs uppercase tracking-wide`}>
                  Missed payments (unresolved)
                </dt>
                <dd className="font-semibold text-stone-900 dark:text-stone-50">
                  {payload?.missed_payments != null ? payload.missed_payments : '—'}
                </dd>
              </div>
              <div className="rounded-xl border border-stone-100 bg-stone-50/80 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/60">
                <dt className={`${pageSubtitle} text-xs uppercase tracking-wide`}>
                  On-time streak
                </dt>
                <dd className="font-semibold text-stone-900 dark:text-stone-50">
                  {payload?.streak_months != null
                    ? `${payload.streak_months} month${payload.streak_months === 1 ? '' : 's'}`
                    : '—'}
                </dd>
              </div>
              <div className="rounded-xl border border-stone-100 bg-stone-50/80 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/60">
                <dt className={`${pageSubtitle} text-xs uppercase tracking-wide`}>Engagement</dt>
                <dd className="font-semibold text-stone-900 dark:text-stone-50">
                  {payload?.engagement_score != null ? `${payload.engagement_score}%` : '—'}
                </dd>
              </div>
              <div className="rounded-xl border border-stone-100 bg-stone-50/80 px-3 py-2 sm:col-span-2 dark:border-slate-700 dark:bg-slate-800/60">
                <dt className={`${pageSubtitle} text-xs uppercase tracking-wide`}>
                  Avg. days late (when late)
                </dt>
                <dd className="font-semibold text-stone-900 dark:text-stone-50">
                  {payload?.avg_days_late != null ? `${payload.avg_days_late} days` : '—'}
                </dd>
              </div>
            </dl>

            <FeatureImportanceList fi={payload?.feature_importances} />

            <p className={`${pageSubtitle} text-xs`}>
              Last calculated:{' '}
              <span className="font-medium text-stone-600 dark:text-stone-300">
                {formatWhen(payload?.last_calculated_at)}
              </span>
            </p>
          </div>
        </div>

        <div className="shrink-0">
          <button
            type="button"
            className={btnSecondary}
            disabled={loading || refreshing}
            onClick={handleRefresh}
          >
            {refreshing ? 'Refreshing…' : 'Refresh score'}
          </button>
        </div>
      </div>
    </section>
  )
}

// TO USE: On the member dashboard page, add:
// import MemberHealthScore from '../components/HealthScore/MemberHealthScore';
// <MemberHealthScore userId={currentUser.id} groupId={activeGroup.id} />
