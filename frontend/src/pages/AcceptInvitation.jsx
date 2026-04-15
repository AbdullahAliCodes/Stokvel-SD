import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useSession } from '../context/SessionContext'
import { apiUrl } from '../utils/api'
import { btnPrimary, errorBox, pageSubtitle } from '../ui'

function parseApiError(text) {
  try {
    const j = JSON.parse(text)
    return j.error || text
  } catch {
    return text || 'Request failed'
  }
}

export default function AcceptInvitation() {
  const { session } = useSession()
  const [params] = useSearchParams()
  const token = useMemo(() => (params.get('token') || '').trim(), [params])

  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [invitation, setInvitation] = useState(null)

  useEffect(() => {
    async function load() {
      if (!token) {
        setLoading(false)
        setError('Missing invitation token.')
        return
      }
      setLoading(true)
      setError('')
      try {
        const res = await fetch(apiUrl(`/api/invitations/${encodeURIComponent(token)}`))
        const text = await res.text()
        if (!res.ok) throw new Error(parseApiError(text))
        const data = JSON.parse(text)
        setInvitation(data.invitation ?? null)
      } catch (e) {
        setError(e.message ?? String(e))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [token])

  async function acceptInvite() {
    if (!session?.access_token || !token) return
    setAccepting(true)
    setError('')
    setOk('')
    try {
      const res = await fetch(apiUrl('/api/invitations/accept'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ token }),
      })
      const text = await res.text()
      if (!res.ok) throw new Error(parseApiError(text))
      setOk('Invitation accepted. The group now appears in your dashboard.')
    } catch (e) {
      setError(e.message ?? String(e))
    } finally {
      setAccepting(false)
    }
  }

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold tracking-wide text-cyan-400">Accept Invitation</h1>
      <p className={`mb-6 ${pageSubtitle}`}>Join a stokvel from your invitation email.</p>

      {error ? (
        <p className={`${errorBox} mb-4`} role="alert">
          {error}
        </p>
      ) : null}
      {ok ? (
        <p className="mb-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {ok}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-400">Checking invitation…</p>
      ) : invitation ? (
        <div className="glass max-w-xl space-y-4 p-6">
          <p className="text-sm text-slate-300">
            Invite for <strong>{invitation.email}</strong> to join{' '}
            <strong>{invitation.stokvel?.name ?? 'this stokvel'}</strong>.
          </p>
          {!session ? (
            <p className="text-sm text-slate-300">Please sign in first, then return to this link.</p>
          ) : (
            <button type="button" onClick={acceptInvite} className={btnPrimary} disabled={accepting}>
              {accepting ? 'Accepting…' : 'Accept invitation'}
            </button>
          )}
        </div>
      ) : null}

      <div className="mt-6">
        <Link to="/dashboard" className="text-sm text-cyan-400 hover:underline">
          Back to dashboard
        </Link>
      </div>
    </div>
  )
}
