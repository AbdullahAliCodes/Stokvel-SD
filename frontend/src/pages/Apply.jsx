import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '../context/SessionContext'
import { btnPrimary, errorBox, inputDark, labelDark, tableHead, tableRow, tableWrap } from '../ui'

export default function Apply() {
  const navigate = useNavigate()
  const { session } = useSession()

  const [name, setName] = useState('')
  const [amount, setAmount] = useState('250')
  const [payoutOrder, setPayoutOrder] = useState('randomize')
  const [meetingFreq, setMeetingFreq] = useState('bi-weekly')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (!session?.access_token) {
      setError('You must be signed in to create a stokvel.')
      setLoading(false)
      return
    }

    try {
      const res = await fetch('/api/stokvels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          name,
          contributionAmount: amount,
          payoutOrder,
          meetingFrequency: meetingFreq,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create Stokvel')

      navigate('/dashboard')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl text-white">
      <h1 className="mb-8 border-b border-white/10 pb-4 text-2xl font-bold tracking-wide text-cyan-400">
        Stokvel application
      </h1>

      <form className="space-y-10" onSubmit={handleSubmit}>
        <section className="glass p-6">
          <h2 className="mb-4 text-lg font-bold text-white">Personal info</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={labelDark}>
              Name
              <input className={inputDark} placeholder="Jane" />
            </label>
            <label className={labelDark}>
              Surname
              <input className={inputDark} placeholder="Doe" />
            </label>
            <label className={`${labelDark} sm:col-span-2`}>
              Email
              <input type="email" className={inputDark} placeholder="jane@example.com" />
            </label>
          </div>
        </section>

        <section className="glass p-6">
          <h2 className="mb-4 text-lg font-bold text-white">Stokvel details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={labelDark}>
              Stokvel name
              <input
                className={inputDark}
                placeholder="Avoille Stokvel"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </label>
            <label className={labelDark}>
              Members count
              <input type="number" min={1} className={inputDark} placeholder="12" />
            </label>
          </div>
        </section>

        <section className="glass p-6">
          <h2 className="mb-4 text-lg font-bold text-white">Member details</h2>
          <div className={tableWrap}>
            <table className="w-full text-left text-sm text-slate-200">
              <thead>
                <tr className={tableHead}>
                  <th className="p-2">#</th>
                  <th className="p-2">Name</th>
                  <th className="p-2">Role</th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3].map((n) => (
                  <tr key={n} className={tableRow}>
                    <td className="p-2 text-slate-400">{n}</td>
                    <td className="p-2">
                      <input
                        className={`${inputDark} text-sm`}
                        placeholder={`Member ${n}`}
                      />
                    </td>
                    <td className="p-2">
                      <input className={`${inputDark} text-sm`} placeholder="Member" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="glass p-6">
          <h2 className="mb-4 text-lg font-bold text-white">Contribution amount</h2>
          <label className={labelDark}>
            Monthly (ZAR)
            <input
              type="number"
              className={`${inputDark} max-w-xs`}
              placeholder="500"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
        </section>

        <section className="glass p-6">
          <h2 className="mb-4 text-lg font-bold text-white">Payout order</h2>
          <div className="flex flex-col gap-3 text-sm text-slate-300">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="payout"
                checked={payoutOrder === 'randomize'}
                onChange={() => setPayoutOrder('randomize')}
                className="accent-emerald-500"
              />
              Randomize
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="payout"
                checked={payoutOrder === 'manual'}
                onChange={() => setPayoutOrder('manual')}
                className="accent-emerald-500"
              />
              Select manually
            </label>
          </div>
        </section>

        <section className="glass p-6">
          <h2 className="mb-4 text-lg font-bold text-white">Meeting frequency</h2>
          <select
            className={`${inputDark} max-w-xs`}
            value={meetingFreq}
            onChange={(e) => setMeetingFreq(e.target.value)}
          >
            <option value="weekly">Weekly</option>
            <option value="bi-weekly">Bi-weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </section>

        {error ? <p className={errorBox}>{error}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className={`${btnPrimary} w-full py-4 text-base uppercase tracking-wide`}
        >
          {loading ? 'Submitting…' : 'Submit'}
        </button>
      </form>
    </div>
  )
}
