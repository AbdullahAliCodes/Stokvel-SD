import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useSession } from '../context/SessionContext'
import { apiUrl } from '../utils/api'
import { sectionContainer } from '../styles/tokens'
import { btnPrimary, cardLight, errorBox, pageSubtitle } from '../ui'

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
    <div className={`${sectionContainer} py-8 text-emerald-950`}>
      <h1 className="mb-2 text-2xl font-bold tracking-wide text-emerald-900">Accept Invitation</h1>
      <p className={`mb-6 ${pageSubtitle}`}>Join a stokvel from your invitation email.</p>

      {error ? (
        <p className={`${errorBox} mb-4`} role="alert">
          {error}
        </p>
      ) : null}
      {ok ? (
        <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {ok}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-stone-500">Checking invitation…</p>
      ) : invitation ? (
        <div className={`${cardLight} max-w-xl space-y-4 p-6`}>
          <p className="text-sm text-stone-700">
            Invite for <strong className="text-emerald-950">{invitation.email}</strong> to join{' '}
            <strong className="text-emerald-950">
              {invitation.stokvel?.name ?? 'this stokvel'}
            </strong>
            .
          </p>
          {!session ? (
            <p className="text-sm text-stone-600">Please sign in first, then return to this link.</p>
          ) : (
            <button type="button" onClick={acceptInvite} className={btnPrimary} disabled={accepting}>
              {accepting ? 'Accepting…' : 'Accept invitation'}
            </button>
          )}
        </div>
      ) : null}

      <div className="mt-6">
        <Link to="/dashboard" className="text-sm font-medium text-emerald-800 hover:underline">
          Back to dashboard
        </Link>
      </div>
    </div>
  )
}
