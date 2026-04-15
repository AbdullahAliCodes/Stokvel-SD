import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Pencil } from 'lucide-react'
import { useSession } from '../context/SessionContext'
import { apiUrl } from '../utils/api'
import { pageTitle, pageSubtitle, tableWrap, tableHead, tableRow, errorBox, btnSecondary } from '../ui'
import { readViewCache, writeViewCache } from '../utils/viewCache'

function parseApiError(text) {
  try {
    const j = JSON.parse(text)
    return j.error || text
  } catch {
    return text || 'Request failed'
  }
}

function statusMatches(g, target) {
  return String(g?.status ?? '').toLowerCase() === target
}

function GroupsTable({ title, groups, action }) {
  return (
    <div className="mb-10">
      <h2 className="mb-3 text-lg font-bold text-stone-900">{title}</h2>
      <div className={tableWrap}>
        <table className="w-full min-w-[640px] text-left text-sm text-stone-800">
          <thead>
            <tr className={tableHead}>
              <th className="p-3">Name</th>
              <th className="p-3">Type</th>
              <th className="p-3">Status</th>
              <th className="p-3">Contribution</th>
              <th className="p-3">Cycle</th>
              <th className="p-3 w-36">Actions</th>
            </tr>
          </thead>
          <tbody>
            {groups.length === 0 ? (
              <tr className={tableRow}>
                <td colSpan={6} className="p-6 text-center text-stone-500 italic">
                  No groups in this list.
                </td>
              </tr>
            ) : (
              groups.map((s) => (
                <tr key={s.id} className={tableRow}>
                  <td className="p-3 font-medium text-stone-900">
                    <Link
                      to={`/stokvels/${s.id}`}
                      className="text-emerald-800 underline-offset-2 hover:text-emerald-900 hover:underline"
                    >
                      {s.name}
                    </Link>
                  </td>
                  <td className="p-3 text-stone-600">{s.type ?? '—'}</td>
                  <td className="p-3 capitalize text-stone-600">{s.status ?? '—'}</td>
                  <td className="p-3 text-stone-600">
                    {s.contribution_amount != null ? `R ${s.contribution_amount}` : '—'}
                  </td>
                  <td className="p-3 text-stone-600">{s.cycle_length ?? '—'}</td>
                  <td className="p-3">{action(s)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function AdminGroups() {
  const { session } = useSession()
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!session?.access_token) return

    let cancelled = false

    async function load() {
      setError('')
      const cached = readViewCache(`admin_groups:${session.user.id}`, 180000)
      if (cached && !cancelled) {
        setRows(Array.isArray(cached) ? cached : [])
      }
      try {
        const res = await fetch(apiUrl('/api/admin/stokvels'), {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        const text = await res.text()
        if (!res.ok) throw new Error(parseApiError(text))
        const data = JSON.parse(text)
        if (!cancelled) {
          const nextRows = Array.isArray(data.stokvels) ? data.stokvels : []
          setRows(nextRows)
          writeViewCache(`admin_groups:${session.user.id}`, nextRows)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e.message ?? String(e))
          setRows([])
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [session?.access_token])

  const groups = rows ?? []
  const pendingGroups = groups.filter((g) => statusMatches(g, 'pending'))
  const activeGroups = groups.filter((g) => statusMatches(g, 'active'))
  const rejectedGroups = groups.filter((g) => statusMatches(g, 'rejected'))

  return (
    <div>
      <h1 className={pageTitle}>Group config</h1>
      <p className={`${pageSubtitle} mb-6`}>
        Approve pending applications, manage active stokvels, and review declined applications.
        Membership is managed per group.
      </p>

      {error ? (
        <p className={`${errorBox} mb-4`} role="alert">
          {error}
        </p>
      ) : null}

      {rows === null ? (
        <p className="text-sm text-stone-500">Loading…</p>
      ) : (
        <>
          <GroupsTable
            title="Pending applications"
            groups={pendingGroups}
            action={(s) => (
              <Link
                to={`/admin/groups/${s.id}/review`}
                className="inline-flex rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-900 transition hover:bg-blue-100"
              >
                View application
              </Link>
            )}
          />
          <GroupsTable
            title="Active stokvels"
            groups={activeGroups}
            action={(s) => (
              <Link
                to={`/admin/groups/${s.id}/edit`}
                className={`${btnSecondary} inline-flex items-center gap-1.5 px-3 py-1.5 text-xs`}
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden />
                Edit
              </Link>
            )}
          />
          <GroupsTable
            title="Rejected applications"
            groups={rejectedGroups}
            action={(s) => (
              <Link
                to={`/admin/groups/${s.id}/edit`}
                className={`${btnSecondary} inline-flex items-center gap-1.5 px-3 py-1.5 text-xs`}
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden />
                View
              </Link>
            )}
          />
        </>
      )}
    </div>
  )
}
