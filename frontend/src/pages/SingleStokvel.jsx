import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useSession } from '../context/SessionContext'

function formatZAR(n) {
  const num = Number(n)
  if (Number.isNaN(num)) return 'R 0'
  return `R ${Math.round(num).toLocaleString('en-ZA')}`
}

function memberDisplay(m) {
  const p = m.profiles
  const first = p?.first_name?.trim()
  const last = p?.last_name?.trim()
  if (first || last) return [first, last].filter(Boolean).join(' ')
  if (p?.full_name) return p.full_name
  if (p?.email) return p.email.split('@')[0]
  if (m.user_id) return `Member ${m.user_id.slice(0, 8)}`
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
  const totalContribution = 0
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
                      {members.length === 0 ? (
                        <tr>
                          <td
                            colSpan={3}
                            className="p-3 text-gray-600"
                          >
                            No members yet.
                          </td>
                        </tr>
                      ) : (
                        members.map((m) => (
                          <tr
                            key={m.user_id}
                            className="border-b border-gray-300"
                          >
                            <td className="p-3">{memberDisplay(m)}</td>
                            <td className="p-3">{formatZAR(0)}</td>
                            <td className="p-3">—</td>
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
                            <td className="p-3">{memberDisplay(m)}</td>
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
            className="mt-8 w-full max-w-md border-2 border-black bg-black py-4 text-lg font-semibold text-white hover:bg-gray-900 sm:w-auto sm:px-12"
          >
            Quick Pay
          </button>
        </>
      ) : null}
    </div>
  )
}
