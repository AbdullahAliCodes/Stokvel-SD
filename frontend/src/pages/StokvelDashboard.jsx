import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Calendar, CreditCard, LayoutDashboard, Users } from 'lucide-react'
import { useSession } from '../context/SessionContext'
import { apiUrl } from '../utils/api'
import { btnPrimary, cardLight, errorBox, pageSubtitle } from '../ui'
import { readViewCache, writeViewCache } from '../utils/viewCache'
import QuickPayModal from '../components/QuickPayModal'

function formatZAR(n) {
  const num = Number(n)
  if (Number.isNaN(num)) return 'R 0'
  return `R ${Math.round(num).toLocaleString('en-ZA')}`
}

function formatGroupRole(role) {
  if (!role) return 'Member'
  return String(role).charAt(0).toUpperCase() + String(role).slice(1).toLowerCase()
}

function parseApiError(text) {
  try {
    const json = JSON.parse(text)
    return json.error || text || 'Request failed'
  } catch {
    return text || 'Request failed'
  }
}

function toDisplayDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' })
}

function memberProfilesForUser(members, userId) {
  return members.find((m) => m.user_id === userId)?.profiles ?? null
}

export default function StokvelDashboard() {
  const { stokvel_id } = useParams()
  const navigate = useNavigate()
  const { session } = useSession()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [meetingsError, setMeetingsError] = useState('')
  const [stokvel, setStokvel] = useState(null)
  const [membership, setMembership] = useState(null)
  const [members, setMembers] = useState([])
  const [totalContribution, setTotalContribution] = useState(0)
  const [meetings, setMeetings] = useState([])
  const [quickPayOpen, setQuickPayOpen] = useState(false)
  const [paymentDebug, setPaymentDebug] = useState('')

  useEffect(() => {
    if (!stokvel_id) {
      navigate('/dashboard', { replace: true })
      return
    }
    if (!session?.access_token || !session?.user?.id) {
      setLoading(false)
      return
    }

    let cancelled = false
    const id = stokvel_id
    const cacheKey = `stokvel_detail:${session.user.id}:${id}`

    async function load() {
      setLoading(true)
      setError(null)
      setMeetingsError('')

      const cached = readViewCache(cacheKey, 120000)
      if (cached && !cancelled) {
        setMembership(cached.membership ?? null)
        setStokvel(cached.stokvel ?? null)
        setMembers(Array.isArray(cached.members) ? cached.members : [])
        setTotalContribution(Number(cached.totalContribution ?? 0))
        setMeetings(Array.isArray(cached.meetings) ? cached.meetings : [])
        setLoading(false)
      }

      try {
        const res = await fetch(apiUrl(`/api/stokvels/${id}`), {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        const text = await res.text()
        if (!res.ok) throw new Error(parseApiError(text))
        const json = JSON.parse(text)
        if (cancelled) return
        setMembership(json.membership ?? null)
        setStokvel(json.stokvel ?? null)
        const nextMembers = Array.isArray(json.members) ? json.members : []
        setMembers(nextMembers)
        setTotalContribution(Number(json.totalContribution ?? 0))
        setMeetingsError('')
        let nextMeetings = []
        try {
          const meetingsRes = await fetch(apiUrl(`/api/stokvels/${id}/meetings`), {
            headers: { Authorization: `Bearer ${session.access_token}` },
          })
          const meetingsText = await meetingsRes.text()
          if (!meetingsRes.ok) throw new Error(parseApiError(meetingsText))
          const meetingsJson = JSON.parse(meetingsText)
          nextMeetings = Array.isArray(meetingsJson.meetings) ? meetingsJson.meetings : []
        } catch (meErr) {
          if (!cancelled) {
            setMeetingsError(meErr.message ?? String(meErr))
            nextMeetings = []
          }
        }
        if (cancelled) return
        setMeetings(nextMeetings)
        writeViewCache(cacheKey, {
          membership: json.membership ?? null,
          stokvel: json.stokvel ?? null,
          members: nextMembers,
          totalContribution: Number(json.totalContribution ?? 0),
          contributions: Array.isArray(json.contributions) ? json.contributions : [],
          meetings: nextMeetings,
        })
      } catch (e) {
        if (!cancelled) {
          setError(e.message ?? String(e))
          setMeetingsError('')
          setStokvel(null)
          setMembership(null)
          setMembers([])
          setMeetings([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [session, stokvel_id, navigate])

  const effectiveStokvel = stokvel ?? membership?.stokvels ?? null
  const groupName = effectiveStokvel?.name ?? 'Stokvel'
  const monthlyContribution = Number(effectiveStokvel?.contribution_amount) || 0
  const memberCount = members.length
  const expectedPayout = monthlyContribution * memberCount
  const myGroupRole =
    members.find((m) => m.user_id === session?.user?.id)?.group_role || membership?.group_role

  const nextMeeting = useMemo(() => {
    const nowTs = Date.now()
    const upcoming = meetings.filter((m) => new Date(m.meeting_date).getTime() >= nowTs)
    upcoming.sort(
      (a, b) => new Date(a.meeting_date).getTime() - new Date(b.meeting_date).getTime(),
    )
    return upcoming[0] ?? null
  }, [meetings])

  const detailPath = `/group/${stokvel_id}/stokvels`

  if (!stokvel_id) {
    return null
  }

  if (loading && !stokvel && !error) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-sm text-stone-500">
        Loading dashboard…
      </div>
    )
  }

  if (error && !effectiveStokvel) {
    return (
      <div>
        <h1 className="mb-2 text-2xl font-bold text-emerald-800">Dashboard</h1>
        <p className={`${errorBox}`}>{error}</p>
        <Link to="/dashboard" className={`${btnPrimary} mt-4 inline-block`}>
          Back to gateway
        </Link>
      </div>
    )
  }

  const stokvelStatus = String(effectiveStokvel?.status ?? '').toLowerCase()
  const isActiveStokvel = stokvelStatus === 'active'

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-3 border-b border-stone-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <LayoutDashboard className="h-7 w-7 shrink-0 text-emerald-700" aria-hidden />
            <h1 className="text-2xl font-bold tracking-tight text-emerald-800 sm:text-3xl">
              {groupName}
            </h1>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-emerald-800">
              {formatGroupRole(myGroupRole)}
            </span>
            {!isActiveStokvel && stokvelStatus ? (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-amber-900">
                {stokvelStatus}
              </span>
            ) : null}
          </div>
          <p className={pageSubtitle}>
            Summary for this group. Open the full stokvel page for meetings, members, and admin
            tools.
          </p>
        </div>
        <Link
          to={detailPath}
          className="shrink-0 rounded-lg border border-stone-200 bg-stone-50 px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-100"
        >
          View full details
        </Link>
      </header>

      {meetingsError ? (
        <p className={`text-sm ${errorBox}`}>Meetings could not be loaded: {meetingsError}</p>
      ) : null}

      <section>
        <h2 className="sr-only">Key figures</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className={`${cardLight} border-t-4 border-emerald-600 p-4`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              Contributions to date
            </p>
            <p className="mt-2 text-2xl font-bold text-stone-800">{formatZAR(totalContribution)}</p>
            <p className="mt-1 text-xs text-stone-500">Recorded payments for this group</p>
          </div>
          <div className={`${cardLight} border-t-4 border-stone-300 p-4`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              Expected payout (cycle)
            </p>
            <p className="mt-2 text-2xl font-bold text-stone-800">{formatZAR(expectedPayout)}</p>
            <p className="mt-1 text-xs text-stone-500">
              Monthly × {memberCount} member{memberCount === 1 ? '' : 's'}
            </p>
          </div>
          <div className={`${cardLight} border-t-4 border-emerald-600/70 p-4`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              Monthly contribution
            </p>
            <p className="mt-2 text-2xl font-bold text-stone-800">{formatZAR(monthlyContribution)}</p>
            <p className="mt-1 text-xs text-stone-500">Per member target</p>
          </div>
          <div className={`${cardLight} border-t-4 border-stone-300 p-4`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Members</p>
            <p className="mt-2 flex items-center gap-2 text-2xl font-bold text-stone-800">
              <Users className="h-6 w-6 text-emerald-700" aria-hidden />
              {memberCount}
            </p>
            <p className="mt-1 text-xs text-stone-500">In this roster</p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className={`${cardLight} border-t-4 border-emerald-700 p-5`}>
          <div className="mb-4 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-emerald-700" aria-hidden />
            <h2 className="text-sm font-bold uppercase tracking-wide text-emerald-800">
              Next meeting
            </h2>
          </div>
          {nextMeeting ? (
            <div className="space-y-3">
              <p className="text-lg font-semibold text-stone-800">{nextMeeting.title ?? 'Meeting'}</p>
              <p className="text-sm text-stone-600">{toDisplayDate(nextMeeting.meeting_date)}</p>
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-500">
                  Agenda
                </p>
                <p className="text-sm leading-relaxed text-stone-700">
                  {nextMeeting.agenda || nextMeeting.notes || 'No agenda added yet.'}
                </p>
              </div>
              <Link
                to={`/group/${stokvel_id}/meetings`}
                className="inline-block text-sm font-medium text-emerald-800 underline-offset-2 hover:underline"
              >
                All meetings
              </Link>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-stone-200 bg-stone-50/80 px-4 py-8 text-center">
              <p className="text-sm text-stone-600">No upcoming meetings scheduled.</p>
              <p className="mt-1 text-xs text-stone-500">
                When your treasurer adds one, it will show up here.
              </p>
            </div>
          )}
        </section>

        <section className={`${cardLight} border-t-4 border-stone-300 p-5`}>
          <div className="mb-4 flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-emerald-700" aria-hidden />
            <h2 className="text-sm font-bold uppercase tracking-wide text-emerald-800">
              Quick pay
            </h2>
          </div>
          <p className="mb-4 text-sm text-stone-600">
            Pay your monthly contribution securely. Amount defaults to this group&apos;s monthly
            target.
          </p>
          <button
            type="button"
            disabled={!isActiveStokvel || !session}
            className={`${btnPrimary} disabled:cursor-not-allowed disabled:opacity-50`}
            onClick={() => setQuickPayOpen(true)}
          >
            Pay monthly contribution
          </button>
          {!isActiveStokvel ? (
            <p className="mt-2 text-xs text-stone-500">Payments are available when the group is active.</p>
          ) : null}
          {paymentDebug ? <p className="mt-2 text-xs text-stone-400">{paymentDebug}</p> : null}
        </section>
      </div>

      {quickPayOpen && session ? (
        <QuickPayModal
          groupName={groupName}
          stokvelId={stokvel_id}
          session={session}
          monthlyContribution={monthlyContribution}
          onClose={() => setQuickPayOpen(false)}
          onDebugStep={setPaymentDebug}
          onRecordError={(message) => {
            setError(`Payment succeeded, but contribution was not recorded: ${message}`)
          }}
          onSuccess={(paidAmount, contribution) => {
            setPaymentDebug('Contribution recorded')
            setQuickPayOpen(false)
            const effectiveAmount = Number(contribution?.amount ?? paidAmount) || 0
            setTotalContribution((prev) => prev + effectiveAmount)
            const cacheKey = `stokvel_detail:${session.user.id}:${stokvel_id}`
            const cached = readViewCache(cacheKey, 120000)
            if (cached && typeof cached === 'object') {
              const prevContrib = Array.isArray(cached.contributions) ? cached.contributions : []
              const myProfile = memberProfilesForUser(members, session?.user?.id)
              writeViewCache(cacheKey, {
                ...cached,
                totalContribution: Number(cached.totalContribution ?? 0) + effectiveAmount,
                contributions: [
                  {
                    id: contribution?.id ?? `local-${Date.now()}`,
                    amount: effectiveAmount,
                    paid_at: contribution?.paid_at ?? new Date().toISOString(),
                    user_id: contribution?.user_id ?? session?.user?.id ?? null,
                    profiles: myProfile,
                  },
                  ...prevContrib,
                ],
              })
            }
          }}
        />
      ) : null}
    </div>
  )
}
