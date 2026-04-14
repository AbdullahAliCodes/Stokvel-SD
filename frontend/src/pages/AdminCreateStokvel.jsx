import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { useSession } from '../context/SessionContext'
import { apiUrl } from '../utils/api'
import { btnPrimary, btnSecondary, errorBox, inputDark, labelDark } from '../ui'

function parseApiError(text) {
  try {
    const j = JSON.parse(text)
    return j.error || text
  } catch {
    return text || 'Request failed'
  }
}

export default function AdminCreateStokvel() {
  const { session } = useSession()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [type, setType] = useState('Rotating')
  const [contributionAmount, setContributionAmount] = useState('')
  const [payoutStrategy, setPayoutStrategy] = useState('Auto-Rotate')
  const [payoutOrder, setPayoutOrder] = useState('randomize')
  const [meetingFrequency, setMeetingFrequency] = useState('monthly')
  const [cycleLength, setCycleLength] = useState('12')
  const [memberDetails, setMemberDetails] = useState([{ name: '', email: '', role: 'Member' }])
  const [documentFiles, setDocumentFiles] = useState([])
  const [uploadingDocs, setUploadingDocs] = useState(false)

  const [memberQuery, setMemberQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [selectedMembers, setSelectedMembers] = useState([])
  const [treasurerUserId, setTreasurerUserId] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [inviteSubmitting, setInviteSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [inviteError, setInviteError] = useState('')
  const [inviteUsername, setInviteUsername] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteOk, setInviteOk] = useState('')
  const [createdStokvel, setCreatedStokvel] = useState(null)

  const myUserId = session?.user?.id
  const myTreasurerLabel = 'You (group creator)'
  const effectiveMemberDetails = useMemo(
    () => memberDetails.filter((m) => m.name.trim() || m.email.trim()),
    [memberDetails],
  )
  const calculatedMembersCount = Math.max(1, effectiveMemberDetails.length + 1)

  useEffect(() => {
    if (!createdStokvel?.id) return undefined
    const id = setTimeout(() => navigate(`/stokvels/${createdStokvel.id}`), 5000)
    return () => clearTimeout(id)
  }, [createdStokvel, navigate])

  useEffect(() => {
    if (!session?.access_token) return undefined
    const q = memberQuery.trim().replace(/,/g, '')
    if (q.length < 2) {
      setSearchResults([])
      setSearchError('')
      return undefined
    }
    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      setSearchLoading(true)
      setSearchError('')
      try {
        const res = await fetch(apiUrl(`/api/admin/users?q=${encodeURIComponent(q)}`), {
          headers: { Authorization: `Bearer ${session.access_token}` },
          signal: ctrl.signal,
        })
        const text = await res.text()
        if (!res.ok) throw new Error(parseApiError(text))
        const data = JSON.parse(text)
        setSearchResults(Array.isArray(data.users) ? data.users : [])
      } catch (err) {
        if (err.name !== 'AbortError') setSearchError(err.message ?? String(err))
      } finally {
        setSearchLoading(false)
      }
    }, 350)
    return () => {
      ctrl.abort()
      clearTimeout(t)
    }
  }, [memberQuery, session?.access_token])

  useEffect(() => {
    if (myUserId && !treasurerUserId) setTreasurerUserId(myUserId)
  }, [myUserId, treasurerUserId])

  const updateMemberDetail = useCallback((idx, key, value) => {
    setMemberDetails((prev) => prev.map((m, i) => (i === idx ? { ...m, [key]: value } : m)))
  }, [])
  const addMemberDetailRow = useCallback(
    () => setMemberDetails((prev) => [...prev, { name: '', email: '', role: 'Member' }]),
    [],
  )
  const removeMemberDetailRow = useCallback(
    (idx) => setMemberDetails((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx))),
    [],
  )
  const selectUser = useCallback(
    (u) => {
      if (myUserId && u.id === myUserId) return
      setSelectedMembers((prev) => (prev.some((x) => x.id === u.id) ? prev : [...prev, u]))
      setMemberQuery('')
      setSearchResults([])
      setSearchOpen(false)
    },
    [myUserId],
  )
  const removeMember = useCallback(
    (id) => {
      setSelectedMembers((prev) => prev.filter((m) => m.id !== id))
      setTreasurerUserId((prev) => (prev === id ? myUserId || '' : prev))
    },
    [myUserId],
  )

  async function uploadDocuments() {
    if (!session?.access_token || documentFiles.length === 0) return []
    const fd = new FormData()
    documentFiles.forEach((file) => fd.append('documents', file))
    const res = await fetch(apiUrl('/api/uploads/documents'), {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
      body: fd,
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to upload documents')
    return Array.isArray(data.documents) ? data.documents : []
  }

  const handleCreate = async () => {
    setFormError('')
    if (!session?.access_token) return setFormError('You must be signed in.')
    const amountNum = Number(contributionAmount)
    const cycleNum = Number(cycleLength)
    if (!name.trim()) return setFormError('Group name is required.')
    if (!Number.isFinite(amountNum) || amountNum <= 0) return setFormError('Enter a valid contribution amount.')
    if (!Number.isInteger(cycleNum) || cycleNum < 1) return setFormError('Enter a valid cycle length.')
    if (!window.confirm('Create this group with the selected settings and treasurer?')) return

    setSubmitting(true)
    try {
      setUploadingDocs(true)
      const documentUrls = await uploadDocuments()
      const res = await fetch(apiUrl('/api/admin/stokvels'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          type,
          contributionAmount: amountNum,
          payoutStrategy,
          payoutOrder,
          meetingFrequency,
          cycleLength: cycleNum,
          membersCount: calculatedMembersCount,
          memberDetails: effectiveMemberDetails.map((m) => ({
            name: m.name.trim(),
            email: m.email.trim().toLowerCase(),
            role: m.role.trim(),
          })),
          documents: documentUrls,
          initialMemberIds: selectedMembers.map((m) => m.id),
          treasurerUserId: treasurerUserId || myUserId || null,
        }),
      })
      const text = await res.text()
      if (!res.ok) throw new Error(parseApiError(text))
      const data = JSON.parse(text)
      setCreatedStokvel(data.stokvel ?? null)
    } catch (err) {
      setFormError(err.message ?? String(err))
    } finally {
      setUploadingDocs(false)
      setSubmitting(false)
    }
  }

  const handleInvite = async (e) => {
    e.preventDefault()
    setInviteError('')
    setInviteOk('')
    if (!createdStokvel?.id || !session?.access_token) return
    setInviteSubmitting(true)
    try {
      const res = await fetch(apiUrl(`/api/admin/stokvels/${createdStokvel.id}/members`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ username: inviteUsername.trim() }),
      })
      const text = await res.text()
      if (!res.ok) throw new Error(parseApiError(text))
      setInviteOk(`Member added: ${inviteUsername.trim()}`)
      setInviteUsername('')
    } catch (err) {
      setInviteError(err.message ?? String(err))
    } finally {
      setInviteSubmitting(false)
    }
  }

  const handleEmailInvite = async (e) => {
    e.preventDefault()
    setInviteError('')
    setInviteOk('')
    if (!createdStokvel?.id || !session?.access_token) return
    setInviteSubmitting(true)
    try {
      const res = await fetch(apiUrl(`/api/admin/stokvels/${createdStokvel.id}/invitations`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      })
      const text = await res.text()
      if (!res.ok) throw new Error(parseApiError(text))
      setInviteOk(`Invitation sent: ${inviteEmail.trim()}`)
      setInviteEmail('')
    } catch (err) {
      setInviteError(err.message ?? String(err))
    } finally {
      setInviteSubmitting(false)
    }
  }

  if (createdStokvel) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 text-white">
        <section className="glass p-6">
          <h1 className="text-xl font-bold text-cyan-400">Group created</h1>
          <p className="mt-2 text-slate-300">{createdStokvel.name} is live. Add members below or open the dashboard.</p>
        </section>
        <section className="glass p-6">
          <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={handleInvite}>
            <label className={`${labelDark} min-w-0 flex-1`}>
              Add by username
              <input value={inviteUsername} onChange={(e) => setInviteUsername(e.target.value)} className={inputDark} />
            </label>
            <button type="submit" disabled={inviteSubmitting || !inviteUsername.trim()} className={btnPrimary}>
              {inviteSubmitting ? 'Adding...' : 'Add member'}
            </button>
          </form>
          <form className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={handleEmailInvite}>
            <label className={`${labelDark} min-w-0 flex-1`}>
              Invite by email
              <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className={inputDark} />
            </label>
            <button type="submit" disabled={inviteSubmitting || !inviteEmail.trim()} className={btnSecondary}>
              {inviteSubmitting ? 'Sending...' : 'Send invite'}
            </button>
          </form>
          {inviteError ? <p className={`${errorBox} mt-3`}>{inviteError}</p> : null}
          {inviteOk ? <p className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{inviteOk}</p> : null}
        </section>
        <Link to={`/stokvels/${createdStokvel.id}`} className={`${btnPrimary} inline-flex`}>
          Open group dashboard
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl text-white">
      <h1 className="mb-8 border-b border-white/10 pb-4 text-2xl font-bold tracking-wide text-cyan-400">Admin stokvel creation</h1>
      {formError ? <p className={`${errorBox} mb-4`}>{formError}</p> : null}

      <form className="space-y-8" onSubmit={(e) => e.preventDefault()}>
        <section className="glass p-6">
          <h2 className="mb-4 text-lg font-bold text-white">Stokvel details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={`${labelDark} sm:col-span-2`}>Group name<input className={inputDark} value={name} onChange={(e) => setName(e.target.value)} /></label>
            <label className={labelDark}>Type<select className={inputDark} value={type} onChange={(e) => setType(e.target.value)}><option value="Rotating">Rotating</option><option value="Fixed">Fixed</option></select></label>
            <label className={labelDark}>Contribution amount<input type="number" min="0" step="0.01" className={inputDark} value={contributionAmount} onChange={(e) => setContributionAmount(e.target.value)} /></label>
            <label className={labelDark}>Payout schedule<select className={inputDark} value={payoutStrategy} onChange={(e) => setPayoutStrategy(e.target.value)}><option value="Manual">Manual</option><option value="Auto-Rotate">Auto-Rotate</option></select></label>
            <label className={labelDark}>Payout order<select className={inputDark} value={payoutOrder} onChange={(e) => setPayoutOrder(e.target.value)}><option value="randomize">Randomize</option><option value="manual">Manual</option></select></label>
            <label className={labelDark}>Meeting frequency<select className={inputDark} value={meetingFrequency} onChange={(e) => setMeetingFrequency(e.target.value)}><option value="weekly">Weekly</option><option value="bi-weekly">Bi-weekly</option><option value="monthly">Monthly</option></select></label>
            <label className={labelDark}>Cycle length<input type="number" min="1" step="1" className={inputDark} value={cycleLength} onChange={(e) => setCycleLength(e.target.value)} /></label>
          </div>
        </section>

        <section className="glass p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">Member details</h2>
            <button type="button" onClick={addMemberDetailRow} className={btnSecondary}>Add row</button>
          </div>
          <div className="space-y-2">
            {memberDetails.map((m, idx) => (
              <div key={`md-${idx}`} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <input className={inputDark} placeholder={`Member ${idx + 1} name`} value={m.name} onChange={(e) => updateMemberDetail(idx, 'name', e.target.value)} />
                <input className={inputDark} placeholder={`Member ${idx + 1} email`} value={m.email} onChange={(e) => updateMemberDetail(idx, 'email', e.target.value)} />
                <button type="button" onClick={() => removeMemberDetailRow(idx)} className={btnSecondary}><X className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-400">Members count is auto-calculated: {calculatedMembersCount}</p>
        </section>

        <section className="glass p-6">
          <h2 className="mb-4 text-lg font-bold text-white">Admin member tools</h2>
          <div className="relative">
            <label className={labelDark}>
              Search users
              <input
                value={memberQuery}
                onChange={(e) => {
                  setMemberQuery(e.target.value)
                  setSearchOpen(true)
                }}
                onFocus={() => setSearchOpen(true)}
                onBlur={() => setTimeout(() => setSearchOpen(false), 200)}
                className={inputDark}
                placeholder="username or name..."
              />
            </label>
            {searchOpen && (searchLoading || searchResults.length > 0 || searchError) ? (
              <ul className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-xl border border-white/15 bg-slate-900 shadow-xl">
                {searchLoading ? <li className="px-3 py-2 text-xs text-slate-400">Searching...</li> : null}
                {searchError ? <li className="px-3 py-2 text-xs text-red-300">{searchError}</li> : null}
                {searchResults.filter((u) => !myUserId || u.id !== myUserId).map((u) => (
                  <li key={u.id}>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm text-slate-200 hover:bg-white/10"
                      onMouseDown={(ev) => {
                        ev.preventDefault()
                        selectUser(u)
                      }}
                    >
                      {u.label}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <label className={`${labelDark} mt-4`}>
            Assign treasurer
            <select className={inputDark} value={treasurerUserId || myUserId || ''} onChange={(e) => setTreasurerUserId(e.target.value)}>
              {myUserId ? <option value={myUserId}>{myTreasurerLabel}</option> : null}
              {selectedMembers.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </label>

          <div className="mt-4 space-y-2">
            {selectedMembers.map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm">
                <span className="truncate">{m.label}</span>
                <button type="button" onClick={() => removeMember(m.id)} className={btnSecondary}><X className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        </section>

        <section className="glass p-6">
          <label className={labelDark}>
            Documents (upload files)
            <input type="file" multiple className={inputDark} onChange={(e) => setDocumentFiles(Array.from(e.target.files || []))} />
          </label>
          {documentFiles.length > 0 ? <p className="mt-2 text-xs text-slate-400">{documentFiles.length} file(s) selected.</p> : null}
        </section>

        <button type="button" onClick={handleCreate} disabled={submitting || uploadingDocs} className={`${btnPrimary} w-full py-4 text-base uppercase tracking-wide`}>
          {submitting || uploadingDocs ? 'Creating...' : 'Create stokvel'}
        </button>
      </form>
    </div>
  )
}
