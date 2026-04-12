import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useSession } from '../context/SessionContext'
import { apiUrl } from '../utils/api'
import {
  pageTitle,
  pageSubtitle,
  inputDark,
  labelDark,
  btnPrimary,
  btnSecondary,
  errorBox,
} from '../ui'

function parseApiError(text) {
  try {
    const j = JSON.parse(text)
    return j.error || text
  } catch {
    return text || 'Request failed'
  }
}

export default function AdminEditStokvel() {
  const { id } = useParams()
  const { session } = useSession()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [type, setType] = useState('Rotating')
  const [status, setStatus] = useState('active')
  const [contributionAmount, setContributionAmount] = useState('')
  const [payoutStrategy, setPayoutStrategy] = useState('Auto-Rotate')
  const [cycleLength, setCycleLength] = useState('12')

  const [memberUsername, setMemberUsername] = useState('')
  const [memberInviteLoading, setMemberInviteLoading] = useState(false)
  const [memberInviteMsg, setMemberInviteMsg] = useState('')
  const [memberInviteErr, setMemberInviteErr] = useState('')

  useEffect(() => {
    if (!session?.access_token || !id) return

    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')
      try {
        const res = await fetch(apiUrl(`/api/admin/stokvels/${id}`), {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        const text = await res.text()
        if (!res.ok) throw new Error(parseApiError(text))
        const data = JSON.parse(text)
        const s = data.stokvel
        if (!cancelled && s) {
          setName(s.name ?? '')
          setType(s.type ?? 'Rotating')
          setStatus(s.status ?? 'active')
          setContributionAmount(
            s.contribution_amount != null ? String(s.contribution_amount) : '',
          )
          setPayoutStrategy(s.payout_strategy ?? 'Auto-Rotate')
          setCycleLength(s.cycle_length != null ? String(s.cycle_length) : '12')
        }
      } catch (e) {
        if (!cancelled) setError(e.message ?? String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [session?.access_token, id])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!session?.access_token || !id) return
    setSaving(true)
    setError('')
    try {
      const amount = Number(contributionAmount)
      const cycle = Number(cycleLength)
      const res = await fetch(apiUrl(`/api/admin/stokvels/${id}`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          type,
          status,
          contributionAmount: amount,
          payoutStrategy,
          cycleLength: cycle,
        }),
      })
      const text = await res.text()
      if (!res.ok) throw new Error(parseApiError(text))
      navigate('/admin/groups')
    } catch (err) {
      setError(err.message ?? String(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleAddMember(e) {
    e.preventDefault()
    if (!session?.access_token || !id) return
    setMemberInviteErr('')
    setMemberInviteMsg('')
    setMemberInviteLoading(true)
    try {
      const res = await fetch(apiUrl(`/api/admin/stokvels/${id}/members`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ username: memberUsername.trim() }),
      })
      const text = await res.text()
      if (!res.ok) throw new Error(parseApiError(text))
      setMemberInviteMsg(`Member added: ${memberUsername.trim()}`)
      setMemberUsername('')
    } catch (err) {
      setMemberInviteErr(err.message ?? String(err))
    } finally {
      setMemberInviteLoading(false)
    }
  }

  return (
    <div>
      <Link
        to="/admin/groups"
        className="mb-4 inline-flex items-center gap-1 text-sm text-cyan-400 hover:text-cyan-300"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
        Back to groups
      </Link>
      <h1 className={pageTitle}>Edit stokvel</h1>
      <p className={`${pageSubtitle} mb-6`}>Update group configuration.</p>

      {error ? (
        <p className={`${errorBox} mb-4`} role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <>
        <form onSubmit={handleSubmit} className="max-w-lg space-y-4">
          <label className={labelDark}>
            Group name
            <input
              type="text"
              required
              value={name}
              onChange={(ev) => setName(ev.target.value)}
              className={inputDark}
            />
          </label>
          <label className={labelDark}>
            Type
            <select value={type} onChange={(ev) => setType(ev.target.value)} className={inputDark}>
              <option value="Rotating">Rotating</option>
              <option value="Fixed">Fixed</option>
            </select>
          </label>
          <label className={labelDark}>
            Status
            <select
              value={status}
              onChange={(ev) => setStatus(ev.target.value)}
              className={inputDark}
            >
              <option value="pending">Pending</option>
              <option value="active">Active</option>
              <option value="rejected">Rejected</option>
            </select>
          </label>
          <label className={labelDark}>
            Contribution (ZAR)
            <input
              type="number"
              min="0"
              step="0.01"
              required
              value={contributionAmount}
              onChange={(ev) => setContributionAmount(ev.target.value)}
              className={inputDark}
            />
          </label>
          <label className={labelDark}>
            Payout schedule
            <select
              value={payoutStrategy}
              onChange={(ev) => setPayoutStrategy(ev.target.value)}
              className={inputDark}
            >
              <option value="Manual">Manual</option>
              <option value="Auto-Rotate">Auto-Rotate</option>
            </select>
          </label>
          <label className={labelDark}>
            Cycle length
            <input
              type="number"
              min="1"
              step="1"
              required
              value={cycleLength}
              onChange={(ev) => setCycleLength(ev.target.value)}
              className={inputDark}
            />
          </label>
          <div className="flex flex-wrap gap-3 pt-2">
            <button type="submit" disabled={saving} className={btnPrimary}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <Link to="/admin/groups" className={`${btnSecondary} inline-flex items-center px-4 py-2.5`}>
              Cancel
            </Link>
          </div>
        </form>

        <div className="mt-10 max-w-lg border-t border-white/10 pt-8">
          <h2 className="mb-1 text-lg font-semibold text-white">Add member by username</h2>
          <p className={`mb-4 text-sm ${pageSubtitle}`}>
            Looks up <code className="text-xs text-slate-300">profiles.username</code>. They will see
            this stokvel on their My stokvels page.
          </p>
          {memberInviteErr ? (
            <p className={`${errorBox} mb-3`} role="alert">
              {memberInviteErr}
            </p>
          ) : null}
          {memberInviteMsg ? (
            <p
              className="mb-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200"
              role="status"
            >
              {memberInviteMsg}
            </p>
          ) : null}
          <form onSubmit={handleAddMember} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className={`${labelDark} min-w-0 flex-1`}>
              Username
              <input
                type="text"
                value={memberUsername}
                onChange={(ev) => setMemberUsername(ev.target.value)}
                className={inputDark}
                placeholder="e.g. sipho_k"
                autoComplete="off"
              />
            </label>
            <button
              type="submit"
              disabled={memberInviteLoading || !memberUsername.trim()}
              className={btnSecondary}
            >
              {memberInviteLoading ? 'Adding…' : 'Add member'}
            </button>
          </form>
        </div>
        </>
      )}
    </div>
  )
}
