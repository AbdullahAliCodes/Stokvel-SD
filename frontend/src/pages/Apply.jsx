import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '../context/SessionContext'
import { apiUrl } from '../utils/api'
import { btnPrimary, errorBox, inputDark, labelDark, tableHead, tableRow, tableWrap } from '../ui'

export default function Apply() {
  const navigate = useNavigate()
  const { session } = useSession()

  const [name, setName] = useState('')
  const [membersCount, setMembersCount] = useState('')
  const [amount, setAmount] = useState('250')
  const [payoutOrder, setPayoutOrder] = useState('randomize')
  const [meetingFreq, setMeetingFreq] = useState('bi-weekly')
  const [memberEmailsRaw, setMemberEmailsRaw] = useState('')
  const [treasurerMode, setTreasurerMode] = useState('self')
  const [treasurerEmail, setTreasurerEmail] = useState('')
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
      const normalizedTreasurerEmail = treasurerEmail.trim().toLowerCase()
      if (treasurerMode === 'email' && !normalizedTreasurerEmail) {
        throw new Error('Enter the treasurer email or choose yourself as treasurer.')
      }
      const res = await fetch(apiUrl('/api/stokvels'), {
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
          memberEmails: memberEmailsRaw
            .split(',')
            .map((v) => v.trim().toLowerCase())
            .filter(Boolean),
          treasurerEmail: treasurerMode === 'email' ? normalizedTreasurerEmail : null,
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
              <input
                type="number"
                min={1}
                className={inputDark}
                placeholder="12"
                value={membersCount}
                onChange={(e) => setMembersCount(e.target.value)}
              />
            </label>
          </div>
        </section>

        <section className="glass p-6">
          <h2 className="mb-4 text-lg font-bold text-white">Member details</h2>
          <label className={`${labelDark} mb-4 block`}>
            Member emails (comma-separated)
            <input
              type="text"
              className={inputDark}
              placeholder="member1@email.com, member2@email.com"
              value={memberEmailsRaw}
              onChange={(e) => setMemberEmailsRaw(e.target.value)}
            />
            <span className="mt-1 block text-xs text-slate-500">
              These members are invited after admin approval of your group request.
            </span>
          </label>
          <div className="mb-4 rounded-xl border border-white/10 bg-black/20 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">
              Assign treasurer
            </p>
            <div className="mt-3 flex flex-col gap-2 text-sm text-slate-300">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="treasurerMode"
                  className="accent-emerald-500"
                  checked={treasurerMode === 'self'}
                  onChange={() => setTreasurerMode('self')}
                />
                I will be the treasurer
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="treasurerMode"
                  className="accent-emerald-500"
                  checked={treasurerMode === 'email'}
                  onChange={() => setTreasurerMode('email')}
                />
                Assign another treasurer by email
              </label>
            </div>
            {treasurerMode === 'email' ? (
              <label className={`${labelDark} mt-3 block`}>
                Treasurer email
                <input
                  type="email"
                  className={inputDark}
                  placeholder="treasurer@example.com"
                  value={treasurerEmail}
                  onChange={(e) => setTreasurerEmail(e.target.value)}
                  required
                />
              </label>
            ) : null}
          </div>
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
              min={0}
              step="0.01"
              className={`${inputDark} max-w-xs`}
              placeholder="500"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
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
