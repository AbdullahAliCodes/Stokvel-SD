import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import OpportunityCard from '../components/OpportunityCard'
import { useSession } from '../context/SessionContext'
import { apiUrl } from '../utils/api'
import {
  bodyMutedLg,
  headingSection,
  publicNavCtaGuest,
  sectionContainer,
} from '../styles/tokens'

function formatZarAmount(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) return 'R 0'
  return `R ${num.toLocaleString()}`
}

function parseApiError(text) {
  try {
    const payload = JSON.parse(String(text || ''))
    return payload?.error || 'Request failed.'
  } catch {
    return String(text || 'Request failed.')
  }
}

export default function PublicStokvels() {
  const navigate = useNavigate()
  const { session } = useSession()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [joinError, setJoinError] = useState('')
  const [joiningId, setJoiningId] = useState('')

  useEffect(() => {
    const ctrl = new AbortController()

    async function loadPublicStokvels() {
      setLoading(true)
      setError('')
      try {
        const res = await fetch(apiUrl('/api/public/stokvels'), {
          signal: ctrl.signal,
        })
        const text = await res.text()
        if (!res.ok) {
          try {
            const payload = JSON.parse(text)
            throw new Error(payload?.error || 'Failed to load public stokvels.')
          } catch {
            throw new Error(text || 'Failed to load public stokvels.')
          }
        }
        const rows = JSON.parse(text)
        setItems(Array.isArray(rows) ? rows : [])
      } catch (err) {
        if (err.name !== 'AbortError') {
          setError(err.message || 'Could not load public stokvels right now.')
        }
      } finally {
        if (!ctrl.signal.aborted) {
          setLoading(false)
        }
      }
    }

    loadPublicStokvels()
    return () => ctrl.abort()
  }, [])

  async function handleJoin(stokvelId) {
    setJoinError('')
    if (!session?.access_token) {
      navigate('/auth')
      return
    }
    setJoiningId(stokvelId)
    try {
      const res = await fetch(apiUrl(`/api/stokvels/${stokvelId}/join`), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })
      const text = await res.text()
      if (!res.ok) {
        throw new Error(parseApiError(text))
      }
      navigate(`/group/${stokvelId}/dashboard`)
    } catch (err) {
      setJoinError(err.message || 'Could not join this group right now.')
    } finally {
      setJoiningId('')
    }
  }

  return (
    <div className="min-h-full bg-[#faf8f5] pb-16 pt-8 text-emerald-950 dark:bg-slate-950 dark:text-stone-100 md:pt-10">
      <div className={sectionContainer}>
        <nav aria-label="Breadcrumb" className="text-sm text-stone-600">
          <Link to="/" className="font-medium text-emerald-800 hover:text-emerald-950 hover:underline">
            Home
          </Link>
          <span className="mx-2 text-stone-400" aria-hidden>
            /
          </span>
          <span className="text-emerald-900">Public stokvels</span>
        </nav>

        <header className="mx-auto mt-6 max-w-2xl text-center md:mt-8">
          <h1 className={headingSection}>Public stokvel directory</h1>
          <p className={`mt-3 ${bodyMutedLg}`}>
            Open groups currently accepting interest from new members.
          </p>
        </header>

        {loading ? (
          <div className="mx-auto mt-10 max-w-xl rounded-2xl border border-emerald-200 bg-emerald-50/70 px-5 py-6 text-center text-sm text-emerald-900 md:mt-12">
            Loading public stokvels...
          </div>
        ) : null}
        {!loading && error ? (
          <div className="mx-auto mt-10 max-w-xl rounded-2xl border border-red-200 bg-red-50/80 px-5 py-6 text-center text-sm text-red-800 md:mt-12">
            {error}
          </div>
        ) : null}
        {!loading && !error && joinError ? (
          <div className="mx-auto mt-10 max-w-xl rounded-2xl border border-red-200 bg-red-50/80 px-5 py-6 text-center text-sm text-red-800 md:mt-12">
            {joinError}
          </div>
        ) : null}
        {!loading && !error && items.length === 0 ? (
          <div className="mx-auto mt-10 max-w-xl rounded-2xl border border-stone-200 bg-stone-50/80 px-5 py-6 text-center text-sm text-stone-700 md:mt-12">
            No public stokvels are available yet. Check back soon.
          </div>
        ) : null}
        {!loading && !error && items.length > 0 ? (
          <ul className="mx-auto mt-10 grid max-w-7xl list-none grid-cols-1 gap-6 p-0 md:mt-12 md:grid-cols-2 md:items-stretch lg:grid-cols-3">
            {items.map((item) => (
              <li key={item.id} className="min-w-0">
                <OpportunityCard
                  name={item.name || 'Stokvel'}
                  subtitle={`${item.type || 'Community savings'} · ${item.cycle_length || 1} month cycle`}
                  icon="users"
                  metrics={[
                    {
                      label: 'Contribution',
                      value: formatZarAmount(item.contribution_amount),
                    },
                    {
                      label: 'Members',
                      value: String(item.members_count ?? 0),
                    },
                  ]}
                  onApply={() => handleJoin(item.id)}
                  isJoining={joiningId === item.id}
                />
              </li>
            ))}
          </ul>
        ) : null}

        <p className="mx-auto mt-10 max-w-xl text-center text-sm text-stone-600">
          Ready to join? Create an account and apply from any card, or return to the homepage.
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
          <Link to="/auth" className={publicNavCtaGuest}>
            Log In / Sign up
          </Link>
          <Link
            to="/"
            className="text-sm font-semibold text-emerald-800 underline-offset-4 hover:text-emerald-950 hover:underline"
          >
            Back to home
          </Link>
        </div>
      </div>
    </div>
  )
}
