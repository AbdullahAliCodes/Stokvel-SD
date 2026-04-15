import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { useSession } from '../context/SessionContext'
import { apiUrl } from '../utils/api'
import { btnPrimary, btnSecondary, errorBox, inputDark, labelDark } from '../ui'

const MAX_GROUP_MEMBERS = 12
const PDF_MAX_BYTES = 5 * 1024 * 1024

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isValidManualEmail(s) {
  const t = s.trim().toLowerCase()
  return t.length >= 5 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)
}

function normalizeManualUsername(raw) {
  return raw
    .trim()
    .replace(/^@+/, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
}

function parseApiError(text) {
  try {
    const j = JSON.parse(text)
    return j.error || text
  } catch {
    return text || 'Request failed'
  }
}

function buildMemberDetailsFromSelected(selectedMembers) {
  return selectedMembers.map((m) => {
    if (m.isPending && m.pendingEmail) {
      return { name: '', email: m.pendingEmail, role: m.role }
    }
    if (m.isPending && m.pendingUsername) {
      return { name: m.pendingUsername, email: '', role: m.role }
    }
    const name = [m.firstName, m.lastName].filter(Boolean).join(' ').trim() || m.label || ''
    const email = typeof m.email === 'string' ? m.email.trim().toLowerCase() : ''
    return {
      name,
      email,
      role: m.role,
    }
  })
}

function displayUsername(m) {
  if (m.isCreator) return '—'
  if (m.pendingUsername) return `@${m.pendingUsername}`
  if (m.username) return `@${m.username}`
  return '—'
}

function displayName(m) {
  if (m.isCreator) return 'You'
  const n = [m.firstName, m.lastName].filter(Boolean).join(' ').trim()
  return n || '—'
}

function displayEmail(m, creatorEmail) {
  if (m.isCreator && creatorEmail) return creatorEmail
  if (m.pendingEmail) return m.pendingEmail
  if (typeof m.email === 'string' && m.email.trim()) return m.email.trim()
  return '—'
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
  const [cycleLength, setCycleLength] = useState('1')
  const [documentFiles, setDocumentFiles] = useState([])
  const [uploadingDocs, setUploadingDocs] = useState(false)

  const [memberQuery, setMemberQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  /** Last completed user search: used to show “Add new member” only when the API returned no rows for this exact query. */
  const [lastSearch, setLastSearch] = useState({ query: '', count: -1 })

  const [selectedMembers, setSelectedMembers] = useState([])

  const [submitting, setSubmitting] = useState(false)
  const [inviteSubmitting, setInviteSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [inviteError, setInviteError] = useState('')
  const [inviteUsername, setInviteUsername] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteOk, setInviteOk] = useState('')
  const [createdStokvel, setCreatedStokvel] = useState(null)

  const myUserId = session?.user?.id
  const creatorEmail = session?.user?.email

  useEffect(() => {
    if (!createdStokvel?.id) return undefined
    const id = setTimeout(() => navigate(`/stokvels/${createdStokvel.id}`), 5000)
    return () => clearTimeout(id)
  }, [createdStokvel, navigate])

  useEffect(() => {
    if (!myUserId) return
    setSelectedMembers((prev) => {
      const withoutCreator = prev.filter((m) => m.id !== myUserId)
      const existing = prev.find((m) => m.id === myUserId)
      const label = creatorEmail ? `You (creator) · ${creatorEmail}` : 'You (creator)'
      const creatorRow = existing
        ? { ...existing, label, isCreator: true, email: creatorEmail || existing.email || '' }
        : {
            id: myUserId,
            label,
            email: creatorEmail || '',
            username: '',
            firstName: '',
            lastName: '',
            role: 'Admin',
            isCreator: true,
          }
      return [creatorRow, ...withoutCreator.map((m) => ({ ...m, isCreator: false }))]
    })
  }, [myUserId, creatorEmail])

  useEffect(() => {
    const n = Math.max(1, selectedMembers.length)
    setCycleLength(String(n))
  }, [selectedMembers.length])

  useEffect(() => {
    if (!session?.access_token) return undefined
    const q = memberQuery.trim().replace(/,/g, '')
    if (q.length < 2) {
      setSearchResults([])
      setSearchError('')
      setLastSearch({ query: '', count: -1 })
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
        const users = Array.isArray(data.users) ? data.users : []
        setSearchResults(users)
        setLastSearch({ query: q, count: users.length })
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

  const addPendingFromRaw = useCallback(
    (raw) => {
      setFormError('')
      const trimmed = raw.trim()
      if (!trimmed) return
      if (!myUserId) {
        setFormError('Session not ready.')
        return
      }

      let newMember = null
      if (trimmed.includes('@')) {
        const email = trimmed.toLowerCase()
        if (!isValidManualEmail(email)) {
          setFormError('Enter a valid email address.')
          return
        }
        if (creatorEmail && email === creatorEmail.trim().toLowerCase()) {
          setFormError('That is you — you are already in the group.')
          return
        }
        newMember = {
          id: `pending:email:${email}`,
          isPending: true,
          isCreator: false,
          pendingEmail: email,
          label: `${email} (not on platform yet)`,
          firstName: '',
          lastName: '',
          username: '',
          email: '',
          role: 'Member',
        }
      } else {
        const uname = normalizeManualUsername(trimmed)
        if (uname.length < 3 || uname.length > 30) {
          setFormError(
            'Username must be 3–30 characters (letters, numbers, underscore). Use an email if they are not registered yet.',
          )
          return
        }
        newMember = {
          id: `pending:user:${uname}`,
          isPending: true,
          isCreator: false,
          pendingUsername: uname,
          label: `@${uname} (not on platform yet)`,
          firstName: '',
          lastName: '',
          username: uname,
          email: '',
          role: 'Member',
        }
      }

      let postError = ''
      setSelectedMembers((prev) => {
        if (prev.length >= MAX_GROUP_MEMBERS) {
          postError = `Maximum ${MAX_GROUP_MEMBERS} members.`
          return prev
        }
        const dup = prev.some((m) => {
          if (m.id === newMember.id) return true
          if (newMember.pendingEmail && m.pendingEmail === newMember.pendingEmail) return true
          if (newMember.pendingUsername) {
            if (m.pendingUsername === newMember.pendingUsername) return true
            if (m.username && String(m.username).toLowerCase() === newMember.pendingUsername) return true
          }
          return false
        })
        if (dup) {
          postError = 'That person is already listed.'
          return prev
        }
        return [...prev, newMember]
      })
      if (postError) setFormError(postError)
      else {
        setMemberQuery('')
        setSearchResults([])
        setSearchOpen(false)
        setLastSearch({ query: '', count: -1 })
      }
    },
    [myUserId, creatorEmail],
  )

  const selectUser = useCallback(
    (u) => {
      if (myUserId && u.id === myUserId) return
      setSelectedMembers((prev) => {
        if (prev.some((x) => x.id === u.id)) return prev
        if (prev.length >= MAX_GROUP_MEMBERS) return prev
        const email = typeof u.email === 'string' ? u.email.trim() : ''
        return [
          ...prev,
          {
            ...u,
            email,
            role: 'Member',
            isCreator: false,
          },
        ]
      })
      setMemberQuery('')
      setSearchResults([])
      setSearchOpen(false)
      setLastSearch({ query: '', count: -1 })
    },
    [myUserId],
  )

  const removeMember = useCallback((id) => {
    if (myUserId && id === myUserId) return
    setSelectedMembers((prev) => prev.filter((m) => m.id !== id))
  }, [myUserId])

  const setMemberRole = useCallback((id, role) => {
    setSelectedMembers((prev) => {
      const target = prev.find((m) => m.id === id)
      if (target?.isPending && role !== 'Member') return prev

      if (role === 'Treasurer') {
        return prev.map((m) => {
          if (m.id === id) return { ...m, role }
          if (m.role === 'Treasurer') return { ...m, role: 'Member' }
          return m
        })
      }
      if (role === 'Admin') {
        return prev.map((m) => {
          if (m.id === id) return { ...m, role }
          if (m.role === 'Admin') return { ...m, role: 'Member' }
          return m
        })
      }
      return prev.map((m) => (m.id === id ? { ...m, role } : m))
    })
  }, [])

  const onDocumentFilesChange = useCallback((fileList) => {
    const files = Array.from(fileList || [])
    const next = []
    for (const f of files) {
      if (f.type !== 'application/pdf' && !f.name?.toLowerCase().endsWith('.pdf')) {
        setFormError('Only PDF files are allowed for the constitution upload.')
        continue
      }
      if (f.size > PDF_MAX_BYTES) {
        setFormError(`Each PDF must be at most ${PDF_MAX_BYTES / (1024 * 1024)}MB.`)
        continue
      }
      next.push(f)
    }
    if (next.length > 0) setFormError('')
    setDocumentFiles(next)
  }, [])

  const treasurerUserIdFromSelection = useMemo(() => {
    const t = selectedMembers.find((m) => m.role === 'Treasurer' && UUID_RE.test(m.id))
    return t?.id || myUserId || ''
  }, [selectedMembers, myUserId])

  const atMemberCap = selectedMembers.length >= MAX_GROUP_MEMBERS

  const qTrim = memberQuery.trim()
  const showAddNewMember =
    qTrim.length >= 2 &&
    lastSearch.query === qTrim &&
    lastSearch.count === 0 &&
    !searchLoading &&
    !searchError &&
    Boolean(myUserId) &&
    !atMemberCap

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
    if (!myUserId) return setFormError('Session not ready; try again in a moment.')
    const amountNum = Number(contributionAmount)
    const cycleNum = Number(cycleLength)
    if (!name.trim()) return setFormError('Group name is required.')
    if (!Number.isFinite(amountNum) || amountNum <= 0) return setFormError('Enter a valid contribution amount.')
    if (!Number.isInteger(cycleNum) || cycleNum < 1) return setFormError('Invalid group size for cycle length.')
    if (selectedMembers.length > MAX_GROUP_MEMBERS) {
      return setFormError(`A group can have at most ${MAX_GROUP_MEMBERS} members including you.`)
    }
    const treasurerId = treasurerUserIdFromSelection || myUserId
    if (!window.confirm('Create this group with the selected settings and members?')) return

    const initialMemberIds = selectedMembers
      .filter((m) => m.id !== myUserId && UUID_RE.test(m.id))
      .map((m) => m.id)
    const memberDetailsPayload = buildMemberDetailsFromSelected(selectedMembers)
    const membersCount = selectedMembers.length

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
          membersCount,
          memberDetails: memberDetailsPayload,
          documents: documentUrls,
          initialMemberIds,
          treasurerUserId: treasurerId,
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
            <label className={`${labelDark} sm:col-span-2`}>
              Group name
              <input className={inputDark} value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className={labelDark}>
              Type
              <select className={inputDark} value={type} onChange={(e) => setType(e.target.value)}>
                <option value="Rotating">Rotating</option>
                <option value="Fixed">Fixed</option>
                <option value="Investment" disabled>
                  Investment (Coming soon)
                </option>
              </select>
            </label>
            <label className={labelDark}>
              Contribution amount (ZAR)
              <input type="number" min="0" step="0.01" className={inputDark} value={contributionAmount} onChange={(e) => setContributionAmount(e.target.value)} />
            </label>
            <label className={labelDark}>
              Payout schedule
              <select className={inputDark} value={payoutStrategy} onChange={(e) => setPayoutStrategy(e.target.value)}>
                <option value="Manual">Manual</option>
                <option value="Auto-Rotate">Auto-Rotate</option>
              </select>
            </label>
            <label className={labelDark}>
              Payout order
              <select className={inputDark} value={payoutOrder} onChange={(e) => setPayoutOrder(e.target.value)}>
                <option value="randomize">Randomize</option>
                <option value="manual">Manual</option>
              </select>
            </label>
            <label className={labelDark}>
              Meeting frequency
              <select className={inputDark} value={meetingFrequency} onChange={(e) => setMeetingFrequency(e.target.value)}>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="bi-annually">Bi-Annually</option>
              </select>
            </label>
          </div>
        </section>

        <section className="glass p-6">
          <h2 className="mb-4 text-lg font-bold text-white">Members</h2>
          <p className="mb-3 text-xs text-slate-400">
            Search registered users by name, username, or email. If nobody matches, use <strong className="text-slate-200">Add new member</strong> beside the search box. Max{' '}
            {MAX_GROUP_MEMBERS} including you. Cycle length: <span className="text-slate-200">{cycleLength}</span>.
          </p>

          <label className={`${labelDark} block`}>
            Add members
            <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-stretch">
              <div className="relative min-w-0 flex-1">
                <input
                  value={memberQuery}
                  disabled={!myUserId || atMemberCap}
                  onChange={(e) => {
                    setMemberQuery(e.target.value)
                    setSearchOpen(true)
                  }}
                  onFocus={() => setSearchOpen(true)}
                  onBlur={() => setTimeout(() => setSearchOpen(false), 200)}
                  className={inputDark}
                  placeholder="Search by name, username, or email…"
                />
                {searchOpen && (searchLoading || searchResults.length > 0 || searchError) ? (
                  <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-white/15 bg-slate-900 shadow-xl">
                    {searchLoading ? <li className="px-3 py-2 text-xs text-slate-400">Searching...</li> : null}
                    {searchError ? <li className="px-3 py-2 text-xs text-red-300">{searchError}</li> : null}
                    {!searchLoading && !searchError && searchResults.length > 0 ? (
                      <li className="sticky top-0 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)] gap-2 border-b border-white/10 bg-slate-950 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        <span>Username</span>
                        <span>Name</span>
                        <span>Email</span>
                      </li>
                    ) : null}
                    {searchResults
                      .filter((u) => !myUserId || u.id !== myUserId)
                      .map((u) => {
                        const uname = u.username ? `@${u.username}` : '—'
                        const fullName = [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || '—'
                        const em = u.email && String(u.email).trim() ? u.email : '—'
                        return (
                          <li key={u.id} className="border-b border-white/5 last:border-0">
                            <button
                              type="button"
                              disabled={atMemberCap}
                              className="grid w-full grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)] gap-2 px-3 py-2 text-left text-xs text-slate-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
                              onMouseDown={(ev) => {
                                ev.preventDefault()
                                selectUser(u)
                              }}
                            >
                              <span className="truncate" title={uname}>
                                {uname}
                              </span>
                              <span className="truncate" title={fullName}>
                                {fullName}
                              </span>
                              <span className="truncate" title={em}>
                                {em}
                              </span>
                            </button>
                          </li>
                        )
                      })}
                  </ul>
                ) : null}
              </div>
              {showAddNewMember ? (
                <button
                  type="button"
                  className={`${btnSecondary} shrink-0 whitespace-nowrap px-4 py-2 sm:self-auto`}
                  onClick={() => addPendingFromRaw(qTrim)}
                >
                  Add new member
                </button>
              ) : null}
            </div>
          </label>

          {atMemberCap ? <p className="mt-2 text-xs text-amber-200/90">Member limit reached ({MAX_GROUP_MEMBERS}).</p> : null}
          {!myUserId ? <p className="mt-2 text-xs text-slate-400">Sign in to add members.</p> : null}

          <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/5 text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Username</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2 w-10" aria-label="Remove" />
                </tr>
              </thead>
              <tbody>
                {selectedMembers.map((m, idx) => (
                  <tr key={m.id} className="border-b border-white/5 last:border-0">
                    <td className="px-3 py-2 text-slate-400">{idx + 1}</td>
                    <td className="px-3 py-2 text-slate-200">
                      <span className="truncate block max-w-32" title={displayUsername(m)}>
                        {displayUsername(m)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-200">
                      <span className="truncate block max-w-40" title={displayName(m)}>
                        {displayName(m)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-200">
                      <span className="truncate block max-w-48" title={displayEmail(m, creatorEmail)}>
                        {displayEmail(m, creatorEmail)}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {m.isPending ? (
                        <select className={inputDark} value="Member" disabled aria-label={`Role for ${m.label}`}>
                          <option value="Member">Member (invite pending)</option>
                        </select>
                      ) : (
                        <select
                          className={inputDark}
                          value={m.role}
                          onChange={(e) => setMemberRole(m.id, e.target.value)}
                          aria-label={`Role for ${displayName(m)}`}
                        >
                          <option value="Member">Member</option>
                          <option value="Treasurer">Treasurer</option>
                          <option value="Admin">Admin</option>
                        </select>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {m.isCreator || m.id === myUserId ? (
                        <span className="text-xs text-slate-500">—</span>
                      ) : (
                        <button type="button" onClick={() => removeMember(m.id)} className={btnSecondary} aria-label="Remove member">
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {selectedMembers.length === 0 ? <p className="mt-2 text-xs text-slate-400">Loading your row…</p> : null}
        </section>

        <section className="glass p-6">
          <label className={labelDark}>
            Upload Stokvel Constitution (PDF only, Max 5MB)
            <input
              type="file"
              accept="application/pdf"
              multiple
              className={inputDark}
              onChange={(e) => onDocumentFilesChange(e.target.files)}
            />
          </label>
          {documentFiles.length > 0 ? <p className="mt-2 text-xs text-slate-400">{documentFiles.length} PDF file(s) selected.</p> : null}
        </section>

        <button type="button" onClick={handleCreate} disabled={submitting || uploadingDocs} className={`${btnPrimary} w-full py-4 text-base uppercase tracking-wide`}>
          {submitting || uploadingDocs ? 'Creating...' : 'Create stokvel'}
        </button>
      </form>
    </div>
  )
}
