import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSession } from '../context/SessionContext'

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

  return (
    <span className="border border-black px-2 py-0.5 text-xs font-medium uppercase">
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
      <h1 className="mb-2 text-2xl font-bold tracking-widest">MY STOKVELS</h1>
      <p className="mb-8 text-sm text-gray-600">
        Select a group to open its dashboard.
      </p>

      {error ? (
        <p className="mb-4 border border-black bg-gray-100 p-3 text-sm text-black">
          {error}
        </p>
      ) : null}

      {memberships === null ? (
        <p className="text-sm text-gray-600">Loading…</p>
      ) : memberships.length === 0 ? (
        <p className="border border-dashed border-gray-400 p-8 text-center text-gray-600">
          You are not part of any stokvel yet.
        </p>
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
                  className="block border border-black bg-white p-4 transition-colors hover:bg-gray-50"
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <h2 className="text-lg font-semibold leading-tight">
                      {stokvel?.name ?? 'Unnamed group'}
                    </h2>
                    <StatusBadge status={stokvel?.status} />
                  </div>
                  <p className="text-sm text-gray-700">
                    Role:{' '}
                    <span className="font-medium text-black">
                      {formatRole(m.group_role)}
                    </span>
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
