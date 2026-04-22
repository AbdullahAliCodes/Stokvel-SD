import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useSession } from '../context/SessionContext'
import { apiUrl } from '../utils/api'
import {
  pageTitle,
  pageSubtitle,
  inputLight,
  labelLight,
  btnPrimary,
  btnSecondary,
  errorBox,
  cardLight,
} from '../ui'
import { validateMeetingScheduleLocal } from '../utils/meetingScheduleValidation'

function parseApiError(text) {
  try {
    const j = JSON.parse(text)
    return j.error || text
  } catch {
    return text || 'Request failed'
  }
}

function confirmAction(message) {
  return window.confirm(message)
}

export default function AdminEditStokvel() {
  const { id } = useParams()
  const { session } = useSession()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [type, setType] = useState('Rotating')
  const [status, setStatus] = useState('active')
  const [contributionAmount, setContributionAmount] = useState('')
  const [payoutStrategy, setPayoutStrategy] = useState('Auto-Rotate')
  const [cycleLength, setCycleLength] = useState('12')

  const [memberUsername, setMemberUsername] = useState('')
  const [memberInviteLoading, setMemberInviteLoading] = useState(false)
  const [memberInviteMsg, setMemberInviteMsg] = useState('')
  const [memberInviteErr, setMemberInviteErr] = useState('')
  const [meetings, setMeetings] = useState([])
  const [meetingError, setMeetingError] = useState('')
  const [meetingInfo, setMeetingInfo] = useState('')
  const [meetingSaving, setMeetingSaving] = useState(false)
  const [meetingForm, setMeetingForm] = useState({
    title: '',
    meetingDate: '',
    meetingLink: '',
    agenda: '',
  })
  const [minutesDraft, setMinutesDraft] = useState({})
  const [meetingScheduleErrorShakeKey, setMeetingScheduleErrorShakeKey] = useState(0)

  useEffect(() => {
    if (!session?.access_token || !id) return

    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')
      setMeetingError('')
      try {
        const [res, meetingsRes] = await Promise.all([
          fetch(apiUrl(`/api/admin/stokvels/${id}`), {
            headers: { Authorization: `Bearer ${session.access_token}` },
          }),
          fetch(apiUrl(`/api/stokvels/${id}/meetings`), {
            headers: { Authorization: `Bearer ${session.access_token}` },
          }),
        ])
        const [text, meetingsText] = await Promise.all([res.text(), meetingsRes.text()])
        if (!res.ok) throw new Error(parseApiError(text))
        if (!meetingsRes.ok) throw new Error(parseApiError(meetingsText))
        const data = JSON.parse(text)
        const meetingsData = JSON.parse(meetingsText)
        const s = data.stokvel
        if (!cancelled && s) {
          setName(s.name ?? '')
          setType(s.type ?? 'Rotating')
          setStatus(s.status ?? 'active')
          setContributionAmount(
            s.contribution_amount != null ? String(s.contribution_amount) : '',
          )
          setPayoutStrategy(s.payout_strategy ?? 'Auto-Rotate')
          setCycleLength(s.cycle_length != null ? String(s.cycle_length) : '12')
          setMeetings(Array.isArray(meetingsData.meetings) ? meetingsData.meetings : [])
        }
      } catch (e) {
        if (!cancelled) setError(e.message ?? String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [session?.access_token, id])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!session?.access_token || !id) return
    if (!confirmAction('Save group configuration changes?')) return
    setSaving(true)
    setError('')
    try {
      const amount = Number(contributionAmount)
      const cycle = Number(cycleLength)
      const res = await fetch(apiUrl(`/api/admin/stokvels/${id}`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          type,
          status,
          contributionAmount: amount,
          payoutStrategy,
          cycleLength: cycle,
        }),
      })
      const text = await res.text()
      if (!res.ok) throw new Error(parseApiError(text))
      navigate('/admin/groups')
    } catch (err) {
      setError(err.message ?? String(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleAddMember(e) {
    e.preventDefault()
    if (!session?.access_token || !id) return
    if (!confirmAction(`Add "${memberUsername.trim()}" to this group?`)) return
    setMemberInviteErr('')
    setMemberInviteMsg('')
    setMemberInviteLoading(true)
    try {
      const res = await fetch(apiUrl(`/api/admin/stokvels/${id}/members`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ username: memberUsername.trim() }),
      })
      const text = await res.text()
      if (!res.ok) throw new Error(parseApiError(text))
      setMemberInviteMsg(`Member added: ${memberUsername.trim()}`)
      setMemberUsername('')
    } catch (err) {
      setMemberInviteErr(err.message ?? String(err))
    } finally {
      setMemberInviteLoading(false)
    }
  }

  async function handleCreateMeeting(e) {
    e.preventDefault()
    if (!session?.access_token || !id) return
    setMeetingError('')
    setMeetingInfo('')
    const scheduleCheck = validateMeetingScheduleLocal(meetingForm.meetingDate)
    if (!scheduleCheck.ok) {
      setMeetingError(scheduleCheck.message)
      setMeetingScheduleErrorShakeKey((k) => k + 1)
      return
    }
    if (!confirmAction('Schedule this meeting and send member notifications?')) return
    setMeetingSaving(true)
    try {
      const res = await fetch(apiUrl(`/api/stokvels/${id}/meetings`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(meetingForm),
      })
      const text = await res.text()
      if (!res.ok) throw new Error(parseApiError(text))
      const data = JSON.parse(text)
      if (data.meeting) {
        setMeetings((prev) =>
          [...prev, data.meeting].sort(
            (a, b) => new Date(a.meeting_date).getTime() - new Date(b.meeting_date).getTime(),
          ),
        )
        setMinutesDraft((prev) => ({ ...prev, [data.meeting.id]: data.meeting.minutes ?? '' }))
      }
      setMeetingForm({ title: '', meetingDate: '', meetingLink: '', agenda: '' })
      setMeetingInfo('Meeting scheduled and notifications sent.')
      setMeetingScheduleErrorShakeKey(0)
    } catch (err) {
      setMeetingError(err.message ?? String(err))
      setMeetingScheduleErrorShakeKey((k) => k + 1)
    } finally {
      setMeetingSaving(false)
    }
  }

  async function handleSaveMinutes(meetingId) {
    if (!session?.access_token || !id) return
    if (!confirmAction('Save updated meeting minutes?')) return
    setMeetingSaving(true)
    setMeetingError('')
    setMeetingInfo('')
    setMeetingScheduleErrorShakeKey(0)
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
      setMeetingInfo('Minutes saved.')
    } catch (err) {
      setMeetingError(err.message ?? String(err))
    } finally {
      setMeetingSaving(false)
    }
  }

  async function handleDeleteMeeting(meetingId) {
    if (!session?.access_token || !id) return
    if (!confirmAction('Delete this meeting? This action cannot be undone.')) return
    setMeetingSaving(true)
    setMeetingError('')
    setMeetingInfo('')
    setMeetingScheduleErrorShakeKey(0)
    try {
      const res = await fetch(apiUrl(`/api/stokvels/${id}/meetings/${meetingId}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const text = await res.text()
      if (!res.ok) throw new Error(parseApiError(text))
      setMeetings((prev) => prev.filter((m) => m.id !== meetingId))
      setMeetingInfo('Meeting deleted.')
    } catch (err) {
      setMeetingError(err.message ?? String(err))
    } finally {
      setMeetingSaving(false)
    }
  }

  async function handleDeleteStokvel() {
    if (!session?.access_token || !id) return
    if (!confirmAction('Delete this entire stokvel and all related data? This cannot be undone.')) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch(apiUrl(`/api/admin/stokvels/${id}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const text = await res.text()
      if (!res.ok) throw new Error(parseApiError(text))
      navigate('/admin/groups')
    } catch (err) {
      setError(err.message ?? String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <Link
        to="/admin/groups"
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-emerald-800 hover:text-emerald-900"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
        Back to groups
      </Link>
      <h1 className={pageTitle}>Edit stokvel</h1>
      <p className={`${pageSubtitle} mb-6`}>Update group configuration.</p>

      {error ? (
        <p className={`${errorBox} mb-4`} role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-stone-500">Loading…</p>
      ) : (
        <>
        <form onSubmit={handleSubmit} className="max-w-lg space-y-4">
          <label className={labelLight}>
            Group name
            <input
              type="text"
              required
              value={name}
              onChange={(ev) => setName(ev.target.value)}
              className={inputLight}
            />
          </label>
          <label className={labelLight}>
            Type
            <select value={type} onChange={(ev) => setType(ev.target.value)} className={inputLight}>
              <option value="Rotating">Rotating</option>
              <option value="Fixed">Fixed</option>
            </select>
          </label>
          <label className={labelLight}>
            Status
            <select
              value={status}
              onChange={(ev) => setStatus(ev.target.value)}
              className={inputLight}
            >
              <option value="pending">Pending</option>
              <option value="active">Active</option>
              <option value="rejected">Rejected</option>
            </select>
          </label>
          <label className={labelLight}>
            Contribution (ZAR)
            <input
              type="number"
              min="0"
              step="0.01"
              required
              value={contributionAmount}
              onChange={(ev) => setContributionAmount(ev.target.value)}
              className={inputLight}
            />
          </label>
          <label className={labelLight}>
            Payout schedule
            <select
              value={payoutStrategy}
              onChange={(ev) => setPayoutStrategy(ev.target.value)}
              className={inputLight}
            >
              <option value="Manual">Manual</option>
              <option value="Auto-Rotate">Auto-Rotate</option>
            </select>
          </label>
          <label className={labelLight}>
            Cycle length
            <input
              type="number"
              min="1"
              step="1"
              required
              value={cycleLength}
              onChange={(ev) => setCycleLength(ev.target.value)}
              className={inputLight}
            />
          </label>
          <div className="flex flex-wrap gap-3 pt-2">
            <button type="submit" disabled={saving} className={btnPrimary}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <button
              type="button"
              onClick={handleDeleteStokvel}
              disabled={saving}
              className="inline-flex items-center rounded-lg border border-red-300 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-800 transition hover:bg-red-100 disabled:opacity-50"
            >
              {saving ? 'Working…' : 'Delete stokvel'}
            </button>
            <Link to="/admin/groups" className={`${btnSecondary} inline-flex items-center px-4 py-2.5`}>
              Cancel
            </Link>
          </div>
        </form>

        <div className="mt-10 max-w-lg border-t border-stone-200 pt-8">
          <h2 className="mb-1 text-lg font-semibold text-emerald-800">Add member by username</h2>
          <p className={`mb-4 text-sm ${pageSubtitle}`}>
            Looks up{' '}
            <code className="rounded bg-stone-100 px-1 text-xs text-stone-700">profiles.username</code>.
            They will see
            this stokvel on their My stokvels page.
          </p>
          {memberInviteErr ? (
            <p className={`${errorBox} mb-3`} role="alert">
              {memberInviteErr}
            </p>
          ) : null}
          {memberInviteMsg ? (
            <p
              className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
              role="status"
            >
              {memberInviteMsg}
            </p>
          ) : null}
          <form onSubmit={handleAddMember} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className={`${labelLight} min-w-0 flex-1`}>
              Username
              <input
                type="text"
                value={memberUsername}
                onChange={(ev) => setMemberUsername(ev.target.value)}
                className={inputLight}
                placeholder="e.g. sipho_k"
                autoComplete="off"
              />
            </label>
            <button
              type="submit"
              disabled={memberInviteLoading || !memberUsername.trim()}
              className={btnSecondary}
            >
              {memberInviteLoading ? 'Adding…' : 'Add member'}
            </button>
          </form>
        </div>

        <div className="mt-10 max-w-2xl border-t border-stone-200 pt-8">
          <h2 className="mb-1 text-lg font-semibold text-emerald-800">Meetings & agenda</h2>
          <p className={`mb-4 text-sm ${pageSubtitle}`}>
            Admins and treasurers can schedule meetings, set agendas, and record minutes.
          </p>
          {meetingError ? (
            <p
              key={
                meetingScheduleErrorShakeKey > 0
                  ? `meeting-schedule-err-${meetingScheduleErrorShakeKey}`
                  : 'meeting-err-static'
              }
              className={`${errorBox} mb-3${
                meetingScheduleErrorShakeKey > 0 ? ' animate-meeting-schedule-shake' : ''
              }`}
              role="alert"
            >
              {meetingError}
            </p>
          ) : null}
          {meetingInfo ? (
            <p
              className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
              role="status"
            >
              {meetingInfo}
            </p>
          ) : null}

          <form onSubmit={handleCreateMeeting} className="mb-6 grid gap-3 sm:grid-cols-2">
            <label className={`${labelLight} sm:col-span-2`}>
              Meeting title
              <input
                type="text"
                value={meetingForm.title}
                onChange={(ev) =>
                  setMeetingForm((prev) => ({ ...prev, title: ev.target.value }))
                }
                className={inputLight}
                required
              />
            </label>
            <label className={labelLight}>
              Date & time
              <input
                type="datetime-local"
                value={meetingForm.meetingDate}
                onChange={(ev) =>
                  setMeetingForm((prev) => ({ ...prev, meetingDate: ev.target.value }))
                }
                aria-invalid={meetingScheduleErrorShakeKey > 0 && Boolean(meetingError)}
                className={`${inputLight} transition-shadow duration-200 ${
                  meetingScheduleErrorShakeKey > 0 && meetingError
                    ? 'ring-2 ring-red-500/70 ring-offset-2 ring-offset-stone-50 dark:ring-offset-slate-900'
                    : ''
                }`}
                required
              />
            </label>
            <label className={labelLight}>
              Meeting link
              <input
                type="url"
                value={meetingForm.meetingLink}
                onChange={(ev) =>
                  setMeetingForm((prev) => ({ ...prev, meetingLink: ev.target.value }))
                }
                className={inputLight}
                placeholder="https://..."
              />
            </label>
            <label className={`${labelLight} sm:col-span-2`}>
              Agenda
              <textarea
                rows={4}
                value={meetingForm.agenda}
                onChange={(ev) =>
                  setMeetingForm((prev) => ({ ...prev, agenda: ev.target.value }))
                }
                className={inputLight}
                placeholder="Set the agenda while scheduling"
              />
            </label>
            <div className="sm:col-span-2">
              <button type="submit" disabled={meetingSaving} className={btnSecondary}>
                {meetingSaving ? 'Saving…' : 'Schedule meeting'}
              </button>
            </div>
          </form>

          <div className="space-y-3">
            {meetings.map((m) => (
              <div key={m.id} className={`${cardLight} space-y-2 p-4`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-stone-900">{m.title}</p>
                  <p className="text-xs text-stone-500">
                    {new Date(m.meeting_date).toLocaleString('en-ZA')}
                  </p>
                </div>
                <p className="mt-2 text-sm text-stone-700">
                  <span className="font-semibold text-stone-800">Agenda:</span>{' '}
                  {m.agenda || m.notes || 'No agenda yet.'}
                </p>
                {m.meeting_link ? (
                  <a
                    href={m.meeting_link}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex text-sm font-medium text-emerald-800 underline decoration-emerald-800/40 underline-offset-2 hover:text-emerald-900"
                  >
                    Open meeting link
                  </a>
                ) : null}
                <label className={`${labelLight} mt-3`}>
                  Minutes
                  <textarea
                    rows={3}
                    value={minutesDraft[m.id] ?? m.minutes ?? ''}
                    onChange={(ev) =>
                      setMinutesDraft((prev) => ({ ...prev, [m.id]: ev.target.value }))
                    }
                    className={inputLight}
                    placeholder="Record minutes..."
                  />
                </label>
                <button
                  type="button"
                  onClick={() => handleSaveMinutes(m.id)}
                  disabled={meetingSaving}
                  className={btnSecondary}
                >
                  Save minutes
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteMeeting(m.id)}
                  disabled={meetingSaving}
                  className="ml-2 inline-flex rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-800 transition hover:bg-red-100"
                >
                  Delete meeting
                </button>
              </div>
            ))}
            {meetings.length === 0 ? (
              <p className="text-xs text-stone-500">No meetings scheduled yet.</p>
            ) : null}
          </div>
        </div>
        </>
      )}
    </div>
  )
}
