import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useSession } from '../context/SessionContext'
import { apiUrl } from '../utils/api'
import { btnPrimary, errorBox, pageSubtitle, tableHead, tableRow, tableWrap } from '../ui'

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

export default function SingleStokvel() {
  const { id } = useParams()
  const { session } = useSession()
  const [stokvel, setStokvel] = useState(null)
  const [membership, setMembership] = useState(null)
  const [members, setMembers] = useState([])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [quickPayOpen, setQuickPayOpen] = useState(false)
  const [quickPayAmount, setQuickPayAmount] = useState('')
  const [quickPayLoading, setQuickPayLoading] = useState(false)
  const [quickPayError, setQuickPayError] = useState(null)
  const [totalContribution, setTotalContribution] = useState(0)
  const [contributions, setContributions] = useState([])

  async function handleQuickPay() {
    if (!session?.access_token) return
    const parsed = Number(quickPayAmount)
    if (!quickPayAmount || Number.isNaN(parsed) || parsed <= 0) {
      setQuickPayError('Please enter a valid amount')
      return
    }
    setQuickPayLoading(true)
    setQuickPayError(null)
    try {
      const res = await fetch(apiUrl(`/api/stokvels/${id}/contributions`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ amount: parsed }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
  
      setTotalContribution((prev) => prev + parsed)
      setContributions((prev) => [
        {
          id: json.contribution.id,
          amount: parsed,
          paid_at: json.contribution.paid_at,
          user_id: json.contribution.user_id,
          profiles: members.find((m) => m.user_id === json.contribution.user_id)?.profiles ?? null,
        },
        ...prev,
      ])
      setQuickPayOpen(false)
      setQuickPayAmount('')
    } catch (e) {
      setQuickPayError(e.message)
    } finally {
      setQuickPayLoading(false)
    }
  }

  useEffect(() => {
    if (!session || !id) {
      setLoading(false)
      return
    }

    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(apiUrl(`/api/stokvels/${id}`), {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        const text = await res.text()
        if (!res.ok) {
          throw new Error(text || `HTTP ${res.status}`)
        }
        const json = JSON.parse(text)
        if (!cancelled) {
          setMembership(json.membership ?? null)
          setStokvel(json.stokvel ?? null)
          setMembers(Array.isArray(json.members) ? json.members : [])
          setTotalContribution(json.totalContribution ?? 0)
          setContributions(Array.isArray(json.contributions) ? json.contributions : [])
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
  }, [session, id])

  // Support both `{ stokvel }` (router) and legacy `{ membership.stokvels }` shapes
  const effectiveStokvel = stokvel ?? membership?.stokvels ?? null
  const groupName = effectiveStokvel?.name
  const stokvelStatus = String(effectiveStokvel?.status ?? '').toLowerCase()
  const isActiveStokvel = stokvelStatus === 'active'
  const memberCount = members.length
  const monthlyContribution = Number(effectiveStokvel?.contribution_amount) || 0
  const expectedPayout = monthlyContribution
  const savingsProjection = monthlyContribution * memberCount * 12

  const statCards = [
    { label: 'Total contribution', value: formatZAR(totalContribution) },
    { label: 'Expected payout', value: formatZAR(expectedPayout) },
    { label: 'Live interest rate', value: '0%' },
    {
      label: 'Savings projection',
      value: memberCount > 0 ? formatZAR(savingsProjection) : formatZAR(0),
    },
  ]

  return (
    <div>
      {membership && stokvelStatus === 'rejected' ? (
        <div
          className="mb-6 rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-100"
          role="status"
        >
          <strong className="font-semibold text-red-50">Application rejected.</strong> This stokvel
          is not active (status: <span className="font-mono">rejected</span>). Meeting and treasury
          actions are disabled for this group.
        </div>
      ) : null}
      {membership && stokvelStatus === 'pending' ? (
        <div
          className="mb-6 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
          role="status"
        >
          <strong className="font-semibold text-amber-50">Awaiting approval.</strong> A platform
          admin has not activated this stokvel yet. You will see an active status here once it is
          approved.
        </div>
      ) : null}

      <div
        className={`mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between ${
          isActiveStokvel
            ? 'rounded-xl border-t-4 border-emerald-500/80 pt-4'
            : 'rounded-xl border-t-4 border-slate-600 pt-4'
        }`}
      >
        <div>
          <h1 className="text-2xl font-bold tracking-widest text-cyan-400 uppercase sm:text-3xl">
            <span className="flex items-center gap-2">
              <i className="fa-solid fa-users text-cyan-400" aria-hidden />
              Stokvel dashboard
            </span>
          </h1>
          {groupName || membership?.group_role ? (
            <p className={`mt-1 ${pageSubtitle}`}>
              {groupName ? <span className="text-white">{groupName}</span> : null}
              {stokvelStatus ? (
                <span className="ml-2 capitalize text-slate-500">· {stokvelStatus}</span>
              ) : null}
              {membership?.group_role ? (
                <span className="ml-2 text-slate-500">
                  · {formatGroupRole(membership.group_role)}
                </span>
              ) : null}
            </p>
          ) : null}
        </div>
        {isActiveStokvel && ['treasurer', 'admin'].includes(membership?.group_role) ? (
          <button type="button" className={btnPrimary}>
            Create meeting
          </button>
        ) : null}
      </div>

      {!session ? (
        <p className="mb-6 text-sm text-slate-500">Sign in to view this stokvel.</p>
      ) : null}

      {error ? <p className={`mb-6 ${errorBox}`}>{error}</p> : null}

      {session && loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : null}

      {session && !loading && membership ? (
        <>
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {statCards.map((card) => (
              <div key={card.label} className="glass p-4">
                <p className="mb-1 text-xs font-semibold uppercase text-slate-400">
                  {card.label}
                </p>
                <p className="text-xl font-semibold text-white">{card.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="glass flex h-52 flex-col justify-between p-6">
              <span className="text-sm font-bold text-white">Savings projection (TDD logic)</span>
              <div className="flex h-28 items-end gap-2">
                <div className="h-8 w-full rounded-t bg-slate-700" />
                <div className="h-12 w-full rounded-t bg-slate-600" />
                <div className="h-20 w-full rounded-t bg-blue-500" />
                <div className="h-[7.5rem] w-full rounded-t bg-emerald-500" />
              </div>
              <p className="text-center text-[10px] text-slate-500">
                Projected growth based on Prime Rate
              </p>
            </div>
            <div className="glass p-6">
              <span className="text-sm font-bold text-white">Quick Pay</span>
              <button
                type="button"
                disabled={!isActiveStokvel}
                onClick={() => isActiveStokvel && setQuickPayOpen(true)}
                className={`${btnPrimary} mt-4 w-full py-3 text-base shadow-emerald-900/40 disabled:cursor-not-allowed disabled:opacity-40`}
              >
                {monthlyContribution > 0
                  ? `Pay monthly contribution (${formatZAR(monthlyContribution)})`
                  : 'Pay monthly contribution'}
              </button>
              <div className="mt-4 rounded-lg bg-white/5 p-3 text-xs italic text-slate-400">
                &quot;Next meeting: 15 April via Zoom&quot;
              </div>
            </div>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div className="space-y-8 lg:col-span-2">
              <section>
                <h3 className="mb-4 border-b border-white/10 pb-2 text-lg font-bold text-white">
                  Recent contributions
                </h3>
                <div className={tableWrap}>
                  <table className="w-full min-w-[320px] text-left text-sm text-slate-200">
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
                          <td colSpan={3} className="p-6 text-center text-slate-500 italic">
                            No contributions yet.
                          </td>
                        </tr>
                      ) : (
                        contributions.map((c) => (
                          <tr key={c.id} className={tableRow}>
                            <td className="p-3">{memberDisplay(c.profiles)}</td>
                            <td className="p-3">{formatZAR(c.amount)}</td>
                            <td className="p-3">
                              {c.paid_at
                                ? new Date(c.paid_at).toLocaleDateString('en-ZA')
                                : '—'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <section>
                <h3 className="mb-4 border-b border-white/10 pb-2 text-lg font-bold text-white">
                  Agenda
                </h3>
                <div className={tableWrap}>
                  <table className="w-full min-w-[320px] text-left text-sm text-slate-200">
                    <thead>
                      <tr className={tableHead}>
                        <th className="p-3">Title</th>
                        <th className="p-3">Date</th>
                        <th className="p-3">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className={tableRow}>
                        <td colSpan="3" className="py-8 text-center text-gray-500 italic">
                          No information available
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            <div>
              <section>
                <h3 className="mb-4 border-b border-white/10 pb-2 text-lg font-bold text-white">
                  Payout queue
                </h3>
                <div className={tableWrap}>
                  <table className="w-full min-w-[280px] text-left text-sm text-slate-200">
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
                          <td colSpan={3} className="p-6 text-center text-slate-500 italic">
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
          {isActiveStokvel ? (
            <button
              type="button"
              onClick={() => setQuickPayOpen(true)}
              className={`${btnPrimary} mt-8 w-full max-w-md py-4 text-base sm:w-auto sm:px-12`}
            >
              Quick Pay
            </button>
          ) : null}

          {quickPayOpen ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
              <div className="glass w-full max-w-sm border border-white/10 p-6">
                <h2 className="mb-4 text-lg font-bold text-white">Quick Pay</h2>
                <p className="mb-4 text-sm text-slate-400">
                  Enter the amount you are contributing to{' '}
                  <strong className="text-white">{groupName}</strong>.
                </p>
                <input
                  type="number"
                  min="1"
                  placeholder="Amount (R)"
                  value={quickPayAmount}
                  onChange={(e) => setQuickPayAmount(e.target.value)}
                  className="mb-2 w-full rounded border border-white/15 bg-white/5 p-2 text-sm text-white placeholder:text-slate-500 focus:border-cyan-500/50 focus:outline-none"
                />
                {quickPayError ? (
                  <p className="mb-2 text-xs text-red-400">{quickPayError}</p>
                ) : null}
                <div className="mt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={handleQuickPay}
                    disabled={quickPayLoading}
                    className={`${btnPrimary} flex-1 py-2 text-sm disabled:opacity-50`}
                  >
                    {quickPayLoading ? 'Submitting…' : 'Submit Payment'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setQuickPayOpen(false)
                      setQuickPayError(null)
                      setQuickPayAmount('')
                    }}
                    className="flex-1 rounded border border-white/20 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10"
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
