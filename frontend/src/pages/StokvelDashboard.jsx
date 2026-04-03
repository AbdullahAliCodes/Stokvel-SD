import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LayoutDashboard } from 'lucide-react'
import { useSession } from '../context/SessionContext'
import { errorBox, pageSubtitle, pageTitle } from '../ui'

function formatRole(role) {
  if (!role) return 'Member'
  return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase()
}

function StatusBadge({ status }) {
  const label =
    status === 'active'
      ? 'Active'
      : status === 'pending'
        ? 'Pending'
        : status
          ? String(status).charAt(0).toUpperCase() + String(status).slice(1)
          : 'Pending'

  const tone =
    status === 'active'
      ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
      : 'border-cyan-500/40 bg-cyan-500/10 text-cyan-200'

  return (
    <span className={`rounded border px-2 py-0.5 text-xs font-bold uppercase ${tone}`}>
      {label}
    </span>
  )
}

export default function StokvelDashboard() {
  const { session } = useSession()
  const [memberships, setMemberships] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!session) return

    let cancelled = false

    async function load() {
      setError(null)
      try {
        const res = await fetch('/api/my-stokvels', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        const text = await res.text()
        if (!res.ok) {
          throw new Error(text || `HTTP ${res.status}`)
        }
        const json = JSON.parse(text)
        if (!cancelled) {
          setMemberships(json.memberships ?? [])
        }
      } catch (e) {
        if (!cancelled) {
          setError(e.message ?? String(e))
          setMemberships([])
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [session])

  return (
    <div>
      <h1 className="mb-1 flex items-center gap-2 text-2xl font-bold tracking-widest text-cyan-400 uppercase sm:text-3xl">
        <LayoutDashboard className="h-8 w-8 text-blue-400" aria-hidden />
        My stokvels
      </h1>
      <p className={`mb-8 ${pageSubtitle}`}>Select a group to open its dashboard.</p>

      {error ? <p className={`mb-4 ${errorBox}`}>{error}</p> : null}

      {memberships === null ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : memberships.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/20 bg-white/[0.02] p-12 text-center text-slate-400">
          You are not part of any stokvel yet.
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {memberships.map((m) => {
            const stokvel = m.stokvels
            const sid = stokvel?.id
            if (!sid) return null

            return (
              <li key={sid}>
                <Link
                  to={`/stokvels/${sid}`}
                  className="glass card-blue block p-5 transition hover:border-white/20 hover:bg-white/[0.07]"
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <h2 className="text-lg font-semibold leading-tight text-white">
                      {stokvel?.name ?? 'Unnamed group'}
                    </h2>
                    <StatusBadge status={stokvel?.status} />
                  </div>
                  <p className="text-sm text-slate-400">
                    Role:{' '}
                    <span className="font-medium text-emerald-400">{formatRole(m.group_role)}</span>
                  </p>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
