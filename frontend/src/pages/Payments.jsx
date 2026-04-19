import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useSession } from '../context/SessionContext'
import { apiUrl } from '../utils/api'
import {
  btnPrimary,
  cardLight,
  errorBox,
  inputLight,
  pageSubtitle,
  tableHead,
  tableRow,
  tableWrap,
} from '../ui'
import { readViewCache, writeViewCache } from '../utils/viewCache'
import MarketRatesWidget from '../components/MarketRatesWidget'
import QuickPayModal from '../components/QuickPayModal'

function formatZAR(n) {
  const num = Number(n)
  if (Number.isNaN(num)) return 'R 0'
  return `R ${Math.round(num).toLocaleString('en-ZA')}`
}

function memberDisplay(p) {
  const first = p?.first_name?.trim()
  const last = p?.last_name?.trim()
  if (first || last) return [first, last].filter(Boolean).join(' ')
  if (p?.full_name) return p.full_name
  if (p?.email) return p.email.split('@')[0]
  return 'Member'
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

function confirmAction(message) {
  return window.confirm(message)
}

export default function Payments() {
  const { stokvel_id } = useParams()
  const { session } = useSession()
  const [stokvel, setStokvel] = useState(null)
  const [membership, setMembership] = useState(null)
  const [members, setMembers] = useState([])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [quickPayOpen, setQuickPayOpen] = useState(false)
  const [totalContribution, setTotalContribution] = useState(0)
  const [contributions, setContributions] = useState([])
  const [treasurerUserId, setTreasurerUserId] = useState('')
  const [treasurerSaving, setTreasurerSaving] = useState(false)
  const [treasurerError, setTreasurerError] = useState('')
  const [treasurerOk, setTreasurerOk] = useState('')
  const [paymentDebug, setPaymentDebug] = useState('')

  useEffect(() => {
    if (!session || !stokvel_id) {
      setLoading(false)
      return
    }

    let cancelled = false
    const id = stokvel_id

    async function load() {
      setLoading(true)
      setError(null)
      const cacheKey = `stokvel_detail:${session.user.id}:${id}`
      const cached = readViewCache(cacheKey, 120000)
      if (cached && !cancelled) {
        setMembership(cached.membership ?? null)
        setStokvel(cached.stokvel ?? null)
        const nextMembers = Array.isArray(cached.members) ? cached.members : []
        setMembers(nextMembers)
        setTreasurerUserId(nextMembers.find((m) => m.group_role === 'treasurer')?.user_id ?? '')
        setTotalContribution(cached.totalContribution ?? 0)
        setContributions(Array.isArray(cached.contributions) ? cached.contributions : [])
        setLoading(false)
      }
      try {
        const res = await fetch(apiUrl(`/api/stokvels/${id}`), {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        const text = await res.text()
        if (!res.ok) throw new Error(text || `HTTP ${res.status}`)
        const json = JSON.parse(text)
        if (!cancelled) {
          setMembership(json.membership ?? null)
          setStokvel(json.stokvel ?? null)
          const nextMembers = Array.isArray(json.members) ? json.members : []
          setMembers(nextMembers)
          const currentTreasurer = nextMembers.find((m) => m.group_role === 'treasurer')?.user_id ?? ''
          setTreasurerUserId(currentTreasurer)
          setTotalContribution(json.totalContribution ?? 0)
          setContributions(Array.isArray(json.contributions) ? json.contributions : [])
          let nextMeetings = []
          let meetingsFromApi = false
          try {
            const meetingsRes = await fetch(apiUrl(`/api/stokvels/${id}/meetings`), {
              headers: { Authorization: `Bearer ${session.access_token}` },
            })
            const meetingsText = await meetingsRes.text()
            if (meetingsRes.ok) {
              const meetingsJson = JSON.parse(meetingsText)
              nextMeetings = Array.isArray(meetingsJson.meetings) ? meetingsJson.meetings : []
              meetingsFromApi = true
            }
          } catch {
            /* keep cache fallback */
          }
          if (!meetingsFromApi && Array.isArray(cached?.meetings)) {
            nextMeetings = cached.meetings
          }
          writeViewCache(cacheKey, {
            membership: json.membership ?? null,
            stokvel: json.stokvel ?? null,
            members: nextMembers,
            totalContribution: json.totalContribution ?? 0,
            contributions: Array.isArray(json.contributions) ? json.contributions : [],
            meetings: nextMeetings,
          })
        }
      } catch (e) {
        if (!cancelled) {
          setError(e.message ?? String(e))
          setMembership(null)
          setStokvel(null)
          setMembers([])
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [session, stokvel_id])

  const effectiveStokvel = stokvel ?? membership?.stokvels ?? null
  const groupName = effectiveStokvel?.name
  const stokvelStatus = String(effectiveStokvel?.status ?? '').toLowerCase()
  const isActiveStokvel = stokvelStatus === 'active'
  const memberCount = members.length
  const monthlyContribution = Number(effectiveStokvel?.contribution_amount) || 0
  const expectedPayout = monthlyContribution * memberCount
  const myRole = String(
    members.find((m) => m.user_id === session?.user?.id)?.group_role ?? membership?.group_role ?? '',
  ).toLowerCase()
  const canManageTreasurer = ['treasurer', 'admin'].includes(myRole)
  const currentTreasurer = members.find((m) => m.group_role === 'treasurer') ?? null
  const currentTreasurerName = currentTreasurer ? memberDisplay(currentTreasurer.profiles) : 'Not assigned'

  async function handleTreasurerSave() {
    if (!session?.access_token || !stokvel_id || !treasurerUserId) return
    if (!confirmAction('Save this treasurer change for the group?')) return
    setTreasurerSaving(true)
    setTreasurerError('')
    setTreasurerOk('')
    try {
      const res = await fetch(apiUrl(`/api/stokvels/${stokvel_id}/treasurer`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ userId: treasurerUserId }),
      })
      const text = await res.text()
      if (!res.ok) {
        throw new Error(parseApiError(text))
      }

      setMembers((prev) =>
        prev.map((m) => ({
          ...m,
          group_role:
            m.user_id === treasurerUserId
              ? 'treasurer'
              : m.group_role === 'treasurer'
                ? 'member'
                : m.group_role,
        })),
      )

      if (session.user?.id) {
        setMembership((prev) => {
          if (!prev) return prev
          const nextRole =
            session.user.id === treasurerUserId
              ? 'treasurer'
              : prev.group_role === 'treasurer'
                ? 'member'
                : prev.group_role
          return { ...prev, group_role: nextRole }
        })
      }

      setTreasurerOk('Treasurer updated.')
    } catch (e) {
      setTreasurerError(e.message ?? String(e))
    } finally {
      setTreasurerSaving(false)
    }
  }

  const statCards = [
    { label: 'Total contribution', value: formatZAR(totalContribution) },
    { label: 'Expected payout', value: formatZAR(expectedPayout) },
    { label: 'Monthly contribution', value: formatZAR(monthlyContribution) },
    { label: 'Members', value: String(memberCount) },
  ]

  if (!stokvel_id) {
    return null
  }

  return (
    <div>
      {membership && stokvelStatus === 'rejected' ? (
        <div
          className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200"
          role="status"
        >
          <strong className="font-semibold text-red-900 dark:text-red-100">Application rejected.</strong> This stokvel
          is not active (status: <span className="font-mono">rejected</span>). Meeting and treasury actions are
          disabled for this group.
        </div>
      ) : null}
      {membership && stokvelStatus === 'pending' ? (
        <div
          className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-100"
          role="status"
        >
          <strong className="font-semibold text-amber-950 dark:text-amber-50">Awaiting approval.</strong> A platform
          admin has not activated this stokvel yet. You will see an active status here once it is approved.
        </div>
      ) : null}

      <div
        className={`mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between ${
          isActiveStokvel
            ? 'rounded-xl border-t-4 border-emerald-700 pt-4'
            : 'rounded-xl border-t-4 border-stone-300 pt-4'
        }`}
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-emerald-800 sm:text-3xl">
            <span className="flex items-center gap-2">
              <i className="fa-solid fa-wallet text-emerald-700" aria-hidden />
              Payments &amp; finances
            </span>
          </h1>
          {groupName || membership?.group_role ? (
            <p className={`mt-1 ${pageSubtitle}`}>
              {groupName ? <span className="font-medium text-stone-800 dark:text-stone-100">{groupName}</span> : null}
              {stokvelStatus ? (
                <span className="ml-2 capitalize text-stone-500 dark:text-stone-400">· {stokvelStatus}</span>
              ) : null}
              {membership?.group_role ? (
                <span className="ml-2 text-stone-500 dark:text-stone-400">
                  · {formatGroupRole(membership.group_role)}
                </span>
              ) : null}
            </p>
          ) : null}
          <div className="mt-2 inline-flex items-center gap-2 rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100">
            <span className="font-semibold uppercase tracking-wide">Current treasurer</span>
            <span className="text-emerald-900 dark:text-emerald-50">{currentTreasurerName}</span>
          </div>
        </div>
      </div>

      {!session ? <p className="mb-6 text-sm text-stone-500">Sign in to view this stokvel.</p> : null}

      {error ? <p className={`mb-6 ${errorBox}`}>{error}</p> : null}

      {session && loading ? <p className="text-sm text-stone-500">Loading…</p> : null}

      {session && !loading && membership ? (
        <>
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {statCards.map((card) => (
              <div key={card.label} className={`${cardLight} p-4`}>
                <p className="mb-1 text-xs font-semibold uppercase text-stone-500 dark:text-stone-400">
                  {card.label}
                </p>
                <p className="text-xl font-semibold text-stone-800 dark:text-stone-100">{card.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <MarketRatesWidget memberMonthlyContribution={monthlyContribution} />
            <div className={`${cardLight} p-6`}>
              <span className="text-sm font-bold text-stone-800 dark:text-stone-100">Quick Pay</span>
              {paymentDebug ? (
                <p className="mt-2 text-xs text-amber-800 dark:text-amber-200" role="status">
                  Payment debug: {paymentDebug}
                </p>
              ) : null}
              <button
                type="button"
                disabled={!isActiveStokvel}
                onClick={() => isActiveStokvel && setQuickPayOpen(true)}
                className={`${btnPrimary} mt-4 w-full py-3 text-base disabled:cursor-not-allowed disabled:opacity-40`}
              >
                {monthlyContribution > 0
                  ? `Pay monthly contribution (${formatZAR(monthlyContribution)})`
                  : 'Pay monthly contribution'}
              </button>
              <p className="mt-4 text-xs text-stone-600 dark:text-stone-400">
                Schedules and minutes are on the{' '}
                <Link
                  to={`/group/${stokvel_id}/meetings`}
                  className="font-medium text-emerald-800 underline-offset-2 hover:underline dark:text-emerald-300"
                >
                  Meetings
                </Link>{' '}
                page.
              </p>
            </div>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div className="space-y-8 lg:col-span-2">
              <section>
                <h3 className="mb-4 border-b border-stone-200 pb-2 text-lg font-bold text-emerald-800 dark:border-slate-700 dark:text-emerald-300">
                  Recent contributions
                </h3>
                <div className={tableWrap}>
                  <table className="w-full min-w-[320px] text-left text-sm text-stone-800 dark:text-stone-100">
                    <thead>
                      <tr className={tableHead}>
                        <th className="p-3">Member</th>
                        <th className="p-3">Amount</th>
                        <th className="p-3">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contributions.length === 0 ? (
                        <tr className={tableRow}>
                          <td colSpan={3} className="p-6 text-center text-stone-500 italic">
                            No contributions yet.
                          </td>
                        </tr>
                      ) : (
                        contributions.map((c) => (
                          <tr key={c.id} className={tableRow}>
                            <td className="p-3">{memberDisplay(c.profiles)}</td>
                            <td className="p-3">{formatZAR(c.amount)}</td>
                            <td className="p-3">
                              {c.paid_at ? new Date(c.paid_at).toLocaleDateString('en-ZA') : '—'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            <div>
              {canManageTreasurer ? (
                <section className="mb-8">
                  <h3 className="mb-4 border-b border-stone-200 pb-2 text-lg font-bold text-emerald-800 dark:border-slate-700 dark:text-emerald-300">
                    Assign treasurer
                  </h3>
                  <div className={`${cardLight} space-y-3 p-4`}>
                    <label className="block text-xs font-semibold uppercase text-stone-500 dark:text-stone-400">
                      Treasurer member
                      <select
                        value={treasurerUserId}
                        onChange={(e) => setTreasurerUserId(e.target.value)}
                        className={`${inputLight} mt-2`}
                      >
                        <option value="">Select member</option>
                        {members.map((m) => (
                          <option key={m.user_id} value={m.user_id}>
                            {memberDisplay(m.profiles)} ({formatGroupRole(m.group_role)})
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      onClick={handleTreasurerSave}
                      disabled={treasurerSaving || !treasurerUserId}
                      className={`${btnPrimary} w-full disabled:cursor-not-allowed disabled:opacity-50`}
                    >
                      {treasurerSaving ? 'Saving…' : 'Save treasurer'}
                    </button>
                    {treasurerError ? <p className="text-xs text-red-700 dark:text-red-300">{treasurerError}</p> : null}
                    {treasurerOk ? <p className="text-xs text-emerald-800 dark:text-emerald-200">{treasurerOk}</p> : null}
                  </div>
                </section>
              ) : null}
              <section>
                <h3 className="mb-4 border-b border-stone-200 pb-2 text-lg font-bold text-emerald-800 dark:border-slate-700 dark:text-emerald-300">
                  Payout queue
                </h3>
                <p className="mb-3 text-xs text-stone-500 dark:text-stone-400">
                  Member order below mirrors the roster; payout dates are not tracked in the app yet—confirm the live
                  schedule with your treasurer.
                </p>
                <div className={tableWrap}>
                  <table className="w-full min-w-[280px] text-left text-sm text-stone-800 dark:text-stone-100">
                    <thead>
                      <tr className={tableHead}>
                        <th className="p-3">Member</th>
                        <th className="p-3">Amount</th>
                        <th className="p-3">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.length === 0 ? (
                        <tr className={tableRow}>
                          <td colSpan={3} className="p-6 text-center text-stone-500 italic">
                            No payout schedule yet.
                          </td>
                        </tr>
                      ) : (
                        members.map((m) => (
                          <tr key={`payout-${m.user_id}`} className={tableRow}>
                            <td className="p-3">{memberDisplay(m.profiles)}</td>
                            <td className="p-3">{formatZAR(monthlyContribution)}</td>
                            <td className="p-3">—</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          </div>

          {quickPayOpen ? (
            <QuickPayModal
              groupName={groupName}
              stokvelId={stokvel_id}
              session={session}
              monthlyContribution={monthlyContribution}
              onClose={() => setQuickPayOpen(false)}
              onDebugStep={setPaymentDebug}
              onRecordError={(message) =>
                setError(`Payment succeeded, but contribution was not recorded: ${message}`)
              }
              onSuccess={(paidAmount, contribution) => {
                setPaymentDebug('UI update started')
                setQuickPayOpen(false)
                const effectiveAmount = Number(contribution?.amount ?? paidAmount) || 0
                const myProfile = members.find((m) => m.user_id === session?.user?.id)?.profiles ?? null
                setTotalContribution((prev) => prev + effectiveAmount)
                setContributions((prev) => [
                  {
                    id: contribution?.id ?? `local-${Date.now()}`,
                    amount: effectiveAmount,
                    paid_at: contribution?.paid_at ?? new Date().toISOString(),
                    user_id: contribution?.user_id ?? session?.user?.id ?? null,
                    profiles: myProfile,
                  },
                  ...prev,
                ])
                setPaymentDebug('Optimistic UI updated, refreshing from server')
              }}
            />
          ) : null}
        </>
      ) : null}
    </div>
  )
}
