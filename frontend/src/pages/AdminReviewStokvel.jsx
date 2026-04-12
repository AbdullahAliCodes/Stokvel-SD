import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useSession } from '../context/SessionContext'
import { errorBox, pageSubtitle } from '../ui'

function parseApiError(text) {
  try {
    const j = JSON.parse(text)
    return j.error || text
  } catch {
    return text || 'Request failed'
  }
}

export default function AdminReviewStokvel() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { session } = useSession()

  const [stokvel, setStokvel] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const load = useCallback(async () => {
    if (!session?.access_token || !id) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/stokvels/${id}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const text = await res.text()
      if (!res.ok) throw new Error(parseApiError(text))
      const data = JSON.parse(text)
      setStokvel(data.stokvel ?? null)
    } catch (e) {
      setError(e.message ?? String(e))
      setStokvel(null)
    } finally {
      setLoading(false)
    }
  }, [session?.access_token, id])

  useEffect(() => {
    load()
  }, [load])

  async function handleApprove() {
    if (!session?.access_token || !id) return
    setActionLoading(true)
    setError('')
    try {
      // Use PATCH on the existing admin stokvel route (same as edit form) so we
      // don’t depend on a separate PUT handler or proxy quirks.
      const res = await fetch(`/api/admin/stokvels/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ status: 'active' }),
      })
      const text = await res.text()
      if (!res.ok) throw new Error(parseApiError(text))
      navigate('/admin/groups', { replace: true })
    } catch (e) {
      setError(e.message ?? String(e))
    } finally {
      setActionLoading(false)
    }
  }

  async function handleReject() {
    if (!session?.access_token || !id) return
    setActionLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/stokvels/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ status: 'rejected' }),
      })
      const text = await res.text()
      if (!res.ok) throw new Error(parseApiError(text))
      navigate('/admin/groups', { replace: true })
    } catch (e) {
      setError(e.message ?? String(e))
    } finally {
      setActionLoading(false)
    }
  }

  const fmt = (v) => (v == null || v === '' ? '—' : String(v))

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-wide text-cyan-400 sm:text-3xl">
            Review Stokvel Application
          </h1>
          <p className={`mt-2 ${pageSubtitle}`}>
            <Link to="/admin/groups" className="text-cyan-400/90 hover:underline">
              ← Back to group config
            </Link>
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-3">
          <button
            type="button"
            disabled={actionLoading || loading || !stokvel}
            onClick={handleReject}
            className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-red-900/30 transition hover:bg-red-500 disabled:opacity-50"
          >
            Reject
          </button>
          <button
            type="button"
            disabled={actionLoading || loading || !stokvel}
            onClick={handleApprove}
            className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-900/30 transition hover:bg-emerald-500 disabled:opacity-50"
          >
            Approve
          </button>
        </div>
      </div>

      {error ? (
        <p className={`${errorBox} mb-6`} role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : !stokvel ? (
        <p className="text-sm text-slate-500">Application not found.</p>
      ) : (
        <div className="glass max-w-2xl space-y-4 p-6">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Name</dt>
              <dd className="mt-1 text-white">{fmt(stokvel.name)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</dt>
              <dd className="mt-1 capitalize text-slate-300">{fmt(stokvel.status)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Contribution amount
              </dt>
              <dd className="mt-1 text-white">
                {stokvel.contribution_amount != null
                  ? `R ${stokvel.contribution_amount}`
                  : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Type</dt>
              <dd className="mt-1 text-slate-300">{fmt(stokvel.type)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Payout strategy
              </dt>
              <dd className="mt-1 text-slate-300">{fmt(stokvel.payout_strategy)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Cycle length
              </dt>
              <dd className="mt-1 text-slate-300">{fmt(stokvel.cycle_length)}</dd>
            </div>
            {stokvel.meeting_frequency != null && stokvel.meeting_frequency !== '' ? (
              <div className="sm:col-span-2">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Meeting frequency
                </dt>
                <dd className="mt-1 text-slate-300">{fmt(stokvel.meeting_frequency)}</dd>
              </div>
            ) : null}
            {stokvel.payout_order != null && stokvel.payout_order !== '' ? (
              <div className="sm:col-span-2">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Payout order
                </dt>
                <dd className="mt-1 text-slate-300">{fmt(stokvel.payout_order)}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      )}
    </div>
  )
}
