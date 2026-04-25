import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useSession } from '../context/SessionContext'
import { apiUrl } from '../utils/api'
import {
  btnPrimary,
  btnSecondary,
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

const TARGET_MONTH_RE = /^\d{4}-\d{2}$/

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

function yyyyMmLocal(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** When API has no open `targetMonth` (gap week), cap ledger / “current” month using local calendar. */
function ledgerReferenceMonth(currentCycle) {
  if (currentCycle?.targetMonth && TARGET_MONTH_RE.test(currentCycle.targetMonth)) {
    return currentCycle.targetMonth
  }
  return yyyyMmLocal()
}

function formatScheduleDate(iso) {
  if (!iso) return '—'
  const t = new Date(`${String(iso).slice(0, 10)}T12:00:00`)
  if (Number.isNaN(t.getTime())) return String(iso)
  return t.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

function collectLedgerMonths({ contributions, missedPayments, payouts, capMonth }) {
  const set = new Set()
  for (const c of contributions ?? []) {
    const m = c?.target_month
    if (m && TARGET_MONTH_RE.test(m) && m <= capMonth) set.add(m)
  }
  for (const row of missedPayments ?? []) {
    const m = row?.target_month
    if (m && TARGET_MONTH_RE.test(m) && m <= capMonth) set.add(m)
  }
  for (const row of payouts ?? []) {
    const m = row?.target_month
    if (m && TARGET_MONTH_RE.test(m) && m <= capMonth) set.add(m)
  }
  return [...set].sort()
}

function memberPaidForMonth(contributions, userId, month) {
  return (contributions ?? []).some(
    (c) => c?.user_id === userId && c?.target_month === month && TARGET_MONTH_RE.test(String(month)),
  )
}

function memberFlaggedForMonth(missedPayments, userId, month) {
  return (missedPayments ?? []).some(
    (r) =>
      r?.user_id === userId &&
      r?.target_month === month &&
      r?.resolved_at == null &&
      TARGET_MONTH_RE.test(String(month)),
  )
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
  const [currentCycle, setCurrentCycle] = useState(null)
  const [payouts, setPayouts] = useState([])
  const [missedPayments, setMissedPayments] = useState([])
  const [treasurerUserId, setTreasurerUserId] = useState('')
  const [treasurerSaving, setTreasurerSaving] = useState(false)
  const [treasurerError, setTreasurerError] = useState('')
  const [treasurerOk, setTreasurerOk] = useState('')
  const [paymentDebug, setPaymentDebug] = useState('')
  const [flaggingCandidate, setFlaggingCandidate] = useState(null)
  const [flaggingSubmitting, setFlaggingSubmitting] = useState(false)
  const [ledgerToast, setLedgerToast] = useState('')
  const ledgerToastTimer = useRef(null)

  const showLedgerToast = useCallback((msg) => {
    if (ledgerToastTimer.current) clearTimeout(ledgerToastTimer.current)
    setLedgerToast(msg)
    ledgerToastTimer.current = setTimeout(() => {
      setLedgerToast('')
      ledgerToastTimer.current = null
    }, 4000)
  }, [])

  useEffect(
    () => () => {
      if (ledgerToastTimer.current) clearTimeout(ledgerToastTimer.current)
    },
    [],
  )

  const applyStokvelDetail = useCallback((json) => {
    setMembership(json.membership ?? null)
    setStokvel(json.stokvel ?? null)
    const nextMembers = Array.isArray(json.members) ? json.members : []
    setMembers(nextMembers)
    setTreasurerUserId(nextMembers.find((m) => m.group_role === 'treasurer')?.user_id ?? '')
    setTotalContribution(json.totalContribution ?? 0)
    setContributions(Array.isArray(json.contributions) ? json.contributions : [])
    setCurrentCycle(json.currentCycle ?? null)
    setPayouts(Array.isArray(json.payouts) ? json.payouts : [])
    setMissedPayments(Array.isArray(json.missedPayments) ? json.missedPayments : [])
  }, [])

  const silentReloadDetail = useCallback(async () => {
    if (!session?.access_token || !stokvel_id) return
    const id = stokvel_id
    const cacheKey = `stokvel_detail:${session.user.id}:${id}`
    const res = await fetch(apiUrl(`/api/stokvels/${id}`), {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    const text = await res.text()
    if (!res.ok) throw new Error(parseApiError(text))
    const json = JSON.parse(text)
    applyStokvelDetail(json)
    let nextMeetings = []
    try {
      const meetingsRes = await fetch(apiUrl(`/api/stokvels/${id}/meetings`), {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const meetingsText = await meetingsRes.text()
      if (meetingsRes.ok) {
        const meetingsJson = JSON.parse(meetingsText)
        nextMeetings = Array.isArray(meetingsJson.meetings) ? meetingsJson.meetings : []
      }
    } catch {
      /* ignore */
    }
    writeViewCache(cacheKey, {
      membership: json.membership ?? null,
      stokvel: json.stokvel ?? null,
      members: Array.isArray(json.members) ? json.members : [],
      totalContribution: json.totalContribution ?? 0,
      contributions: Array.isArray(json.contributions) ? json.contributions : [],
      meetings: nextMeetings,
      currentCycle: json.currentCycle ?? null,
      payouts: Array.isArray(json.payouts) ? json.payouts : [],
      missedPayments: Array.isArray(json.missedPayments) ? json.missedPayments : [],
    })
  }, [session?.access_token, session?.user?.id, stokvel_id, applyStokvelDetail])

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
        setCurrentCycle(cached.currentCycle ?? null)
        setPayouts(Array.isArray(cached.payouts) ? cached.payouts : [])
        setMissedPayments(Array.isArray(cached.missedPayments) ? cached.missedPayments : [])
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
          applyStokvelDetail(json)
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
            members: Array.isArray(json.members) ? json.members : [],
            totalContribution: json.totalContribution ?? 0,
            contributions: Array.isArray(json.contributions) ? json.contributions : [],
            meetings: nextMeetings,
            currentCycle: json.currentCycle ?? null,
            payouts: Array.isArray(json.payouts) ? json.payouts : [],
            missedPayments: Array.isArray(json.missedPayments) ? json.missedPayments : [],
          })
        }
      } catch (e) {
        if (!cancelled) {
          setError(e.message ?? String(e))
          setMembership(null)
          setStokvel(null)
          setMembers([])
          setCurrentCycle(null)
          setPayouts([])
          setMissedPayments([])
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
  }, [session, stokvel_id, applyStokvelDetail])

  const effectiveStokvel = stokvel ?? membership?.stokvels ?? null
  const groupName = effectiveStokvel?.name
  const stokvelStatus = String(effectiveStokvel?.status ?? '').toLowerCase()
  const isActiveStokvel = stokvelStatus === 'active'
  const memberCount = members.length
  const monthlyContribution = Number(effectiveStokvel?.contribution_amount) || 0
  const expectedPayout = monthlyContribution * memberCount
  const stokvelType = String(effectiveStokvel?.type ?? '')
  const isRotatingStokvel = stokvelType === 'Rotating'
  const myRole = String(
    members.find((m) => m.user_id === session?.user?.id)?.group_role ?? membership?.group_role ?? '',
  ).toLowerCase()
  const canManageTreasurer = ['treasurer', 'admin'].includes(myRole)
  const canFlagMissed = ['treasurer', 'admin'].includes(myRole)
  const currentTreasurer = members.find((m) => m.group_role === 'treasurer') ?? null
  const currentTreasurerName = currentTreasurer ? memberDisplay(currentTreasurer.profiles) : 'Not assigned'

  const uid = session?.user?.id ?? null

  const hasPaidCurrentMonth = useMemo(() => {
    const tm = currentCycle?.targetMonth
    if (!uid || !tm || !TARGET_MONTH_RE.test(tm)) return false
    return memberPaidForMonth(contributions, uid, tm)
  }, [contributions, currentCycle?.targetMonth, uid])

  const isScheduledReceiver = useMemo(() => {
    const tm = currentCycle?.targetMonth
    if (!uid || !tm || !TARGET_MONTH_RE.test(tm)) return false
    return (payouts ?? []).some((p) => p?.user_id === uid && p?.target_month === tm)
  }, [payouts, currentCycle?.targetMonth, uid])

  const currentUserHasUnresolvedFlag = useMemo(() => {
    if (!uid) return false
    return (missedPayments ?? []).some((r) => r?.user_id === uid && r?.resolved_at == null)
  }, [missedPayments, uid])

  const payWindowAllowsQuickPay =
    (!hasPaidCurrentMonth && Boolean(currentCycle?.inPaymentWindow)) || currentUserHasUnresolvedFlag

  const quickPayBlockedByRotatingReceiver = isRotatingStokvel && isScheduledReceiver

  const quickPayEnabled =
    isActiveStokvel && payWindowAllowsQuickPay && !quickPayBlockedByRotatingReceiver

  const quickPayDisabledReason = useMemo(() => {
    if (!isActiveStokvel) return 'This stokvel is not active yet.'
    if (quickPayBlockedByRotatingReceiver) return 'You are receiving the payout this cycle.'
    if (hasPaidCurrentMonth && !currentUserHasUnresolvedFlag) return 'You have already paid for this cycle.'
    if (!currentCycle?.inPaymentWindow && !currentUserHasUnresolvedFlag) return 'Outside payment window.'
    return null
  }, [
    isActiveStokvel,
    quickPayBlockedByRotatingReceiver,
    hasPaidCurrentMonth,
    currentUserHasUnresolvedFlag,
    currentCycle?.inPaymentWindow,
  ])

  const cycleBannerText = useMemo(() => {
    if (currentCycle?.targetMonth && TARGET_MONTH_RE.test(currentCycle.targetMonth)) {
      return `Active cycle: ${currentCycle.targetMonth}`
    }
    return 'No active payment window'
  }, [currentCycle?.targetMonth])

  const refMonth = useMemo(() => ledgerReferenceMonth(currentCycle), [currentCycle])

  const ledgerMonths = useMemo(
    () =>
      collectLedgerMonths({
        contributions,
        missedPayments,
        payouts,
        capMonth: refMonth,
      }),
    [contributions, missedPayments, payouts, refMonth],
  )

  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) =>
      memberDisplay(a.profiles).localeCompare(memberDisplay(b.profiles), 'en'),
    )
  }, [members])

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

  async function confirmFlagMissedPayment() {
    if (!flaggingCandidate || !session?.access_token || !stokvel_id) return
    setFlaggingSubmitting(true)
    try {
      const res = await fetch(apiUrl(`/api/stokvels/${stokvel_id}/missed-payments`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          user_id: flaggingCandidate.userId,
          target_month: flaggingCandidate.targetMonth,
        }),
      })
      const text = await res.text()
      let json = {}
      try {
        json = text ? JSON.parse(text) : {}
      } catch {
        json = {}
      }
      if (!res.ok) {
        throw new Error(json.error || text || `HTTP ${res.status}`)
      }
      setFlaggingCandidate(null)
      await silentReloadDetail()
      if (json.alreadyFlagged) {
        showLedgerToast('Already flagged for that month.')
      } else {
        showLedgerToast('Missed payment flagged.')
      }
    } catch (e) {
      setError(e.message ?? String(e))
    } finally {
      setFlaggingSubmitting(false)
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
      {ledgerToast ? (
        <div
          className="fixed bottom-6 left-1/2 z-60 max-w-md -translate-x-1/2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-900 shadow-lg dark:border-emerald-800 dark:bg-emerald-950/90 dark:text-emerald-100"
          role="status"
        >
          {ledgerToast}
        </div>
      ) : null}

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

      {session && loading ? (
        <div className="flex justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-green-600" />
        </div>
      ) : null}

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

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-stretch">
            <div className="h-full">
              <MarketRatesWidget memberMonthlyContribution={monthlyContribution} className="h-full" />
            </div>
            <div className="flex h-full flex-col gap-4">
              <div className={`${cardLight} p-4`}>
                <span className="text-sm font-bold text-stone-800 dark:text-stone-100">Quick Pay</span>
                <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">{cycleBannerText}</p>
                {paymentDebug ? (
                  <p className="mt-1 text-xs text-amber-800 dark:text-amber-200" role="status">
                    Payment debug: {paymentDebug}
                  </p>
                ) : null}
                <button
                  type="button"
                  disabled={!quickPayEnabled}
                  onClick={() => quickPayEnabled && setQuickPayOpen(true)}
                  className={`${btnPrimary} mt-3 w-full py-2.5 text-base disabled:cursor-not-allowed disabled:opacity-40`}
                >
                  {monthlyContribution > 0
                    ? `Pay monthly contribution (${formatZAR(monthlyContribution)})`
                    : 'Pay monthly contribution'}
                </button>
                {!quickPayEnabled && quickPayDisabledReason ? (
                  <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">{quickPayDisabledReason}</p>
                ) : null}
              </div>

              <section className={`${cardLight} min-h-0 flex-1 p-4`}>
                <h3 className="mb-3 border-b border-stone-200 pb-2 text-lg font-bold text-emerald-800 dark:border-slate-700 dark:text-emerald-300">
                  Payout schedule
                </h3>
                <p className="mb-3 text-xs text-stone-500 dark:text-stone-400">
                  Scheduled payouts from the group roster (amount ≈ pool for that cycle).
                </p>
                <div className={tableWrap}>
                  <table className="w-full min-w-[280px] text-left text-sm text-stone-800 dark:text-stone-100">
                    <thead>
                      <tr className={tableHead}>
                        <th className="p-3">Date</th>
                        <th className="p-3">Member</th>
                        <th className="p-3">Expected amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr className={tableRow}>
                          <td colSpan={3} className="p-6">
                            <div className="flex justify-center">
                              <Loader2 className="h-8 w-8 animate-spin text-green-600" />
                            </div>
                          </td>
                        </tr>
                      ) : payouts.length === 0 ? (
                        <tr className={tableRow}>
                          <td colSpan={3} className="p-6 text-center text-stone-500 italic">
                            No payout schedule yet.
                          </td>
                        </tr>
                      ) : (
                        payouts.map((p) => {
                          const prof = members.find((m) => m.user_id === p.user_id)?.profiles ?? null
                          return (
                            <tr key={p.id ?? `${p.user_id}-${p.target_month}`} className={tableRow}>
                              <td className="p-3 whitespace-nowrap">{formatScheduleDate(p.scheduled_payout_date)}</td>
                              <td className="p-3">{memberDisplay(prof)}</td>
                              <td className="p-3">{formatZAR(expectedPayout)}</td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="order-1 space-y-8 lg:col-span-2">
              <section>
                <h3 className="mb-4 border-b border-stone-200 pb-2 text-lg font-bold text-emerald-800 dark:border-slate-700 dark:text-emerald-300">
                  Cycle ledger
                </h3>
                {ledgerMonths.length === 0 ? (
                  <p className="text-sm italic text-stone-500 dark:text-stone-400">
                    No contribution cycles recorded yet.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    {ledgerMonths.map((month) => {
                      const isPastMonth = month < refMonth
                      return (
                        <div key={month} className={`${cardLight} overflow-hidden`}>
                          <div className="border-b border-stone-200 bg-stone-50/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/40">
                            <h4 className="text-sm font-bold text-stone-800 dark:text-stone-100">{month}</h4>
                          </div>
                          <div className={tableWrap}>
                            <table className="w-full min-w-[320px] text-left text-sm text-stone-800 dark:text-stone-100">
                              <thead>
                                <tr className={tableHead}>
                                  <th className="p-3">Member</th>
                                  <th className="p-3">Status</th>
                                  {canFlagMissed ? <th className="w-28 p-3 text-right">Action</th> : null}
                                </tr>
                              </thead>
                              <tbody>
                                {sortedMembers.map((m) => {
                                  const paid = memberPaidForMonth(contributions, m.user_id, month)
                                  const flagged = memberFlaggedForMonth(missedPayments, m.user_id, month)
                                  let statusKey = 'unpaid'
                                  let statusLabel = 'Unpaid'
                                  let dotClass = 'bg-stone-400'
                                  if (paid) {
                                    statusKey = 'paid'
                                    statusLabel = 'Paid'
                                    dotClass = 'bg-emerald-500'
                                  } else if (flagged) {
                                    statusKey = 'flagged'
                                    statusLabel = 'Flagged'
                                    dotClass = 'bg-red-500'
                                  }
                                  const showFlag =
                                    canFlagMissed && isPastMonth && statusKey === 'unpaid' && m.user_id !== uid
                                  return (
                                    <tr key={`${month}-${m.user_id}`} className={tableRow}>
                                      <td className="p-3">{memberDisplay(m.profiles)}</td>
                                      <td className="p-3">
                                        <span className="inline-flex items-center gap-2">
                                          <span
                                            className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${dotClass}`}
                                            aria-hidden
                                          />
                                          <span>{statusLabel}</span>
                                        </span>
                                      </td>
                                      {canFlagMissed ? (
                                        <td className="p-3 text-right">
                                          {showFlag ? (
                                            <button
                                              type="button"
                                              className="text-xs font-semibold text-amber-800 underline-offset-2 hover:underline dark:text-amber-300"
                                              onClick={() =>
                                                setFlaggingCandidate({
                                                  userId: m.user_id,
                                                  targetMonth: month,
                                                  memberName: memberDisplay(m.profiles),
                                                })
                                              }
                                            >
                                              Flag
                                            </button>
                                          ) : (
                                            <span className="text-xs text-stone-400">—</span>
                                          )}
                                        </td>
                                      ) : null}
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>
            </div>

            <div className="order-2">
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
              onSuccess={async () => {
                setPaymentDebug('Refreshing from server')
                setQuickPayOpen(false)
                try {
                  await silentReloadDetail()
                  setPaymentDebug('Ledger refreshed from server')
                } catch (e) {
                  setError(e.message ?? String(e))
                  setPaymentDebug('')
                }
              }}
            />
          ) : null}

          {flaggingCandidate ? (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="flag-missed-title"
            >
              <div className={`${cardLight} w-full max-w-md p-6`}>
                <h2 id="flag-missed-title" className="mb-3 text-lg font-bold text-stone-800 dark:text-stone-100">
                  Flag missed payment?
                </h2>
                <p className="text-sm text-stone-600 dark:text-stone-300">
                  Are you sure you want to flag{' '}
                  <strong className="text-stone-800 dark:text-stone-100">{flaggingCandidate.memberName}</strong> for
                  missed payment in <span className="font-mono">{flaggingCandidate.targetMonth}</span>?
                </p>
                <div className="mt-6 flex gap-3">
                  <button
                    type="button"
                    disabled={flaggingSubmitting}
                    className={`${btnPrimary} flex-1 py-2 text-sm disabled:opacity-50`}
                    onClick={() => void confirmFlagMissedPayment()}
                  >
                    {flaggingSubmitting ? 'Saving…' : 'Confirm'}
                  </button>
                  <button
                    type="button"
                    disabled={flaggingSubmitting}
                    className={`${btnSecondary} flex-1 py-2 text-sm disabled:opacity-50`}
                    onClick={() => setFlaggingCandidate(null)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
