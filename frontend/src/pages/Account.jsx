import { useEffect, useState } from 'react'
import { useSession } from '../context/SessionContext'
import { apiUrl } from '../utils/api'
import {
  pageTitle,
  pageSubtitle,
  inputLight,
  labelLight,
  btnPrimary,
  errorBox,
} from '../ui'
import SkeletonPage from '../components/ui/SkeletonPage'

function parseApiError(text) {
  try {
    const j = JSON.parse(text)
    return j.error || text
  } catch {
    return text || 'Request failed'
  }
}

export default function Account() {
  const { session } = useSession()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')

  useEffect(() => {
    if (!session?.access_token) return

    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')
      try {
        const res = await fetch(apiUrl('/api/profile/me'), {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        const text = await res.text()
        if (!res.ok) throw new Error(parseApiError(text))
        const data = JSON.parse(text)
        const p = data.profile ?? {}
        if (!cancelled) {
          setFirstName(p.firstName ?? '')
          setLastName(p.lastName ?? '')
          setUsername(p.username ?? '')
          setEmail(p.email ?? '')
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
  }, [session?.access_token])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!session?.access_token) return
    setSaving(true)
    setError('')
    setOk('')
    try {
      const res = await fetch(apiUrl('/api/profile/me'), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          firstName,
          lastName,
          username: username.trim() === '' ? null : username,
          email,
        }),
      })
      const text = await res.text()
      if (!res.ok) throw new Error(parseApiError(text))
      const data = JSON.parse(text)
      const p = data.profile
      if (p) {
        setFirstName(p.firstName ?? '')
        setLastName(p.lastName ?? '')
        setUsername(p.username ?? '')
        setEmail(p.email ?? '')
      }
      setOk('Profile updated.')
    } catch (err) {
      setError(err.message ?? String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <h1 className={pageTitle}>Account</h1>
      <p className={`${pageSubtitle} mb-6`}>
        Edit your display name and username (saved on the server).
      </p>

      {error ? (
        <p className={`${errorBox} mb-4`} role="alert">
          {error}
        </p>
      ) : null}
      {ok ? (
        <p
          className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          role="status"
        >
          {ok}
        </p>
      ) : null}

      {loading ? (
        <SkeletonPage variant="form" />
      ) : (
        <form onSubmit={handleSubmit} className="max-w-lg space-y-4">
          <label className={labelLight}>
            First name
            <input
              type="text"
              value={firstName}
              onChange={(ev) => setFirstName(ev.target.value)}
              className={inputLight}
              autoComplete="given-name"
            />
          </label>
          <label className={labelLight}>
            Last name
            <input
              type="text"
              value={lastName}
              onChange={(ev) => setLastName(ev.target.value)}
              className={inputLight}
              autoComplete="family-name"
            />
          </label>
          <label className={labelLight}>
            Email
            <input
              type="email"
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              className={inputLight}
              autoComplete="email"
              required
            />
            <span className="text-xs text-stone-500">Required for invitation and status emails.</span>
          </label>
          <label className={labelLight}>
            Username
            <input
              type="text"
              value={username}
              onChange={(ev) => setUsername(ev.target.value)}
              className={inputLight}
              autoComplete="username"
              placeholder="3–30 letters, numbers, underscore"
            />
            <span className="text-xs text-stone-500">Leave empty to clear username (if allowed).</span>
          </label>
          <button type="submit" disabled={saving} className={btnPrimary}>
            {saving ? 'Saving…' : 'Save profile'}
          </button>
        </form>
      )}
    </div>
  )
}
