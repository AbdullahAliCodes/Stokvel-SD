import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useSession } from '../context/SessionContext'

export default function SingleStokvel() {
  const { id } = useParams()
  const { session } = useSession()
  const [membership, setMembership] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!session || !id) return

    let cancelled = false

    async function load() {
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
        }
      } catch (e) {
        if (!cancelled) {
          setError(e.message ?? String(e))
          setMembership(null)
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [session, id])

  const groupName = membership?.stokvels?.name

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

      {error ? (
        <p className="mb-6 border border-black bg-gray-100 p-3 text-sm">{error}</p>
      ) : null}

      {membership === null && !error ? (
        <p className="text-sm text-gray-600">Loading…</p>
      ) : null}

      {membership ? (
        <>
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Total contribution', value: 'R 4 200' },
              { label: 'Expected payout', value: 'R 250' },
              { label: 'Live interest rate', value: '4.5%' },
              { label: 'Savings projection', value: 'R 12 600' },
            ].map((card) => (
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
                      {[
                        ['Sipho K.', 'R 500', '2026-04-01'],
                        ['Thandi N.', 'R 500', '2026-03-28'],
                        ['Mark F.', 'R 500', '2026-03-15'],
                      ].map((row) => (
                        <tr key={row[2] + row[0]} className="border-b border-gray-300">
                          <td className="p-3">{row[0]}</td>
                          <td className="p-3">{row[1]}</td>
                          <td className="p-3">{row[2]}</td>
                        </tr>
                      ))}
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
                      <tr className="border-b border-gray-300 font-bold">
                        <td className="p-3">Lerato M.</td>
                        <td className="p-3">R 3 000</td>
                        <td className="p-3">2026-04-15</td>
                      </tr>
                      <tr className="border-b border-gray-300">
                        <td className="p-3">Sipho K.</td>
                        <td className="p-3">R 3 000</td>
                        <td className="p-3">2026-05-15</td>
                      </tr>
                      <tr className="border-b border-gray-300">
                        <td className="p-3">Thandi N.</td>
                        <td className="p-3">R 3 000</td>
                        <td className="p-3">2026-06-15</td>
                      </tr>
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
