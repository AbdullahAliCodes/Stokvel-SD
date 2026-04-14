import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useSession } from '../context/SessionContext'
import { apiUrl } from '../utils/api'
import { btnPrimary, errorBox, pageSubtitle, tableHead, tableRow, tableWrap } from '../ui'
import { readViewCache, writeViewCache } from '../utils/viewCache'

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

function formatGroupRole(role) {
  if (!role) return 'Member'
  return String(role).charAt(0).toUpperCase() + String(role).slice(1).toLowerCase()
}

function parseApiError(text) {
  try {
    const json = JSON.parse(text)
    return json.error || text || 'Request failed'
  } catch {
    return text || 'Request failed'
  }
}

function confirmAction(message) {
  return window.confirm(message)
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
  const [meetings, setMeetings] = useState([])
  const [meetingsLoading, setMeetingsLoading] = useState(true)
  const [meetingsError, setMeetingsError] = useState('')
  const [treasurerUserId, setTreasurerUserId] = useState('')
  const [treasurerSaving, setTreasurerSaving] = useState(false)
  const [treasurerError, setTreasurerError] = useState('')
  const [treasurerOk, setTreasurerOk] = useState('')
  const [meetingForm, setMeetingForm] = useState({
    title: '',
    meetingDate: '',
    meetingLink: '',
    agenda: '',
  })
  const [meetingSaving, setMeetingSaving] = useState(false)
  const [meetingActionError, setMeetingActionError] = useState('')
  const [meetingActionOk, setMeetingActionOk] = useState('')
  const [editingMeetingId, setEditingMeetingId] = useState('')
  const [editDraft, setEditDraft] = useState({})
  const [minutesDraft, setMinutesDraft] = useState({})

  async function handleQuickPay() {
    if (!session?.access_token) return
    const parsed = Number(quickPayAmount)
    if (!quickPayAmount || Number.isNaN(parsed) || parsed <= 0) {
      setQuickPayError('Please enter a valid amount')
      return
    }
    setQuickPayLoading(true)
    setQuickPayError(null)
    try {
      const res = await fetch(apiUrl(`/api/stokvels/${id}/contributions`), {
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
      setMeetingsLoading(true)
      setError(null)
      setMeetingsError('')
      const cacheKey = `stokvel_detail:${session.user.id}:${id}`
      const cached = readViewCache(cacheKey, 120000)
      if (cached && !cancelled) {
        setMembership(cached.membership ?? null)
        setStokvel(cached.stokvel ?? null)
        const nextMembers = Array.isArray(cached.members) ? cached.members : []
        setMembers(nextMembers)
        setTreasurerUserId(nextMembers.find((m) => m.group_role === 'treasurer')?.user_id ?? '')
        setTotalContribution(cached.totalContribution ?? 0)
        setContributions(Array.isArray(cached.contributions) ? cached.contributions : [])
        setMeetings(Array.isArray(cached.meetings) ? cached.meetings : [])
        setLoading(false)
        setMeetingsLoading(false)
      }
      try {
        const [res, meetingsRes] = await Promise.all([
          fetch(apiUrl(`/api/stokvels/${id}`), {
            headers: { Authorization: `Bearer ${session.access_token}` },
          }),
          fetch(apiUrl(`/api/stokvels/${id}/meetings`), {
            headers: { Authorization: `Bearer ${session.access_token}` },
          }),
        ])
        const [text, meetingsText] = await Promise.all([res.text(), meetingsRes.text()])
        if (!res.ok) throw new Error(text || `HTTP ${res.status}`)
        if (!meetingsRes.ok) throw new Error(parseApiError(meetingsText))
        const json = JSON.parse(text)
        const meetingsJson = JSON.parse(meetingsText)
        if (!cancelled) {
          setMembership(json.membership ?? null)
          setStokvel(json.stokvel ?? null)
          const nextMembers = Array.isArray(json.members) ? json.members : []
          setMembers(nextMembers)
          const currentTreasurer = nextMembers.find((m) => m.group_role === 'treasurer')?.user_id ?? ''
          setTreasurerUserId(currentTreasurer)
          setTotalContribution(json.totalContribution ?? 0)
          setContributions(Array.isArray(json.contributions) ? json.contributions : [])
          const nextMeetings = Array.isArray(meetingsJson.meetings) ? meetingsJson.meetings : []
          setMeetings(nextMeetings)
          writeViewCache(cacheKey, {
            membership: json.membership ?? null,
            stokvel: json.stokvel ?? null,
            members: nextMembers,
            totalContribution: json.totalContribution ?? 0,
            contributions: Array.isArray(json.contributions) ? json.contributions : [],
            meetings: nextMeetings,
          })
        }
      } catch (e) {
        if (!cancelled) {
          setError(e.message ?? String(e))
          setMembership(null)
          setStokvel(null)
          setMembers([])
          setMeetings([])
          setMeetingsError(e.message ?? String(e))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
          setMeetingsLoading(false)
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [session, id])

  // Support both `{ stokvel }` (router) and legacy `{ membership.stokvels }` shapes
  const effectiveStokvel = stokvel ?? membership?.stokvels ?? null
  const groupName = effectiveStokvel?.name
  const stokvelStatus = String(effectiveStokvel?.status ?? '').toLowerCase()
  const isActiveStokvel = stokvelStatus === 'active'
  const memberCount = members.length
  const monthlyContribution = Number(effectiveStokvel?.contribution_amount) || 0
  const expectedPayout = monthlyContribution
  const savingsProjection = monthlyContribution * memberCount * 12
  const canManageTreasurer = ['treasurer', 'admin'].includes(membership?.group_role)
  const myGroupRole = members.find((m) => m.user_id === session?.user?.id)?.group_role || membership?.group_role
  const canManageMeetings = ['treasurer', 'admin'].includes(myGroupRole)
  const currentTreasurer = members.find((m) => m.group_role === 'treasurer') ?? null
  const currentTreasurerName = currentTreasurer ? memberDisplay(currentTreasurer.profiles) : 'Not assigned'
  const nowTs = Date.now()
  const upcomingMeetings = meetings.filter((m) => new Date(m.meeting_date).getTime() >= nowTs)
  const pastMeetings = meetings.filter((m) => new Date(m.meeting_date).getTime() < nowTs)

  function toDatetimeLocalValue(value) {
    if (!value) return ''
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return ''
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  function toDisplayDate(value) {
    if (!value) return '—'
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return value
    return d.toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' })
  }

  async function handleTreasurerSave() {
    if (!session?.access_token || !id || !treasurerUserId) return
    if (!confirmAction('Save this treasurer change for the group?')) return
    setTreasurerSaving(true)
    setTreasurerError('')
    setTreasurerOk('')
    try {
      const res = await fetch(apiUrl(`/api/stokvels/${id}/treasurer`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ userId: treasurerUserId }),
      })
      const text = await res.text()
      if (!res.ok) {
        throw new Error(parseApiError(text))
      }

      setMembers((prev) =>
        prev.map((m) => ({
          ...m,
          group_role: m.user_id === treasurerUserId ? 'treasurer' : m.group_role === 'treasurer' ? 'member' : m.group_role,
        })),
      )

      if (session.user?.id) {
        setMembership((prev) => {
          if (!prev) return prev
          const nextRole = session.user.id === treasurerUserId ? 'treasurer' : prev.group_role === 'treasurer' ? 'member' : prev.group_role
          return { ...prev, group_role: nextRole }
        })
      }

      setTreasurerOk('Treasurer updated.')
    } catch (e) {
      setTreasurerError(e.message ?? String(e))
    } finally {
      setTreasurerSaving(false)
    }
  }

  function openEdit(meeting) {
    setEditingMeetingId(meeting.id)
    setEditDraft({
      title: meeting.title ?? '',
      meetingDate: toDatetimeLocalValue(meeting.meeting_date),
      meetingLink: meeting.meeting_link ?? '',
      agenda: meeting.agenda ?? meeting.notes ?? '',
    })
    setMinutesDraft((prev) => ({
      ...prev,
      [meeting.id]: meeting.minutes ?? '',
    }))
  }

  async function handleSaveMeeting(meetingId) {
    if (!session?.access_token || !id) return
    if (!confirmAction('Save edits to this meeting?')) return
    setMeetingSaving(true)
    setMeetingActionError('')
    setMeetingActionOk('')
    try {
      const res = await fetch(apiUrl(`/api/stokvels/${id}/meetings/${meetingId}`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(editDraft),
      })
      const text = await res.text()
      if (!res.ok) throw new Error(parseApiError(text))
      const data = JSON.parse(text)
      if (data.meeting) {
        setMeetings((prev) =>
          prev.map((m) => (m.id === meetingId ? data.meeting : m)).sort(
            (a, b) => new Date(a.meeting_date).getTime() - new Date(b.meeting_date).getTime(),
          ),
        )
      }
      setEditingMeetingId('')
      setEditDraft({})
      setMeetingActionOk('Meeting updated.')
    } catch (e) {
      setMeetingActionError(e.message ?? String(e))
    } finally {
      setMeetingSaving(false)
    }
  }

  async function handleSaveMinutes(meetingId) {
    if (!session?.access_token || !id) return
    if (!confirmAction('Save minutes for this meeting?')) return
    setMeetingSaving(true)
    setMeetingActionError('')
    setMeetingActionOk('')
    try {
      const res = await fetch(apiUrl(`/api/stokvels/${id}/meetings/${meetingId}/minutes`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ minutes: minutesDraft[meetingId] ?? '' }),
      })
      const text = await res.text()
      if (!res.ok) throw new Error(parseApiError(text))
      const data = JSON.parse(text)
      if (data.meeting) {
        setMeetings((prev) => prev.map((m) => (m.id === meetingId ? data.meeting : m)))
      }
      setMeetingActionOk('Minutes saved.')
    } catch (e) {
      setMeetingActionError(e.message ?? String(e))
    } finally {
      setMeetingSaving(false)
    }
  }

  async function handleDeleteMeeting(meetingId) {
    if (!session?.access_token || !id) return
    if (!confirmAction('Delete this meeting? This cannot be undone.')) return
    setMeetingSaving(true)
    setMeetingActionError('')
    setMeetingActionOk('')
    try {
      const res = await fetch(apiUrl(`/api/stokvels/${id}/meetings/${meetingId}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const text = await res.text()
      if (!res.ok) throw new Error(parseApiError(text))
      setMeetings((prev) => prev.filter((m) => m.id !== meetingId))
      setMeetingActionOk('Meeting deleted.')
    } catch (e) {
      setMeetingActionError(e.message ?? String(e))
    } finally {
      setMeetingSaving(false)
    }
  }

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
          isActiveStokvel
            ? 'rounded-xl border-t-4 border-emerald-500/80 pt-4'
            : 'rounded-xl border-t-4 border-slate-600 pt-4'
        }`}
      >
        <div>
          <h1 className="text-2xl font-bold tracking-widest text-cyan-400 uppercase sm:text-3xl">
            <span className="flex items-center gap-2">
              <i className="fa-solid fa-users text-cyan-400" aria-hidden />
              Stokvel dashboard
            </span>
          </h1>
          {groupName || membership?.group_role ? (
            <p className={`mt-1 ${pageSubtitle}`}>
              {groupName ? <span className="text-white">{groupName}</span> : null}
              {stokvelStatus ? (
                <span className="ml-2 capitalize text-slate-500">· {stokvelStatus}</span>
              ) : null}
              {membership?.group_role ? (
                <span className="ml-2 text-slate-500">
                  · {formatGroupRole(membership.group_role)}
                </span>
              ) : null}
            </p>
          ) : null}
          <div className="mt-2 inline-flex items-center gap-2 rounded border border-cyan-500/40 bg-cyan-500/10 px-2 py-1 text-xs text-cyan-100">
            <span className="font-semibold uppercase tracking-wide">Current treasurer</span>
            <span className="text-cyan-200">{currentTreasurerName}</span>
          </div>
        </div>
      </div>

      {!session ? (
        <p className="mb-6 text-sm text-slate-500">Sign in to view this stokvel.</p>
      ) : null}

      {error ? <p className={`mb-6 ${errorBox}`}>{error}</p> : null}

      {session && loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : null}

      {session && !loading && membership ? (
        <>
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {statCards.map((card) => (
              <div key={card.label} className="glass p-4">
                <p className="mb-1 text-xs font-semibold uppercase text-slate-400">
                  {card.label}
                </p>
                <p className="text-xl font-semibold text-white">{card.value}</p>
              </div>
            ))}
          </div>

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
                disabled={!isActiveStokvel}
                onClick={() => isActiveStokvel && setQuickPayOpen(true)}
                className={`${btnPrimary} mt-4 w-full py-3 text-base shadow-emerald-900/40 disabled:cursor-not-allowed disabled:opacity-40`}
              >
                {monthlyContribution > 0
                  ? `Pay monthly contribution (${formatZAR(monthlyContribution)})`
                  : 'Pay monthly contribution'}
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
                  Upcoming meetings
                </h3>
                {meetingActionError ? <p className="mb-3 text-xs text-red-400">{meetingActionError}</p> : null}
                {meetingActionOk ? <p className="mb-3 text-xs text-emerald-300">{meetingActionOk}</p> : null}
                {meetingsError ? <p className="mb-3 text-xs text-red-400">{meetingsError}</p> : null}
                {meetingsLoading ? (
                  <p className="text-xs text-slate-500">Loading meetings…</p>
                ) : (
                  <div className="space-y-3">
                    {upcomingMeetings.map((meeting) => (
                      <div key={meeting.id} className="glass space-y-2 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold text-white">{meeting.title}</p>
                          <span className="text-xs text-slate-400">{toDisplayDate(meeting.meeting_date)}</span>
                        </div>
                        <p className="text-xs text-slate-400">
                          {new Date(meeting.meeting_date).getTime() >= nowTs ? 'Upcoming' : 'Past'}
                        </p>
                        {editingMeetingId === meeting.id ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={editDraft.title ?? ''}
                              onChange={(e) => setEditDraft((prev) => ({ ...prev, title: e.target.value }))}
                              className="w-full rounded border border-white/15 bg-white/5 px-3 py-2 text-sm text-white"
                            />
                            <input
                              type="datetime-local"
                              value={editDraft.meetingDate ?? ''}
                              onChange={(e) =>
                                setEditDraft((prev) => ({ ...prev, meetingDate: e.target.value }))
                              }
                              className="w-full rounded border border-white/15 bg-white/5 px-3 py-2 text-sm text-white"
                            />
                            <input
                              type="url"
                              value={editDraft.meetingLink ?? ''}
                              onChange={(e) =>
                                setEditDraft((prev) => ({ ...prev, meetingLink: e.target.value }))
                              }
                              className="w-full rounded border border-white/15 bg-white/5 px-3 py-2 text-sm text-white"
                            />
                            <textarea
                              rows={3}
                              value={editDraft.agenda ?? ''}
                              onChange={(e) => setEditDraft((prev) => ({ ...prev, agenda: e.target.value }))}
                              className="w-full rounded border border-white/15 bg-white/5 px-3 py-2 text-sm text-white"
                            />
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => handleSaveMeeting(meeting.id)}
                                className={btnPrimary}
                                disabled={meetingSaving}
                              >
                                Save edits
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingMeetingId('')
                                  setEditDraft({})
                                }}
                                className="rounded border border-white/20 px-3 py-2 text-sm text-slate-200 hover:bg-white/10"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="text-sm text-slate-300">
                              <span className="font-semibold text-slate-200">Agenda:</span>{' '}
                              {meeting.agenda || meeting.notes || 'No agenda yet.'}
                            </p>
                            <p className="text-sm text-slate-300">
                              <span className="font-semibold text-slate-200">Minutes:</span>{' '}
                              {meeting.minutes || 'No minutes recorded yet.'}
                            </p>
                            {meeting.meeting_link ? (
                              <a
                                href={meeting.meeting_link}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex text-sm text-cyan-300 underline"
                              >
                                Join meeting
                              </a>
                            ) : (
                              <p className="text-xs text-slate-500">Meeting link not set.</p>
                            )}
                            {canManageMeetings ? (
                              <div className="space-y-2 border-t border-white/10 pt-2">
                                <button
                                  type="button"
                                  onClick={() => openEdit(meeting)}
                                  className="rounded border border-white/20 px-3 py-2 text-xs text-slate-200 hover:bg-white/10"
                                >
                                  Edit meeting
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteMeeting(meeting.id)}
                                  className="rounded border border-red-400/40 px-3 py-2 text-xs text-red-300 hover:bg-red-500/10"
                                  disabled={meetingSaving}
                                >
                                  Delete meeting
                                </button>
                                <textarea
                                  rows={3}
                                  value={minutesDraft[meeting.id] ?? meeting.minutes ?? ''}
                                  onChange={(e) =>
                                    setMinutesDraft((prev) => ({ ...prev, [meeting.id]: e.target.value }))
                                  }
                                  placeholder="Record minutes..."
                                  className="w-full rounded border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSaveMinutes(meeting.id)}
                                  className={btnPrimary}
                                  disabled={meetingSaving}
                                >
                                  Save minutes
                                </button>
                              </div>
                            ) : null}
                          </>
                        )}
                      </div>
                    ))}
                    {upcomingMeetings.length === 0 ? (
                      <p className="text-xs text-slate-500">No upcoming meetings for this group.</p>
                    ) : null}
                  </div>
                )}
              </section>
              <section>
                <h3 className="mb-4 border-b border-white/10 pb-2 text-lg font-bold text-white">
                  Past meetings
                </h3>
                {meetingsLoading ? (
                  <p className="text-xs text-slate-500">Loading meetings…</p>
                ) : (
                  <div className="space-y-3">
                    {pastMeetings.map((meeting) => (
                      <div key={meeting.id} className="glass space-y-2 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold text-white">{meeting.title}</p>
                          <span className="text-xs text-slate-400">{toDisplayDate(meeting.meeting_date)}</span>
                        </div>
                        <p className="text-xs text-slate-400">Past</p>
                        <p className="text-sm text-slate-300">
                          <span className="font-semibold text-slate-200">Agenda:</span>{' '}
                          {meeting.agenda || meeting.notes || 'No agenda yet.'}
                        </p>
                        <p className="text-sm text-slate-300">
                          <span className="font-semibold text-slate-200">Minutes:</span>{' '}
                          {meeting.minutes || 'No minutes recorded yet.'}
                        </p>
                        {meeting.meeting_link ? (
                          <a
                            href={meeting.meeting_link}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex text-sm text-cyan-300 underline"
                          >
                            Open meeting link
                          </a>
                        ) : (
                          <p className="text-xs text-slate-500">Meeting link not set.</p>
                        )}
                        {canManageMeetings ? (
                          <div className="space-y-2 border-t border-white/10 pt-2">
                            <button
                              type="button"
                              onClick={() => openEdit(meeting)}
                              className="rounded border border-white/20 px-3 py-2 text-xs text-slate-200 hover:bg-white/10"
                            >
                              Edit meeting
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteMeeting(meeting.id)}
                              className="rounded border border-red-400/40 px-3 py-2 text-xs text-red-300 hover:bg-red-500/10"
                              disabled={meetingSaving}
                            >
                              Delete meeting
                            </button>
                            <textarea
                              rows={3}
                              value={minutesDraft[meeting.id] ?? meeting.minutes ?? ''}
                              onChange={(e) =>
                                setMinutesDraft((prev) => ({ ...prev, [meeting.id]: e.target.value }))
                              }
                              placeholder="Record minutes..."
                              className="w-full rounded border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500"
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveMinutes(meeting.id)}
                              className={btnPrimary}
                              disabled={meetingSaving}
                            >
                              Save minutes
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ))}
                    {pastMeetings.length === 0 ? (
                      <p className="text-xs text-slate-500">No past meetings for this group.</p>
                    ) : null}
                  </div>
                )}
              </section>
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
                      {contributions.length === 0 ? (
                        <tr className={tableRow}>
                          <td colSpan={3} className="p-6 text-center text-slate-500 italic">
                            No contributions yet.
                          </td>
                        </tr>
                      ) : (
                        contributions.map((c) => (
                          <tr key={c.id} className={tableRow}>
                            <td className="p-3">{memberDisplay(c.profiles)}</td>
                            <td className="p-3">{formatZAR(c.amount)}</td>
                            <td className="p-3">
                              {c.paid_at
                                ? new Date(c.paid_at).toLocaleDateString('en-ZA')
                                : '—'}
                            </td>
                          </tr>
                        ))
                      )}
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
              {canManageTreasurer ? (
                <section className="mb-8">
                  <h3 className="mb-4 border-b border-white/10 pb-2 text-lg font-bold text-white">
                    Assign treasurer
                  </h3>
                  <div className="glass space-y-3 p-4">
                    <label className="block text-xs font-semibold uppercase text-slate-400">
                      Treasurer member
                      <select
                        value={treasurerUserId}
                        onChange={(e) => setTreasurerUserId(e.target.value)}
                        className="mt-2 w-full rounded border border-white/15 bg-white/5 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none"
                      >
                        <option value="">Select member</option>
                        {members.map((m) => (
                          <option key={m.user_id} value={m.user_id}>
                            {memberDisplay(m.profiles)} ({formatGroupRole(m.group_role)})
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      onClick={handleTreasurerSave}
                      disabled={treasurerSaving || !treasurerUserId}
                      className={`${btnPrimary} w-full disabled:cursor-not-allowed disabled:opacity-50`}
                    >
                      {treasurerSaving ? 'Saving…' : 'Save treasurer'}
                    </button>
                    {treasurerError ? <p className="text-xs text-red-400">{treasurerError}</p> : null}
                    {treasurerOk ? <p className="text-xs text-emerald-300">{treasurerOk}</p> : null}
                  </div>
                </section>
              ) : null}
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
                      {members.length === 0 ? (
                        <tr className={tableRow}>
                          <td colSpan={3} className="p-6 text-center text-slate-500 italic">
                            No payout schedule yet.
                          </td>
                        </tr>
                      ) : (
                        members.map((m) => (
                          <tr key={`payout-${m.user_id}`} className={tableRow}>
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
          {isActiveStokvel ? (
            <button
              type="button"
              onClick={() => setQuickPayOpen(true)}
              className={`${btnPrimary} mt-8 w-full max-w-md py-4 text-base sm:w-auto sm:px-12`}
            >
              Quick Pay
            </button>
          ) : null}

          {quickPayOpen ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
              <div className="glass w-full max-w-sm border border-white/10 p-6">
                <h2 className="mb-4 text-lg font-bold text-white">Quick Pay</h2>
                <p className="mb-4 text-sm text-slate-400">
                  Enter the amount you are contributing to{' '}
                  <strong className="text-white">{groupName}</strong>.
                </p>
                <input
                  type="number"
                  min="1"
                  placeholder="Amount (R)"
                  value={quickPayAmount}
                  onChange={(e) => setQuickPayAmount(e.target.value)}
                  className="mb-2 w-full rounded border border-white/15 bg-white/5 p-2 text-sm text-white placeholder:text-slate-500 focus:border-cyan-500/50 focus:outline-none"
                />
                {quickPayError ? (
                  <p className="mb-2 text-xs text-red-400">{quickPayError}</p>
                ) : null}
                <div className="mt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={handleQuickPay}
                    disabled={quickPayLoading}
                    className={`${btnPrimary} flex-1 py-2 text-sm disabled:opacity-50`}
                  >
                    {quickPayLoading ? 'Submitting…' : 'Submit Payment'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setQuickPayOpen(false)
                      setQuickPayError(null)
                      setQuickPayAmount('')
                    }}
                    className="flex-1 rounded border border-white/20 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
