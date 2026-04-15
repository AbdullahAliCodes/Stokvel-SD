import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '../context/SessionContext'
import { apiUrl } from '../utils/api'
import {
  btnPrimary,
  cardLight,
  errorBox,
  inputLight,
  labelLight,
  tableHead,
  tableRow,
  tableWrap,
} from '../ui'

export default function Apply() {
  const navigate = useNavigate()
  const { session } = useSession()

  const [name, setName] = useState('')
  const [membersCount, setMembersCount] = useState('')
  const [amount, setAmount] = useState('250')
  const [payoutOrder, setPayoutOrder] = useState('randomize')
  const [meetingFreq, setMeetingFreq] = useState('bi-weekly')
  const [documentFiles, setDocumentFiles] = useState([])
  const [uploadingDocs, setUploadingDocs] = useState(false)
  const [memberDetails, setMemberDetails] = useState([
    { name: '', email: '', role: 'Member' },
  ])
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
      const parsedCount = Number(membersCount)
      const resolvedCount = Number.isInteger(parsedCount) && parsedCount > 0 ? parsedCount : memberDetails.length
      let documentUrls = []
      if (documentFiles.length > 0) {
        setUploadingDocs(true)
        const fd = new FormData()
        documentFiles.forEach((file) => fd.append('documents', file))
        const uploadRes = await fetch(apiUrl('/api/uploads/documents'), {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: fd,
        })
        const uploadData = await uploadRes.json()
        if (!uploadRes.ok) throw new Error(uploadData.error || 'Failed to upload documents')
        documentUrls = Array.isArray(uploadData.documents) ? uploadData.documents : []
      }
      const res = await fetch(apiUrl('/api/stokvels'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          membersCount: resolvedCount,
          contributionAmount: amount,
          payoutOrder,
          meetingFrequency: meetingFreq,
          memberDetails: memberDetails.map((m) => ({
            name: m.name.trim(),
            email: m.email.trim().toLowerCase(),
            role: m.role.trim(),
          })),
          memberEmails: memberDetails.map((m) => m.email.trim().toLowerCase()).filter(Boolean),
          documents: documentUrls,
          treasurerEmail: treasurerMode === 'email' ? normalizedTreasurerEmail : null,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create Stokvel')

      navigate('/dashboard')
    } catch (err) {
      setError(err.message)
    } finally {
      setUploadingDocs(false)
      setLoading(false)
    }
  }

  function updateMembersCount(value) {
    setMembersCount(value)
    const n = Number(value)
    if (!Number.isInteger(n) || n < 1) return
    setMemberDetails((prev) => {
      if (prev.length === n) return prev
      if (prev.length > n) return prev.slice(0, n)
      return [
        ...prev,
        ...Array.from({ length: n - prev.length }, () => ({ name: '', email: '', role: 'Member' })),
      ]
    })
  }

  function updateMember(idx, key, value) {
    setMemberDetails((prev) => prev.map((m, i) => (i === idx ? { ...m, [key]: value } : m)))
  }

  return (
    <div className="mx-auto max-w-2xl text-stone-800">
      <h1 className="mb-8 border-b border-stone-200 pb-4 text-2xl font-bold tracking-wide text-emerald-800">
        Stokvel application
      </h1>

      <form className="space-y-10" onSubmit={handleSubmit}>
        <section className={`${cardLight} p-6`}>
          <h2 className="mb-4 text-lg font-bold text-stone-800">Personal info</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={labelLight}>
              Name
              <input className={inputLight} placeholder="Jane" />
            </label>
            <label className={labelLight}>
              Surname
              <input className={inputLight} placeholder="Doe" />
            </label>
            <label className={`${labelLight} sm:col-span-2`}>
              Email
              <input type="email" className={inputLight} placeholder="jane@example.com" />
            </label>
          </div>
        </section>

        <section className={`${cardLight} p-6`}>
          <h2 className="mb-4 text-lg font-bold text-stone-800">Stokvel details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={labelLight}>
              Stokvel name
              <input
                className={inputLight}
                placeholder="Avoille Stokvel"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </label>
            <label className={labelLight}>
              Members count
              <input
                type="number"
                min={1}
                className={inputLight}
                placeholder="12"
                value={membersCount}
                onChange={(e) => updateMembersCount(e.target.value)}
              />
            </label>
          </div>
        </section>

        <section className={`${cardLight} p-6`}>
          <h2 className="mb-4 text-lg font-bold text-stone-800">Member details</h2>
          <div className="mb-4 rounded-xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
              Assign treasurer
            </p>
            <div className="mt-3 flex flex-col gap-2 text-sm text-stone-700">
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
              <label className={`${labelLight} mt-3 block`}>
                Treasurer email
                <input
                  type="email"
                  className={inputLight}
                  placeholder="treasurer@example.com"
                  value={treasurerEmail}
                  onChange={(e) => setTreasurerEmail(e.target.value)}
                  required
                />
              </label>
            ) : null}
          </div>
          <div className={tableWrap}>
            <table className="w-full text-left text-sm text-stone-800">
              <thead>
                <tr className={tableHead}>
                  <th className="p-2">#</th>
                  <th className="p-2">Name</th>
                  <th className="p-2">Email</th>
                </tr>
              </thead>
              <tbody>
                {memberDetails.map((m, idx) => (
                  <tr key={`member-${idx}`} className={tableRow}>
                    <td className="p-2 text-stone-500">{idx + 1}</td>
                    <td className="p-2">
                      <input
                        className={`${inputLight} text-sm`}
                        placeholder={`Member ${idx + 1}`}
                        value={m.name}
                        onChange={(e) => updateMember(idx, 'name', e.target.value)}
                      />
                    </td>
                    <td className="p-2">
                      <input
                        className={`${inputLight} text-sm`}
                        placeholder="member@example.com"
                        value={m.email}
                        onChange={(e) => updateMember(idx, 'email', e.target.value)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <label className={`${labelLight} mt-4 block`}>
            Documents (upload files)
            <input
              type="file"
              multiple
              className={inputLight}
              onChange={(e) => setDocumentFiles(Array.from(e.target.files || []))}
            />
          </label>
          {documentFiles.length > 0 ? (
            <p className="mt-2 text-xs text-stone-500">{documentFiles.length} file(s) selected.</p>
          ) : null}
        </section>

        <section className={`${cardLight} p-6`}>
          <h2 className="mb-4 text-lg font-bold text-stone-800">Contribution amount</h2>
          <label className={labelLight}>
            Monthly (ZAR)
            <input
              type="number"
              min={0}
              step="0.01"
              className={`${inputLight} max-w-xs`}
              placeholder="500"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </label>
        </section>

        <section className={`${cardLight} p-6`}>
          <h2 className="mb-4 text-lg font-bold text-stone-800">Payout order</h2>
          <div className="flex flex-col gap-3 text-sm text-stone-700">
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

        <section className={`${cardLight} p-6`}>
          <h2 className="mb-4 text-lg font-bold text-stone-800">Meeting frequency</h2>
          <select
            className={`${inputLight} max-w-xs`}
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
          {loading || uploadingDocs ? 'Submitting…' : 'Submit'}
        </button>
      </form>
    </div>
  )
}
