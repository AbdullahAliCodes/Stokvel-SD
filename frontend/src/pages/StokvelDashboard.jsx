import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LayoutDashboard } from 'lucide-react'
import { useSession } from '../context/SessionContext'
import { apiUrl } from '../utils/api'
import { btnPrimary, errorBox, pageSubtitle } from '../ui'
import { readViewCache, writeViewCache } from '../utils/viewCache'

function formatRole(role) {
  if (!role) return 'Member'
  return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase()
}

function StatusBadge({ status }) {
  const s = String(status ?? '').toLowerCase()
  const label =
    s === 'active'
      ? 'Active'
      : s === 'pending'
        ? 'Pending'
        : s === 'rejected'
          ? 'Rejected'
          : status
            ? String(status).charAt(0).toUpperCase() + String(status).slice(1).toLowerCase()
            : 'Pending'

  const tone =
    s === 'active'
      ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
      : s === 'rejected'
        ? 'border-red-500/50 bg-red-500/15 text-red-200'
        : 'border-cyan-500/40 bg-cyan-500/10 text-cyan-200'

  return (
    <span className={`rounded border px-2 py-0.5 text-xs font-bold uppercase ${tone}`}>
      {label}
    </span>
  )
}

function stokvelStatusOf(m) {
  return String(m?.stokvels?.status ?? '').toLowerCase()
}

export default function StokvelDashboard() {
  const { session } = useSession()
  const [memberships, setMemberships] = useState(null)
  const [error, setError] = useState(null)
  const [meetingFeed, setMeetingFeed] = useState([])

  useEffect(() => {
    if (!session) return

    let cancelled = false

    async function load() {
      setError(null)
      const cached = readViewCache(`member_dashboard:${session.user.id}`, 180000)
      if (cached && !cancelled) {
        setMemberships(Array.isArray(cached.memberships) ? cached.memberships : [])
        setMeetingFeed(Array.isArray(cached.meetingFeed) ? cached.meetingFeed : [])
      }
      try {
        const res = await fetch(apiUrl('/api/my-stokvels'), {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        const text = await res.text()
        if (!res.ok) {
          throw new Error(text || `HTTP ${res.status}`)
        }
        const json = JSON.parse(text)
        if (!cancelled) {
          const nextMemberships = json.memberships ?? []
          setMemberships(nextMemberships)
          const meetingsRes = await fetch(apiUrl('/api/my-meetings'), {
            headers: { Authorization: `Bearer ${session.access_token}` },
          })
          const meetingsText = await meetingsRes.text()
          const meetingJson = meetingsRes.ok ? JSON.parse(meetingsText) : { meetings: [] }
          const flat = Array.isArray(meetingJson.meetings) ? meetingJson.meetings : []
          setMeetingFeed(flat)
          writeViewCache(`member_dashboard:${session.user.id}`, {
            memberships: nextMemberships,
            meetingFeed: flat,
          })
        }
      } catch (e) {
        if (!cancelled) {
          setError(e.message ?? String(e))
          setMemberships([])
          setMeetingFeed([])
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
      <p className={`mb-4 ${pageSubtitle}`}>
        Active groups are ready to use. Pending applications await admin approval; rejected ones
        stay listed so you can see the outcome. Open a card for details.
      </p>
      <div className="mb-8">
        <Link
          to="/apply"
          className={`${btnPrimary} inline-flex px-10 py-3 text-base`}
        >
          Apply to stokvel
        </Link>
      </div>

      {error ? <p className={`mb-4 ${errorBox}`}>{error}</p> : null}

      {memberships === null ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : memberships.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/20 bg-white/[0.02] p-12 text-center text-slate-400">
          You are not part of any stokvel yet.
        </div>
      ) : (
        <>
          {(() => {
            const now = Date.now()
            const upcoming = meetingFeed.filter((m) => new Date(m.meeting_date).getTime() >= now).slice(0, 5)
            const past = meetingFeed.filter((m) => new Date(m.meeting_date).getTime() < now).slice(-5).reverse()
            return (
              <section className="mb-8 grid gap-4 lg:grid-cols-2">
                <div className="glass border-t-4 border-cyan-500/70 p-4">
                  <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-cyan-300">
                    Upcoming meetings calendar
                  </h2>
                  {upcoming.length === 0 ? (
                    <p className="text-xs text-slate-500">No upcoming meetings.</p>
                  ) : (
                    <ul className="space-y-2">
                      {upcoming.map((m) => (
                        <li key={m.id} className="rounded border border-white/10 bg-white/[0.03] p-3">
                          <p className="text-sm font-semibold text-white">{m.title}</p>
                          <p className="text-xs text-slate-300">{m.groupName}</p>
                          <p className="text-xs text-cyan-200">
                            {new Date(m.meeting_date).toLocaleString('en-ZA')}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="glass border-t-4 border-slate-500/60 p-4">
                  <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-300">
                    Past meetings
                  </h2>
                  {past.length === 0 ? (
                    <p className="text-xs text-slate-500">No past meetings.</p>
                  ) : (
                    <ul className="space-y-2">
                      {past.map((m) => (
                        <li key={m.id} className="rounded border border-white/10 bg-white/[0.03] p-3">
                          <p className="text-sm font-semibold text-white">{m.title}</p>
                          <p className="text-xs text-slate-300">{m.groupName}</p>
                          <p className="text-xs text-slate-400">
                            {new Date(m.meeting_date).toLocaleString('en-ZA')}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            )
          })()}
          {(() => {
            const activeList = memberships.filter((m) => stokvelStatusOf(m) === 'active')
            const otherList = memberships.filter((m) => stokvelStatusOf(m) !== 'active')

            const card = (m) => {
              const stokvel = m.stokvels
              const sid = stokvel?.id
              if (!sid) return null
              const rejected = stokvelStatusOf(m) === 'rejected'
              return (
                <li key={sid}>
                  <Link
                    to={`/stokvels/${sid}`}
                    className={`glass block p-5 transition hover:border-white/20 hover:bg-white/[0.07] ${
                      rejected ? 'border border-red-500/25 card-blue opacity-95' : 'card-blue'
                    }`}
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
            }

            return (
              <>
                {activeList.length > 0 ? (
                  <>
                    <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-400">
                      Active stokvels
                    </h2>
                    <ul className="mb-10 grid gap-4 sm:grid-cols-2">{activeList.map(card)}</ul>
                  </>
                ) : null}
                {otherList.length > 0 ? (
                  <>
                    <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-400">
                      Pending &amp; declined
                    </h2>
                    <ul className="grid gap-4 sm:grid-cols-2">{otherList.map(card)}</ul>
                  </>
                ) : null}
              </>
            )
          })()}
        </>
      )}
    </div>
  )
}
