import { useEffect, useState } from 'react'
import { Settings as SettingsIcon } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { useSession } from '../context/SessionContext'
import { apiUrl } from '../utils/api'
import { paymentWindowFromStokvel } from '../utils/paymentWindow.js'
import {
  btnPrimary,
  errorBox,
  inputLight,
  labelLight,
} from '../ui'
import GroupPageHeader from '../components/GroupPageHeader'
import SkeletonPage from '../components/ui/SkeletonPage'

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

function parsePaymentWindowDay(value) {
  const n = Number(value)
  if (!Number.isInteger(n) || n < 1 || n > 31) return null
  return n
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
  const [meetingFrequency, setMeetingFrequency] = useState('monthly')
  const [paymentWindowStartDay, setPaymentWindowStartDay] = useState('25')
  const [paymentWindowEndDay, setPaymentWindowEndDay] = useState('5')

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
        setMeetingFrequency(normalizeMeetingFrequency(stokvel.meeting_frequency))
        const window = paymentWindowFromStokvel(stokvel)
        setPaymentWindowStartDay(String(window.startDay))
        setPaymentWindowEndDay(String(window.endDay))
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

    const windowStart = parsePaymentWindowDay(paymentWindowStartDay)
    const windowEnd = parsePaymentWindowDay(paymentWindowEndDay)
    if (windowStart == null || windowEnd == null) {
      setSaveError('Payment window days must be whole numbers between 1 and 31.')
      return
    }

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
          meeting_frequency: meetingFrequency,
          payment_window_start_day: windowStart,
          payment_window_end_day: windowEnd,
        }),
      })
      const text = await res.text()
      if (!res.ok) throw new Error(parseApiError(text))
      const payload = JSON.parse(text)
      const updated = payload.stokvel ?? {}

      setName(updated.name ?? name)
      setMeetingFrequency(normalizeMeetingFrequency(updated.meeting_frequency))
      const window = paymentWindowFromStokvel(updated)
      setPaymentWindowStartDay(String(window.startDay))
      setPaymentWindowEndDay(String(window.endDay))
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
              Update group name, meeting frequency, and payment window rules.
            </>
          ) : (
            'Update group name, meeting frequency, and payment window rules.'
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
          <SkeletonPage variant="form" />
        ) : (
          <form onSubmit={handleSave} className="space-y-4" noValidate>
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

            <div className="rounded-xl border border-stone-200 bg-stone-50/80 p-4 dark:border-slate-700 dark:bg-slate-800/40">
              <p className="text-sm font-medium text-stone-800 dark:text-stone-100">
                Payment window rules
              </p>
              <p className="mt-1 text-xs text-stone-600 dark:text-stone-300">
                Calendar days when members are expected to pay contributions (South African
                time). For example, start day 25 and end day 5 means payments are due from
                the 25th of the prior month through the 5th of the cycle month.
              </p>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <label className={labelLight}>
                  Payment window start day
                  <input
                    type="number"
                    min={1}
                    max={31}
                    className={inputLight}
                    value={paymentWindowStartDay}
                    onChange={(e) => setPaymentWindowStartDay(e.target.value)}
                    aria-describedby="payment-window-start-hint"
                    required
                  />
                  <span
                    id="payment-window-start-hint"
                    className="mt-1 block text-xs font-normal text-stone-500 dark:text-stone-400"
                  >
                    Day 1–31
                  </span>
                </label>
                <label className={labelLight}>
                  Payment window end day
                  <input
                    type="number"
                    min={1}
                    max={31}
                    className={inputLight}
                    value={paymentWindowEndDay}
                    onChange={(e) => setPaymentWindowEndDay(e.target.value)}
                    aria-describedby="payment-window-end-hint"
                    required
                  />
                  <span
                    id="payment-window-end-hint"
                    className="mt-1 block text-xs font-normal text-stone-500 dark:text-stone-400"
                  >
                    Day 1–31
                  </span>
                </label>
              </div>
            </div>

            <button type="submit" className={btnPrimary} disabled={isSaving}>
              {isSaving ? 'Saving…' : 'Save Changes'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
