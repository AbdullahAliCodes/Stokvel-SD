import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useSession } from '../context/SessionContext'
import { apiUrl } from '../utils/api'
import {
  btnPrimary,
  errorBox,
  inputLight,
  labelLight,
  pageSubtitle,
  pageTitle,
} from '../ui'

function parseApiError(text) {
  try {
    const json = JSON.parse(text)
    return json.error || text || 'Request failed'
  } catch {
    return text || 'Request failed'
  }
}

function normalizeMeetingFrequency(value) {
  return value === 'weekly' || value === 'bi-weekly' || value === 'monthly' ? value : 'monthly'
}

export default function Settings() {
  const { stokvel_id } = useParams()
  const { session } = useSession()

  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState('')

  const [name, setName] = useState('')
  const [contributionAmount, setContributionAmount] = useState('')
  const [meetingFrequency, setMeetingFrequency] = useState('monthly')
  const [isPublic, setIsPublic] = useState(false)

  useEffect(() => {
    if (!session?.access_token || !stokvel_id) return

    let cancelled = false

    async function loadSettings() {
      setLoading(true)
      setLoadError('')
      setSaveError('')
      setSaveSuccess('')
      try {
        const res = await fetch(apiUrl(`/api/stokvels/${stokvel_id}`), {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        const text = await res.text()
        if (!res.ok) throw new Error(parseApiError(text))
        const payload = JSON.parse(text)
        const stokvel = payload.stokvel ?? {}

        if (cancelled) return
        setName(stokvel.name ?? '')
        setContributionAmount(
          stokvel.contribution_amount != null ? String(stokvel.contribution_amount) : '',
        )
        setMeetingFrequency(normalizeMeetingFrequency(stokvel.meeting_frequency))
        setIsPublic(Boolean(stokvel.is_public))
      } catch (err) {
        if (!cancelled) setLoadError(err.message ?? String(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadSettings()
    return () => {
      cancelled = true
    }
  }, [session?.access_token, stokvel_id])

  async function handleSave(e) {
    e.preventDefault()
    if (!session?.access_token || !stokvel_id) return

    setIsSaving(true)
    setSaveError('')
    setSaveSuccess('')

    try {
      const res = await fetch(apiUrl(`/api/stokvels/${stokvel_id}`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          contribution_amount: Number(contributionAmount),
          meeting_frequency: meetingFrequency,
          is_public: isPublic,
        }),
      })
      const text = await res.text()
      if (!res.ok) throw new Error(parseApiError(text))
      const payload = JSON.parse(text)
      const updated = payload.stokvel ?? {}

      setName(updated.name ?? name)
      setContributionAmount(
        updated.contribution_amount != null
          ? String(updated.contribution_amount)
          : contributionAmount,
      )
      setMeetingFrequency(normalizeMeetingFrequency(updated.meeting_frequency))
      setIsPublic(Boolean(updated.is_public))
      setSaveSuccess('Group settings updated successfully.')
    } catch (err) {
      setSaveError(err.message ?? String(err))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm md:p-8">
        <h1 className={pageTitle}>Group Settings</h1>
        <p className={`${pageSubtitle} mt-1 mb-6`}>
          Update your group configuration for members and public directory visibility.
        </p>

        {loadError ? (
          <p className={`${errorBox} mb-4`} role="alert">
            {loadError}
          </p>
        ) : null}
        {saveError ? (
          <p className={`${errorBox} mb-4`} role="alert">
            {saveError}
          </p>
        ) : null}
        {saveSuccess ? (
          <p
            className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
            role="status"
          >
            {saveSuccess}
          </p>
        ) : null}

        {loading ? (
          <p className="text-sm text-stone-500">Loading group settings…</p>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            <label className={labelLight}>
              Group Name
              <input
                type="text"
                className={inputLight}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </label>

            <label className={labelLight}>
              Monthly Contribution (R)
              <input
                type="number"
                min="0.01"
                step="0.01"
                className={inputLight}
                value={contributionAmount}
                onChange={(e) => setContributionAmount(e.target.value)}
                required
              />
            </label>

            <label className={labelLight}>
              Meeting Frequency
              <select
                className={inputLight}
                value={meetingFrequency}
                onChange={(e) => setMeetingFrequency(e.target.value)}
              >
                <option value="weekly">Weekly</option>
                <option value="bi-weekly">Bi-weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </label>

            <label className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-emerald-800">
                  Public Directory Visibility
                </p>
                <p className="text-xs text-stone-500">
                  Allow this stokvel to appear in the public directory.
                </p>
              </div>
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="h-5 w-5 rounded border-stone-300 text-emerald-700 focus:ring-emerald-600"
              />
            </label>

            <button type="submit" className={btnPrimary} disabled={isSaving}>
              {isSaving ? 'Saving…' : 'Save Changes'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
