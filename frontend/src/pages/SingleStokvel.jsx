import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useSession } from '../context/SessionContext'
import { apiUrl } from '../utils/api'
import {
  btnPrimary,
  btnSecondary,
  cardLight,
  errorBox,
  inputLight,
  pageSubtitle,
  tableHead,
  tableRow,
  tableWrap,
} from '../ui'
import { readViewCache, writeViewCache } from '../utils/viewCache'
import MarketRatesWidget from '../components/MarketRatesWidget'
import QuickPayModal from '../components/QuickPayModal'

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
  const { id: legacyStokvelRouteId, stokvel_id } = useParams()
  const id = stokvel_id ?? legacyStokvelRouteId
  const { session } = useSession()
  const [stokvel, setStokvel] = useState(null)
  const [membership, setMembership] = useState(null)
  const [members, setMembers] = useState([])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [quickPayOpen, setQuickPayOpen] = useState(false)
  const [totalContribution, setTotalContribution] = useState(0)
  const [contributions, setContributions] = useState([])
  const [meetings, setMeetings] = useState([])
  const [meetingsLoading, setMeetingsLoading] = useState(true)
  const [meetingsError, setMeetingsError] = useState('')
  const [treasurerUserId, setTreasurerUserId] = useState('')
  const [treasurerSaving, setTreasurerSaving] = useState(false)
  const [treasurerError, setTreasurerError] = useState('')
  const [treasurerOk, setTreasurerOk] = useState('')
  const [meetingSaving, setMeetingSaving] = useState(false)
  const [meetingActionError, setMeetingActionError] = useState('')
  const [meetingActionOk, setMeetingActionOk] = useState('')
  const [editingMeetingId, setEditingMeetingId] = useState('')
  const [editDraft, setEditDraft] = useState({})
  const [minutesDraft, setMinutesDraft] = useState({})
  const [paymentDebug, setPaymentDebug] = useState('')

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
  const expectedPayout = monthlyContribution * memberCount
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
    { label: 'Monthly contribution', value: formatZAR(monthlyContribution) },
    { label: 'Members', value: String(memberCount) },
  ]

  return (
    <div>
      {membership && stokvelStatus === 'rejected' ? (
        <div
          className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          role="status"
        >
          <strong className="font-semibold text-red-900">Application rejected.</strong> This stokvel
          is not active (status: <span className="font-mono">rejected</span>). Meeting and treasury
          actions are disabled for this group.
        </div>
      ) : null}
      {membership && stokvelStatus === 'pending' ? (
        <div
          className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          role="status"
        >
          <strong className="font-semibold text-amber-950">Awaiting approval.</strong> A platform
          admin has not activated this stokvel yet. You will see an active status here once it is
          approved.
        </div>
      ) : null}

      <div
        className={`mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between ${
          isActiveStokvel
            ? 'rounded-xl border-t-4 border-emerald-700 pt-4'
            : 'rounded-xl border-t-4 border-stone-300 pt-4'
        }`}
      >
        <div>
          <h1 className="text-2xl font-bold tracking-widest text-emerald-800 uppercase sm:text-3xl">
            <span className="flex items-center gap-2">
              <i className="fa-solid fa-users text-emerald-700" aria-hidden />
              Stokvel dashboard
            </span>
          </h1>
          {groupName || membership?.group_role ? (
            <p className={`mt-1 ${pageSubtitle}`}>
              {groupName ? <span className="font-medium text-stone-800">{groupName}</span> : null}
              {stokvelStatus ? (
                <span className="ml-2 capitalize text-stone-500">· {stokvelStatus}</span>
              ) : null}
              {membership?.group_role ? (
                <span className="ml-2 text-stone-500">
                  · {formatGroupRole(membership.group_role)}
                </span>
              ) : null}
            </p>
          ) : null}
          <div className="mt-2 inline-flex items-center gap-2 rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-800">
            <span className="font-semibold uppercase tracking-wide">Current treasurer</span>
            <span className="text-emerald-900">{currentTreasurerName}</span>
          </div>
        </div>
      </div>

      {!session ? (
        <p className="mb-6 text-sm text-stone-500">Sign in to view this stokvel.</p>
      ) : null}

      {error ? <p className={`mb-6 ${errorBox}`}>{error}</p> : null}

      {session && loading ? (
        <p className="text-sm text-stone-500">Loading…</p>
      ) : null}

      {session && !loading && membership ? (
        <>
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {statCards.map((card) => (
              <div key={card.label} className={`${cardLight} p-4`}>
                <p className="mb-1 text-xs font-semibold uppercase text-stone-500">
                  {card.label}
                </p>
                <p className="text-xl font-semibold text-stone-800">{card.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <MarketRatesWidget memberMonthlyContribution={monthlyContribution} />
            <div className={`${cardLight} p-6`}>
              <span className="text-sm font-bold text-stone-800">Quick Pay</span>
              {paymentDebug ? (
                <p className="mt-2 text-xs text-amber-800" role="status">
                  Payment debug: {paymentDebug}
                </p>
              ) : null}
              <button
                type="button"
                disabled={!isActiveStokvel}
                onClick={() => isActiveStokvel && setQuickPayOpen(true)}
                className={`${btnPrimary} mt-4 w-full py-3 text-base disabled:cursor-not-allowed disabled:opacity-40`}
              >
                {monthlyContribution > 0
                  ? `Pay monthly contribution (${formatZAR(monthlyContribution)})`
                  : 'Pay monthly contribution'}
              </button>
              <div className="mt-4 rounded-lg border border-stone-200 bg-stone-50 p-3 text-xs italic text-stone-500">
                &quot;Next meeting: 15 April via Zoom&quot;
              </div>
            </div>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div className="space-y-8 lg:col-span-2">
              <section>
                <h3 className="mb-4 border-b border-stone-200 pb-2 text-lg font-bold text-emerald-800">
                  Upcoming meetings
                </h3>
                {meetingActionError ? <p className="mb-3 text-xs text-red-700">{meetingActionError}</p> : null}
                {meetingActionOk ? <p className="mb-3 text-xs text-emerald-800">{meetingActionOk}</p> : null}
                {meetingsError ? <p className="mb-3 text-xs text-red-700">{meetingsError}</p> : null}
                {meetingsLoading ? (
                  <p className="text-xs text-stone-500">Loading meetings…</p>
                ) : (
                  <div className="space-y-3">
                    {upcomingMeetings.map((meeting) => (
                      <div key={meeting.id} className={`${cardLight} space-y-2 p-4`}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold text-stone-800">{meeting.title}</p>
                          <span className="text-xs text-stone-500">{toDisplayDate(meeting.meeting_date)}</span>
                        </div>
                        <p className="text-xs text-stone-500">
                          {new Date(meeting.meeting_date).getTime() >= nowTs ? 'Upcoming' : 'Past'}
                        </p>
                        {editingMeetingId === meeting.id ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={editDraft.title ?? ''}
                              onChange={(e) => setEditDraft((prev) => ({ ...prev, title: e.target.value }))}
                              className={inputLight}
                            />
                            <input
                              type="datetime-local"
                              value={editDraft.meetingDate ?? ''}
                              onChange={(e) =>
                                setEditDraft((prev) => ({ ...prev, meetingDate: e.target.value }))
                              }
                              className={inputLight}
                            />
                            <input
                              type="url"
                              value={editDraft.meetingLink ?? ''}
                              onChange={(e) =>
                                setEditDraft((prev) => ({ ...prev, meetingLink: e.target.value }))
                              }
                              className={inputLight}
                            />
                            <textarea
                              rows={3}
                              value={editDraft.agenda ?? ''}
                              onChange={(e) => setEditDraft((prev) => ({ ...prev, agenda: e.target.value }))}
                              className={inputLight}
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
                                className={btnSecondary}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="text-sm text-stone-600">
                              <span className="font-semibold text-stone-800">Agenda:</span>{' '}
                              {meeting.agenda || meeting.notes || 'No agenda yet.'}
                            </p>
                            <p className="text-sm text-stone-600">
                              <span className="font-semibold text-stone-800">Minutes:</span>{' '}
                              {meeting.minutes || 'No minutes recorded yet.'}
                            </p>
                            {meeting.meeting_link ? (
                              <a
                                href={meeting.meeting_link}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex text-sm font-medium text-emerald-700 underline decoration-emerald-600/40 hover:text-emerald-800"
                              >
                                Join meeting
                              </a>
                            ) : (
                              <p className="text-xs text-stone-500">Meeting link not set.</p>
                            )}
                            {canManageMeetings ? (
                              <div className="space-y-2 border-t border-stone-200 pt-2">
                                <button
                                  type="button"
                                  onClick={() => openEdit(meeting)}
                                  className={btnSecondary}
                                >
                                  Edit meeting
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteMeeting(meeting.id)}
                                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-800 hover:bg-red-100"
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
                                  className={inputLight}
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
                      <p className="text-xs text-stone-500">No upcoming meetings for this group.</p>
                    ) : null}
                  </div>
                )}
              </section>
              <section>
                <h3 className="mb-4 border-b border-stone-200 pb-2 text-lg font-bold text-emerald-800">
                  Past meetings
                </h3>
                {meetingsLoading ? (
                  <p className="text-xs text-stone-500">Loading meetings…</p>
                ) : (
                  <div className="space-y-3">
                    {pastMeetings.map((meeting) => (
                      <div key={meeting.id} className={`${cardLight} space-y-2 p-4`}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold text-stone-800">{meeting.title}</p>
                          <span className="text-xs text-stone-500">{toDisplayDate(meeting.meeting_date)}</span>
                        </div>
                        <p className="text-xs text-stone-500">Past</p>
                        <p className="text-sm text-stone-600">
                          <span className="font-semibold text-stone-800">Agenda:</span>{' '}
                          {meeting.agenda || meeting.notes || 'No agenda yet.'}
                        </p>
                        <p className="text-sm text-stone-600">
                          <span className="font-semibold text-stone-800">Minutes:</span>{' '}
                          {meeting.minutes || 'No minutes recorded yet.'}
                        </p>
                        {meeting.meeting_link ? (
                          <a
                            href={meeting.meeting_link}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex text-sm font-medium text-emerald-700 underline decoration-emerald-600/40 hover:text-emerald-800"
                          >
                            Open meeting link
                          </a>
                        ) : (
                          <p className="text-xs text-stone-500">Meeting link not set.</p>
                        )}
                        {canManageMeetings ? (
                          <div className="space-y-2 border-t border-stone-200 pt-2">
                            <button
                              type="button"
                              onClick={() => openEdit(meeting)}
                              className={btnSecondary}
                            >
                              Edit meeting
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteMeeting(meeting.id)}
                              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-800 hover:bg-red-100"
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
                              className={inputLight}
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
                      <p className="text-xs text-stone-500">No past meetings for this group.</p>
                    ) : null}
                  </div>
                )}
              </section>
              <section>
                <h3 className="mb-4 border-b border-stone-200 pb-2 text-lg font-bold text-emerald-800">
                  Recent contributions
                </h3>
                <div className={tableWrap}>
                  <table className="w-full min-w-[320px] text-left text-sm text-stone-800">
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
                          <td colSpan={3} className="p-6 text-center text-stone-500 italic">
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
                <h3 className="mb-4 border-b border-stone-200 pb-2 text-lg font-bold text-emerald-800">
                  Agenda
                </h3>
                <div className={tableWrap}>
                  <table className="w-full min-w-[320px] text-left text-sm text-stone-800">
                    <thead>
                      <tr className={tableHead}>
                        <th className="p-3">Title</th>
                        <th className="p-3">Date</th>
                        <th className="p-3">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className={tableRow}>
                        <td colSpan="3" className="py-8 text-center text-stone-500 italic">
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
                  <h3 className="mb-4 border-b border-stone-200 pb-2 text-lg font-bold text-emerald-800">
                    Assign treasurer
                  </h3>
                  <div className={`${cardLight} space-y-3 p-4`}>
                    <label className="block text-xs font-semibold uppercase text-stone-500">
                      Treasurer member
                      <select
                        value={treasurerUserId}
                        onChange={(e) => setTreasurerUserId(e.target.value)}
                        className={`${inputLight} mt-2`}
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
                    {treasurerError ? <p className="text-xs text-red-700">{treasurerError}</p> : null}
                    {treasurerOk ? <p className="text-xs text-emerald-800">{treasurerOk}</p> : null}
                  </div>
                </section>
              ) : null}
              <section>
                <h3 className="mb-4 border-b border-stone-200 pb-2 text-lg font-bold text-emerald-800">
                  Payout queue
                </h3>
                <div className={tableWrap}>
                  <table className="w-full min-w-[280px] text-left text-sm text-stone-800">
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
                          <td colSpan={3} className="p-6 text-center text-stone-500 italic">
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
          
          {quickPayOpen ? (
            <QuickPayModal
              groupName={groupName}
              stokvelId={id}
              session={session}
              monthlyContribution={monthlyContribution}
              onClose={() => setQuickPayOpen(false)}
              onDebugStep={setPaymentDebug}
              onRecordError={(message) =>
                setError(`Payment succeeded, but contribution was not recorded: ${message}`)
              }
              onSuccess={(paidAmount, contribution) => {
                setPaymentDebug('UI update started')
                setQuickPayOpen(false)
                const effectiveAmount = Number(contribution?.amount ?? paidAmount) || 0
                const myProfile = members.find((m) => m.user_id === session?.user?.id)?.profiles ?? null
                setTotalContribution((prev) => prev + effectiveAmount)
                setContributions((prev) => [
                  {
                    id: contribution?.id ?? `local-${Date.now()}`,
                    amount: effectiveAmount,
                    paid_at: contribution?.paid_at ?? new Date().toISOString(),
                    user_id: contribution?.user_id ?? session?.user?.id ?? null,
                    profiles: myProfile,
                  },
                  ...prev,
                ])
                setPaymentDebug('Optimistic UI updated, refreshing from server')
              }}
            />
          ) : null}
        </>
      ) : null}
    </div>
  )
}
