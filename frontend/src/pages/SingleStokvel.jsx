import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useSession } from '../context/SessionContext'
import { btnPrimary, errorBox, pageSubtitle, tableHead, tableRow, tableWrap } from '../ui'

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
  const isTreasurer = membership?.group_role === 'treasurer'
  const stokvelStatus = String(membership?.stokvels?.status ?? '').toLowerCase()
  const isActiveStokvel = stokvelStatus === 'active'

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
          isTreasurer && isActiveStokvel
            ? 'rounded-xl border-t-4 border-emerald-500 pt-4'
            : isTreasurer && !isActiveStokvel
              ? 'rounded-xl border-t-4 border-slate-600 pt-4'
              : ''
        }`}
      >
        <div>
          <h1 className="text-2xl font-bold tracking-widest text-cyan-400 uppercase sm:text-3xl">
            {isTreasurer ? (
              <span className="flex items-center gap-2">
                <i className="fa-solid fa-file-invoice-dollar text-emerald-400" aria-hidden />
                Treasurer dashboard
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <i className="fa-solid fa-user-circle text-blue-400" aria-hidden />
                Member dashboard
              </span>
            )}
          </h1>
          {groupName ? (
            <p className={`mt-1 ${pageSubtitle}`}>
              {groupName}
              {stokvelStatus ? (
                <span className="ml-2 capitalize text-slate-500">· {stokvelStatus}</span>
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

      {error ? <p className={`mb-6 ${errorBox}`}>{error}</p> : null}

      {membership === null && !error ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : null}

      {membership ? (
        <>
          <div className="mb-8 grid gap-4 md:grid-cols-3">
            <div className="glass card-green p-5">
              <p className="text-xs text-slate-400">Total Contributions</p>
              <p className="stat-glow text-2xl font-bold text-emerald-400">R 12,450.00</p>
            </div>
            <div className="glass card-accent p-5">
              <p className="text-xs text-slate-400">Expected Payout</p>
              <p className="text-2xl font-bold text-cyan-400">R 50,000.00</p>
              <p className="mt-1 text-[10px] text-slate-500">Scheduled: Oct 2026</p>
            </div>
            <div className="glass card-blue p-5">
              <p className="text-xs text-slate-400">SA Prime Rate</p>
              <p className="text-2xl font-bold text-blue-400">11.75%</p>
              <p className="text-[10px] text-blue-300/90">Live from SARB</p>
            </div>
          </div>

          {isTreasurer ? (
            <div className="mb-8 glass border-t-4 border-emerald-500 p-6">
              <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <h3 className="text-lg font-bold text-white">Member compliance overview</h3>
                <button
                  type="button"
                  className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/15"
                >
                  Export CSV/PDF
                </button>
              </div>
              <div className={tableWrap}>
                <table className="w-full text-left text-sm text-slate-200">
                  <thead>
                    <tr className={tableHead}>
                      <th className="p-3">Member</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Last Paid</th>
                      <th className="p-3">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className={tableRow}>
                      <td className="p-3">Thabo M.</td>
                      <td className="p-3">
                        <span className="text-emerald-400">● Paid</span>
                      </td>
                      <td className="p-3 text-slate-400">01 Mar 2026</td>
                      <td className="p-3">
                        <button type="button" className="text-sm text-blue-400 hover:underline">
                          View
                        </button>
                      </td>
                    </tr>
                    <tr className={tableRow}>
                      <td className="p-3">Sarah J.</td>
                      <td className="p-3">
                        <span className="text-red-400">● Overdue</span>
                      </td>
                      <td className="p-3 text-slate-500">—</td>
                      <td className="p-3">
                        <button
                          type="button"
                          className="rounded bg-red-500/20 px-2 py-1 text-xs text-red-300"
                        >
                          Flag Member
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-blue-500/30 bg-white/[0.03] p-4">
                  <p className="mb-2 text-sm font-bold text-white">ML financial health score (avg)</p>
                  <div className="h-4 w-full overflow-hidden rounded-full bg-slate-700">
                    <div className="h-full w-[78%] bg-gradient-to-r from-red-500 via-cyan-400 to-emerald-500" />
                  </div>
                  <p className="mt-1 text-right text-xs text-slate-400">78/100 — Healthy</p>
                </div>
                <div className="rounded-xl border border-cyan-500/30 bg-white/[0.03] p-4">
                  <p className="mb-2 text-sm font-bold text-white">Next payout disbursement</p>
                  <p className="text-lg text-cyan-400">R 45,000.00 → Sipho K.</p>
                  <button
                    type="button"
                    className="mt-3 w-full rounded bg-cyan-600 py-2 text-xs font-bold text-white hover:bg-cyan-500"
                  >
                    Initiate Payout
                  </button>
                </div>
              </div>
            </div>
          ) : null}

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
                className={`${btnPrimary} mt-4 w-full py-3 text-base shadow-emerald-900/40`}
              >
                Pay monthly contribution (R 1,500)
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
                      <tr className={tableRow}>
                        <td colSpan="3" className="py-8 text-center text-gray-500 italic">
                          No information available
                        </td>
                      </tr>
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
          </div>
        </>
      ) : null}
    </div>
  )
}
