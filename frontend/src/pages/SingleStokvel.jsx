import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useSession } from '../context/SessionContext'

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
    const parsed = Number(quickPayAmount)
    if (!quickPayAmount || Number.isNaN(parsed) || parsed <= 0) {
      setQuickPayError('Please enter a valid amount')
      return
    }
    setQuickPayLoading(true)
    setQuickPayError(null)
    try {
      const res = await fetch(`/api/stokvels/${id}/contributions`, {
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
        const res = await fetch(`/api/stokvels/${id}`, {
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

  const groupName = stokvel?.name
  const memberCount = members.length
  const monthlyContribution = Number(stokvel?.contribution_amount) || 0
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
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-widest">DASHBOARD</h1>
          {groupName ? (
            <p className="mt-1 text-sm text-gray-600">{groupName}</p>
          ) : null}
        </div>
        {membership?.group_role === 'treasurer' ? (
          <button
            type="button"
            className="border border-black bg-white px-4 py-2 text-black hover:bg-gray-100"
          >
            Create Meeting
          </button>
        ) : null}
      </div>

      {!session ? (
        <p className="mb-6 text-sm text-gray-600">
          Sign in to view this stokvel.
        </p>
      ) : null}

      {error ? (
        <p className="mb-6 border border-black bg-gray-100 p-3 text-sm">{error}</p>
      ) : null}

      {session && loading ? (
        <p className="text-sm text-gray-600">Loading...</p>
      ) : null}

      {session && !loading && stokvel ? (
        <>
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {statCards.map((card) => (
              <div
                key={card.label}
                className="border border-black bg-white p-4 shadow-none"
              >
                <p className="mb-1 text-xs font-semibold uppercase text-gray-600">
                  {card.label}
                </p>
                <p className="text-xl font-semibold">{card.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div className="space-y-8 lg:col-span-2">
              <section>
                <h3 className="border-b border-black pb-2 text-lg font-bold">
                  Recent Contributions
                </h3>
                <div className="mt-4 overflow-x-auto border border-black">
                  <table className="w-full min-w-[320px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-black bg-gray-100">
                        <th className="p-3 font-semibold">Member</th>
                        <th className="p-3 font-semibold">Amount</th>
                        <th className="p-3 font-semibold">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contributions.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="p-3 text-gray-600">
                            No contributions yet.
                          </td>
                        </tr>
                      ) : (
                        contributions.map((c) => (
                          <tr key={c.id} className="border-b border-gray-300">
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

              <section>
                <h3 className="border-b border-black pb-2 text-lg font-bold">
                  Agenda
                </h3>
                <div className="mt-4 overflow-x-auto border border-black">
                  <table className="w-full min-w-[320px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-black bg-gray-100">
                        <th className="p-3 font-semibold">Title</th>
                        <th className="p-3 font-semibold">Date</th>
                        <th className="p-3 font-semibold">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        [
                          'Q3 Financial Review',
                          '2026-04-10',
                          'Bring statements',
                        ],
                        [
                          'Monthly check-in',
                          '2026-04-24',
                          'All members',
                        ],
                        [
                          'Payout draw',
                          '2026-05-01',
                          'Treasurer only prep',
                        ],
                      ].map((row) => (
                        <tr key={row[1] + row[0]} className="border-b border-gray-300">
                          <td className="p-3">{row[0]}</td>
                          <td className="p-3">{row[1]}</td>
                          <td className="p-3 text-gray-800">{row[2]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            <div className="space-y-8">
              <section>
                <h3 className="border-b border-black pb-2 text-lg font-bold">
                  Payout Queue
                </h3>
                <div className="mt-4 overflow-x-auto border border-black">
                  <table className="w-full min-w-[280px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-black bg-gray-100">
                        <th className="p-3 font-semibold">Member</th>
                        <th className="p-3 font-semibold">Amount</th>
                        <th className="p-3 font-semibold">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.length === 0 ? (
                        <tr>
                          <td
                            colSpan={3}
                            className="p-3 text-gray-600"
                          >
                            No payout schedule yet.
                          </td>
                        </tr>
                      ) : (
                        members.map((m) => (
                          <tr
                            key={`payout-${m.user_id}`}
                            className="border-b border-gray-300"
                          >
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

          <button
  type="button"
  onClick={() => setQuickPayOpen(true)}
  className="mt-8 w-full max-w-md border-2 border-black bg-black py-4 text-lg font-semibold text-white hover:bg-gray-900 sm:w-auto sm:px-12"
>
  Quick Pay
</button>

{quickPayOpen && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
    <div className="w-full max-w-sm border border-black bg-white p-6 shadow-lg">
      <h2 className="mb-4 text-lg font-bold">Quick Pay</h2>
      <p className="mb-4 text-sm text-gray-600">
        Enter the amount you are contributing to <strong>{groupName}</strong>.
      </p>
      <input
        type="number"
        min="1"
        placeholder="Amount (R)"
        value={quickPayAmount}
        onChange={(e) => setQuickPayAmount(e.target.value)}
        className="mb-2 w-full border border-black p-2 text-sm focus:outline-none"
      />
      {quickPayError && (
        <p className="mb-2 text-xs text-red-600">{quickPayError}</p>
      )}
      <div className="mt-4 flex gap-3">
        <button
          type="button"
          onClick={handleQuickPay}
          disabled={quickPayLoading}
          className="flex-1 border-2 border-black bg-black py-2 text-sm font-semibold text-white hover:bg-gray-900 disabled:opacity-50"
        >
          {quickPayLoading ? 'Submitting...' : 'Submit Payment'}
        </button>
        <button
          type="button"
          onClick={() => { setQuickPayOpen(false); setQuickPayError(null); setQuickPayAmount('') }}
          className="flex-1 border border-black bg-white py-2 text-sm font-semibold hover:bg-gray-100"
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
)}
        </>
      ) : null}
    </div>
  )
}
