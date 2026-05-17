import { useEffect, useState } from 'react'
import { Settings as SettingsIcon } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { useSession } from '../context/SessionContext'
import { apiUrl } from '../utils/api'
import {
  btnPrimary,
  errorBox,
  inputLight,
  labelLight,
  pageSubtitle,
} from '../ui'
import GroupPageHeader from '../components/GroupPageHeader'

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
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <GroupPageHeader
        title="Group Settings"
        icon={SettingsIcon}
        subtitle={
          name ? (
            <>
              <span className="font-medium text-stone-800 dark:text-stone-100">{name}</span>
              {' — '}
              Update configuration for members and public directory visibility.
            </>
          ) : (
            'Update your group configuration for members and public directory visibility.'
          )
        }
      />
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900 md:p-8">

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
            className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-200"
            role="status"
          >
            {saveSuccess}
          </p>
        ) : null}

        {loading ? (
          <p className="text-sm text-stone-500 dark:text-stone-400">Loading group settings…</p>
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

            <label className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/60">
              <div>
                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                  Public Directory Visibility
                </p>
                <p className="text-xs text-stone-500 dark:text-stone-400">
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
