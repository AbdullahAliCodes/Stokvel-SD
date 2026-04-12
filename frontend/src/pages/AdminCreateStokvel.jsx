import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Check, X } from 'lucide-react'
import { useSession } from '../context/SessionContext'
import { apiUrl } from '../utils/api'

const TOTAL_STEPS = 4

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

  const [step, setStep] = useState(1)
  const [name, setName] = useState('')
  const [type, setType] = useState('Rotating')
  const [contributionAmount, setContributionAmount] = useState('')
  const [payoutStrategy, setPayoutStrategy] = useState('Auto-Rotate')
  const [cycleLength, setCycleLength] = useState('12')

  const [memberQuery, setMemberQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [selectedMembers, setSelectedMembers] = useState([])

  const [submitting, setSubmitting] = useState(false)
  const [inviteSubmitting, setInviteSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [inviteError, setInviteError] = useState('')
  const [inviteUsername, setInviteUsername] = useState('')
  const [inviteOk, setInviteOk] = useState('')

  const [createdStokvel, setCreatedStokvel] = useState(null)
  const [toast, setToast] = useState('')

  const dismissToast = useCallback(() => setToast(''), [])

  useEffect(() => {
    if (!toast) return undefined
    const id = setTimeout(dismissToast, 6000)
    return () => clearTimeout(id)
  }, [toast, dismissToast])

  useEffect(() => {
    if (!createdStokvel?.id) return undefined
    const id = setTimeout(() => {
      navigate(`/stokvels/${createdStokvel.id}`)
    }, 5000)
    return () => clearTimeout(id)
  }, [createdStokvel, navigate])

  useEffect(() => {
    if (step !== 3 || !session?.access_token) return undefined

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
        if (!res.ok) {
          throw new Error(parseApiError(text))
        }
        const data = JSON.parse(text)
        setSearchResults(Array.isArray(data.users) ? data.users : [])
      } catch (err) {
        if (err.name === 'AbortError') return
        setSearchResults([])
        setSearchError(err.message ?? String(err))
      } finally {
        setSearchLoading(false)
      }
    }, 350)

    return () => {
      ctrl.abort()
      clearTimeout(t)
    }
  }, [memberQuery, step, session?.access_token])

  const step1Invalid = !name.trim()
  const amountNum = Number(contributionAmount)
  const cycleNum = Number(cycleLength)
  const step2Invalid =
    !Number.isFinite(amountNum) ||
    amountNum <= 0 ||
    !Number.isInteger(cycleNum) ||
    cycleNum < 1

  const myUserId = session?.user?.id

  const selectUser = useCallback(
    (u) => {
      if (myUserId && u.id === myUserId) return
      setSelectedMembers((prev) => {
        if (prev.some((x) => x.id === u.id)) return prev
        return [...prev, { id: u.id, username: u.username, label: u.label }]
      })
      setMemberQuery('')
      setSearchResults([])
      setSearchOpen(false)
    },
    [myUserId],
  )

  const removeMember = useCallback((id) => {
    setSelectedMembers((prev) => prev.filter((x) => x.id !== id))
  }, [])

  const goNext = () => {
    setFormError('')
    if (step === 1 && step1Invalid) {
      setFormError('Enter a group name.')
      return
    }
    if (step === 2 && step2Invalid) {
      setFormError(
        'Contribution must be a positive number and cycle length a whole number ≥ 1.',
      )
      return
    }
    setStep((s) => Math.min(s + 1, TOTAL_STEPS))
  }

  const goBack = () => {
    setFormError('')
    setStep((s) => Math.max(s - 1, 1))
  }

  const handleCreate = async (e) => {
    e?.preventDefault?.()
    setFormError('')
    if (!session?.access_token) {
      setFormError('You must be signed in.')
      return
    }
    if (step1Invalid || step2Invalid) {
      setFormError('Fix validation errors before submitting.')
      return
    }

    setSubmitting(true)
    try {
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
          cycleLength: cycleNum,
          initialMemberIds: selectedMembers.map((m) => m.id),
        }),
      })
      const text = await res.text()
      if (!res.ok) {
        throw new Error(parseApiError(text))
      }
      const data = JSON.parse(text)
      setCreatedStokvel(data.stokvel ?? null)
      const n = selectedMembers.length
      setToast(
        n > 0
          ? `Stokvel created — you are group admin; ${n} member(s) added.`
          : 'Stokvel created — you were added as group admin.',
      )
    } catch (err) {
      setFormError(err.message ?? String(err))
    } finally {
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
      if (!res.ok) {
        throw new Error(parseApiError(text))
      }
      setInviteOk(`Member added: ${inviteUsername.trim()}`)
      setInviteUsername('')
    } catch (err) {
      setInviteError(err.message ?? String(err))
    } finally {
      setInviteSubmitting(false)
    }
  }

  const resetFlow = () => {
    setStep(1)
    setName('')
    setType('Rotating')
    setContributionAmount('')
    setPayoutStrategy('Auto-Rotate')
    setCycleLength('12')
    setMemberQuery('')
    setSearchResults([])
    setSearchError('')
    setSearchOpen(false)
    setSelectedMembers([])
    setCreatedStokvel(null)
    setFormError('')
    setInviteError('')
    setInviteOk('')
    setInviteUsername('')
  }

  const toastEl =
    toast ? (
      <div
        role="status"
        className="fixed bottom-6 right-6 z-50 max-w-sm border border-black bg-white p-4 text-sm shadow-lg"
      >
        <p className="font-medium">{toast}</p>
        <button type="button" className="mt-2 text-xs underline" onClick={dismissToast}>
          Dismiss
        </button>
      </div>
    ) : null

  if (createdStokvel) {
    return (
      <>
        <div>
          <h1 className="mb-2 text-2xl font-bold tracking-wide">MASTER STOKVEL</h1>
          <p className="mb-6 text-sm text-gray-600">
            {createdStokvel.name} is live. You can invite more members or open the group dashboard.
          </p>

          <div className="mb-8 border border-black bg-gray-50 p-4 text-sm">
            <p className="font-medium">Add member by username</p>
            <p className="mt-1 text-gray-600">
              Uses <code className="text-xs">profiles.username</code> (same as Account). They appear on
              that user&apos;s <strong>My stokvels</strong> dashboard once added.
            </p>
            <form className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={handleInvite}>
              <label className="block min-w-0 flex-1 text-xs font-semibold uppercase text-gray-600">
                Username
                <input
                  type="text"
                  value={inviteUsername}
                  onChange={(ev) => setInviteUsername(ev.target.value)}
                  className="mt-1 w-full border border-black bg-white px-3 py-2 text-sm text-black"
                  placeholder="e.g. sipho_k"
                  autoComplete="off"
                />
              </label>
              <button
                type="submit"
                disabled={inviteSubmitting || !inviteUsername.trim()}
                className="border border-black bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-900 disabled:opacity-50"
              >
                {inviteSubmitting ? 'Adding…' : 'Add member'}
              </button>
            </form>
            {inviteError ? (
              <p className="mt-3 border border-black bg-white p-2 text-sm text-red-800">{inviteError}</p>
            ) : null}
            {inviteOk ? (
              <p className="mt-3 border border-black bg-white p-2 text-sm text-green-900">{inviteOk}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              to={`/stokvels/${createdStokvel.id}`}
              className="inline-flex items-center justify-center border border-black bg-black px-6 py-3 text-sm font-semibold text-white hover:bg-gray-900"
            >
              Open group dashboard
            </Link>
            <p className="text-xs text-gray-600">You will be redirected automatically in a few seconds.</p>
          </div>

          <button
            type="button"
            onClick={resetFlow}
            className="mt-8 border border-black bg-white px-4 py-2 text-sm hover:bg-gray-100"
          >
            Create another stokvel
          </button>
        </div>
        {toastEl}
      </>
    )
  }

  return (
    <>
      <div>
        <h1 className="mb-2 text-2xl font-bold tracking-wide">MASTER STOKVEL CREATION</h1>
        <p className="mb-6 text-sm text-gray-600">
          Step {step} of {TOTAL_STEPS} — name and rules, add members, then review and create. You join
          as the first member with group role <strong>admin</strong>.
        </p>

        <div className="mb-8 flex gap-2">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => {
            const n = i + 1
            const done = n < step
            const active = n === step
            return (
              <div
                key={n}
                className={`flex h-9 flex-1 items-center justify-center border text-xs font-semibold uppercase ${
                  active
                    ? 'border-black bg-black text-white'
                    : done
                      ? 'border-black bg-gray-100 text-black'
                      : 'border-gray-300 bg-white text-gray-500'
                }`}
              >
                {done ? <Check className="h-4 w-4" aria-hidden /> : n}
              </div>
            )
          })}
        </div>

        {formError ? (
          <p className="mb-4 border border-black bg-gray-100 p-3 text-sm">{formError}</p>
        ) : null}

        {step === 1 ? (
          <div className="max-w-lg space-y-4">
            <label className="block text-xs font-semibold uppercase text-gray-600">
              Group name
              <input
                type="text"
                value={name}
                onChange={(ev) => setName(ev.target.value)}
                className="mt-1 w-full border border-black bg-white px-3 py-2 text-sm"
                placeholder="e.g. Rosebank Savers"
              />
            </label>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="max-w-lg space-y-4">
            <label className="block text-xs font-semibold uppercase text-gray-600">
              Stokvel type
              <select
                value={type}
                onChange={(ev) => setType(ev.target.value)}
                className="mt-1 w-full border border-black bg-white px-3 py-2 text-sm"
              >
                <option value="Rotating">Rotating</option>
                <option value="Fixed">Fixed</option>
              </select>
            </label>

            <label className="block text-xs font-semibold uppercase text-gray-600">
              Contribution amount (ZAR)
              <div className="mt-1 flex border border-black bg-white">
                <span className="flex items-center border-r border-black px-3 text-sm text-gray-600">
                  R
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={contributionAmount}
                  onChange={(ev) => setContributionAmount(ev.target.value)}
                  className="min-w-0 flex-1 px-3 py-2 text-sm outline-none"
                  placeholder="0.00"
                />
              </div>
            </label>

            <label className="block text-xs font-semibold uppercase text-gray-600">
              Payout schedule
              <select
                value={payoutStrategy}
                onChange={(ev) => setPayoutStrategy(ev.target.value)}
                className="mt-1 w-full border border-black bg-white px-3 py-2 text-sm"
              >
                <option value="Manual">Manual</option>
                <option value="Auto-Rotate">Auto-Rotate</option>
              </select>
            </label>

            <label className="block text-xs font-semibold uppercase text-gray-600">
              Cycle length (e.g. months)
              <input
                type="number"
                min="1"
                step="1"
                value={cycleLength}
                onChange={(ev) => setCycleLength(ev.target.value)}
                className="mt-1 w-full border border-black bg-white px-3 py-2 text-sm"
              />
            </label>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="max-w-lg space-y-4">
            <p className="text-sm text-gray-600">
              Search by <strong>username</strong> or name (at least 2 characters). Selected people are
              saved as <strong>members</strong> in <code className="text-xs">stokvel_members</code> and
              only see this group on their dashboard. You stay <strong>admin</strong>.
            </p>
            <div className="relative">
              <label className="block text-xs font-semibold uppercase text-gray-600">
                Search users
                <input
                  type="text"
                  value={memberQuery}
                  onChange={(ev) => {
                    setMemberQuery(ev.target.value)
                    setSearchOpen(true)
                  }}
                  onFocus={() => setSearchOpen(true)}
                  onBlur={() => {
                    setTimeout(() => setSearchOpen(false), 200)
                  }}
                  className="mt-1 w-full border border-black bg-white px-3 py-2 text-sm"
                  placeholder="username or name…"
                  autoComplete="off"
                />
              </label>
              {searchOpen && (searchLoading || searchResults.length > 0 || searchError) ? (
                <ul className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto border border-black bg-white shadow-md">
                  {searchLoading ? (
                    <li className="px-3 py-2 text-xs text-gray-500">Searching…</li>
                  ) : null}
                  {searchError ? (
                    <li className="border-b border-gray-200 px-3 py-2 text-xs text-red-800">
                      {searchError}
                    </li>
                  ) : null}
                  {!searchLoading &&
                    searchResults
                      .filter((u) => !myUserId || u.id !== myUserId)
                      .map((u) => (
                      <li key={u.id} className="border-b border-gray-100 last:border-b-0">
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100"
                          onMouseDown={(ev) => {
                            ev.preventDefault()
                            selectUser(u)
                          }}
                        >
                          {u.label}
                        </button>
                      </li>
                    ))}
                  {!searchLoading && !searchError && searchResults.filter((u) => !myUserId || u.id !== myUserId).length === 0 && memberQuery.trim().length >= 2 ? (
                    <li className="px-3 py-2 text-xs text-gray-500">No matches.</li>
                  ) : null}
                </ul>
              ) : null}
            </div>

            {selectedMembers.length > 0 ? (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase text-gray-600">Selected members</p>
                <ul className="flex flex-col gap-2">
                  {selectedMembers.map((m) => (
                    <li
                      key={m.id}
                      className="flex items-center justify-between gap-2 border border-black bg-gray-50 px-3 py-2 text-sm"
                    >
                      <span className="min-w-0 truncate">{m.label}</span>
                      <button
                        type="button"
                        onClick={() => removeMember(m.id)}
                        className="shrink-0 border border-black bg-white p-1 hover:bg-gray-100"
                        aria-label={`Remove ${m.label}`}
                      >
                        <X className="h-4 w-4" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-xs text-gray-500">No extra members selected (optional).</p>
            )}
          </div>
        ) : null}

        {step === 4 ? (
          <div className="max-w-lg space-y-4">
            <div className="border border-black bg-gray-50 p-4 text-sm">
              <p className="mb-2 font-semibold">Review</p>
              <ul className="space-y-1 text-gray-800">
                <li>
                  <span className="text-gray-600">Name:</span> {name.trim() || '—'}
                </li>
                <li>
                  <span className="text-gray-600">Type:</span> {type}
                </li>
                <li>
                  <span className="text-gray-600">Contribution:</span> R{' '}
                  {Number.isFinite(amountNum) ? amountNum : '—'}
                </li>
                <li>
                  <span className="text-gray-600">Payout schedule:</span> {payoutStrategy}
                </li>
                <li>
                  <span className="text-gray-600">Cycle length:</span>{' '}
                  {Number.isInteger(cycleNum) ? cycleNum : '—'}
                </li>
                <li>
                  <span className="text-gray-600">Extra members:</span>{' '}
                  {selectedMembers.length === 0
                    ? 'None'
                    : `${selectedMembers.length} selected`}
                </li>
              </ul>
              {selectedMembers.length > 0 ? (
                <ul className="mt-2 border-t border-gray-300 pt-2 text-xs text-gray-700">
                  {selectedMembers.map((m) => (
                    <li key={m.id} className="truncate">
                      • {m.label}
                    </li>
                  ))}
                </ul>
              ) : null}
              <p className="mt-4 text-xs text-gray-600">
                Creates the stokvel as <strong>active</strong>, adds you with group role{' '}
                <strong>admin</strong>, adds selected users (platform <code className="text-xs">profiles.role</code>{' '}
                <strong>admin</strong> → group <strong>admin</strong>; otherwise{' '}
                <strong>member</strong>), then adds every other platform admin to this group with group role{' '}
                <strong>admin</strong>.
              </p>
            </div>
            <p className="border border-dashed border-gray-400 bg-white p-3 text-xs text-gray-700">
              If creation fails with <code className="text-xs">group_role_check</code>, run the SQL
              file <code className="text-xs">20260411000001_fix_stokvel_members_group_role_only.sql</code>{' '}
              in Supabase so <code className="text-xs">admin</code> is allowed on{' '}
              <code className="text-xs">stokvel_members</code>.
            </p>
          </div>
        ) : null}

        <div className="mt-8 flex flex-wrap gap-3">
          {step > 1 ? (
            <button
              type="button"
              onClick={goBack}
              className="inline-flex items-center gap-2 border border-black bg-white px-4 py-2 text-sm hover:bg-gray-100"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
              Back
            </button>
          ) : null}

          {step < TOTAL_STEPS ? (
            <button
              type="button"
              onClick={goNext}
              className="inline-flex items-center gap-2 border border-black bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-900"
            >
              Next
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCreate}
              disabled={submitting}
              className="border border-black bg-black px-6 py-2 text-sm font-semibold text-white hover:bg-gray-900 disabled:opacity-50"
            >
              {submitting ? 'Creating…' : 'Create stokvel'}
            </button>
          )}
        </div>
      </div>
      {toastEl}
    </>
  )
}
