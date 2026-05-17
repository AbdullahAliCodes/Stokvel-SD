import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '../context/SessionContext'
import { apiUrl } from '../utils/api'
import { readViewCache, writeViewCache } from '../utils/viewCache'
import { myStokvelsCacheKey, stokvelStatusOf } from '../utils/stokvelMembership'
import SkeletonPage from './ui/SkeletonPage'
import Spinner from './ui/Spinner'

const CACHE_TTL_MS = 180000

function activeMembershipsSorted(memberships) {
  const active = (memberships ?? []).filter((m) => stokvelStatusOf(m) === 'active')
  return active.sort((a, b) => {
    const na = String(a?.stokvels?.name ?? '').toLowerCase()
    const nb = String(b?.stokvels?.name ?? '').toLowerCase()
    if (na < nb) return -1
    if (na > nb) return 1
    const ida = String(a?.stokvels?.id ?? '')
    const idb = String(b?.stokvels?.id ?? '')
    return ida.localeCompare(idb)
  })
}

function activeIdsSet(sortedActive) {
  return new Set(sortedActive.map((m) => m?.stokvels?.id).filter(Boolean))
}

export default function DashboardGateway() {
  const { session, userRole } = useSession()
  const navigate = useNavigate()
  const roleResolved =
    userRole === undefined ? true : userRole !== null && userRole !== undefined && userRole !== 'loading'
  const isAdmin = String(userRole || '').toLowerCase() === 'admin'

  useEffect(() => {
    if (!session?.user?.id || !session?.access_token) return
    if (!roleResolved) return
    if (isAdmin) {
      navigate('/admin/groups', { replace: true })
      return
    }

    let cancelled = false

    async function run() {
      const uid = session.user.id
      const cacheKey = myStokvelsCacheKey(uid)
      const cached = readViewCache(cacheKey, CACHE_TTL_MS)
      let memberships = Array.isArray(cached?.memberships) ? cached.memberships : null

      try {
        const res = await fetch(apiUrl('/api/my-stokvels'), {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        const text = await res.text()
        if (!res.ok) {
          throw new Error(text || `HTTP ${res.status}`)
        }
        const json = JSON.parse(text)
        memberships = json.memberships ?? []
        writeViewCache(cacheKey, { memberships })
      } catch {
        if (!cancelled && memberships == null) {
          memberships = []
        }
      }

      if (cancelled) return

      const list = Array.isArray(memberships) ? memberships : []
      const sortedActive = activeMembershipsSorted(list)

      if (sortedActive.length === 0) {
        navigate('/onboarding', { replace: true })
        return
      }

      const ids = activeIdsSet(sortedActive)
      const last = typeof localStorage !== 'undefined' ? localStorage.getItem('last_stokvel_id') : null
      if (last && ids.has(last)) {
        navigate(`/group/${last}/dashboard`, { replace: true })
        return
      }

      const firstId = sortedActive[0]?.stokvels?.id
      if (firstId) {
        navigate(`/group/${firstId}/dashboard`, { replace: true })
        return
      }

      navigate('/onboarding', { replace: true })
    }

    run()

    return () => {
      cancelled = true
    }
  }, [session, userRole, roleResolved, isAdmin, navigate])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Spinner size="sm" label="Finding your stokvel" />
        <p className="text-sm tracking-wide text-stone-500 dark:text-stone-400">
          Finding your stokvel…
        </p>
      </div>
      <SkeletonPage />
    </div>
  )
}
