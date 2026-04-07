import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '../context/SessionContext'

export default function Apply() {
  const navigate = useNavigate()
  const { session } = useSession()

  const [name, setName] = useState('')
  const [membersCount, setMembersCount] = useState('')
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
          membersCount,
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
    <div className="mx-auto max-w-2xl text-black">
      <h1 className="mb-8 border-b border-black pb-4 text-2xl font-semibold">
        Stokvel application
      </h1>

      <form className="space-y-10" onSubmit={handleSubmit}>
        <section>
          <h2 className="mb-4 text-lg font-semibold">Personal info</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              Name
              <input
                className="border border-black bg-white p-2"
                placeholder="Jane"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Surname
              <input
                className="border border-black bg-white p-2"
                placeholder="Doe"
              />
            </label>
            <label className="col-span-full flex flex-col gap-1 text-sm">
              Email
              <input
                type="email"
                className="border border-black bg-white p-2"
                placeholder="jane@example.com"
              />
            </label>
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-lg font-semibold">Stokvel details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              Stokvel name
              <input
                className="border border-black bg-white p-2"
                placeholder="Avoille Stokvel"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Members count
              <input
                type="number"
                min={1}
                className="border border-black bg-white p-2"
                placeholder="12"
                value={membersCount}
                onChange={(e) => setMembersCount(e.target.value)}
              />
            </label>
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-lg font-semibold">Member details</h2>
          <div className="overflow-x-auto border border-black">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-black bg-gray-100">
                  <th className="p-2 font-medium">#</th>
                  <th className="p-2 font-medium">Name</th>
                  <th className="p-2 font-medium">Role</th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3].map((n) => (
                  <tr key={n} className="border-b border-gray-300">
                    <td className="p-2">{n}</td>
                    <td className="p-2">
                      <input
                        className="w-full border border-gray-400 bg-white px-1 py-0.5"
                        placeholder={`Member ${n}`}
                      />
                    </td>
                    <td className="p-2">
                      <input
                        className="w-full border border-gray-400 bg-white px-1 py-0.5"
                        placeholder="Member"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-lg font-semibold">Contribution amount</h2>
          <label className="flex flex-col gap-1 text-sm">
            Monthly (ZAR)
            <input
              type="number"
              min={0}
              step="0.01"
              className="max-w-xs border border-black bg-white p-2"
              placeholder="500"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </label>
        </section>

        <section>
          <h2 className="mb-4 text-lg font-semibold">Payout order</h2>
          <div className="flex flex-col gap-2 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="payout"
                checked={payoutOrder === 'randomize'}
                onChange={() => setPayoutOrder('randomize')}
              />
              Randomize
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="payout"
                checked={payoutOrder === 'manual'}
                onChange={() => setPayoutOrder('manual')}
              />
              Select manually
            </label>
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-lg font-semibold">Meeting freq</h2>
          <select
            className="max-w-xs border border-black bg-white p-2 text-sm"
            value={meetingFreq}
            onChange={(e) => setMeetingFreq(e.target.value)}
          >
            <option value="weekly">Weekly</option>
            <option value="bi-weekly">Bi-weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </section>

        {error ? <p className="mb-4 text-red-600">{error}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full border-2 border-black bg-black py-4 text-center text-lg font-bold tracking-wide text-white hover:bg-gray-900 disabled:opacity-60"
        >
          {loading ? 'Submitting...' : 'SUBMIT'}
        </button>
      </form>
    </div>
  )
}
