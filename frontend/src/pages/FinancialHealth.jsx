import { useEffect, useState } from 'react'
import { HeartPulse } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { useSession } from '../context/SessionContext'
import { apiUrl } from '../utils/api'
import { readViewCache } from '../utils/viewCache'
import GroupPageHeader from '../components/GroupPageHeader'
import MemberHealthScore from '../components/HealthScore/MemberHealthScore'

export default function FinancialHealth() {
  const { stokvel_id } = useParams()
  const { session } = useSession()
  const [groupName, setGroupName] = useState('')

  useEffect(() => {
    if (!session?.user?.id || !stokvel_id) return
    const cacheKey = `stokvel_detail:${session.user.id}:${stokvel_id}`
    const cached = readViewCache(cacheKey, 120000)
    const name = cached?.stokvel?.name ?? cached?.membership?.stokvels?.name ?? ''
    if (name) {
      setGroupName(name)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(apiUrl(`/api/stokvels/${stokvel_id}`), {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        const text = await res.text()
        if (!res.ok || cancelled) return
        const json = JSON.parse(text)
        const n = json.stokvel?.name ?? json.membership?.stokvels?.name ?? ''
        if (!cancelled) setGroupName(n)
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [session?.access_token, session?.user?.id, stokvel_id])

  if (!stokvel_id) return null

  return (
    <div className="space-y-8">
      <GroupPageHeader
        title="Financial Health"
        icon={HeartPulse}
        subtitle={
          groupName ? (
            <>
              <span className="font-medium text-stone-800 dark:text-stone-100">
                {groupName}
              </span>
              {' — '}
              Your ML reliability score, contribution patterns, and model insights.
            </>
          ) : (
            'Your ML reliability score, contribution patterns, and model insights.'
          )
        }
      />

      {session?.user?.id ? (
        <MemberHealthScore userId={session.user.id} groupId={stokvel_id} />
      ) : (
        <p className="text-sm text-stone-500 dark:text-stone-400">
          Sign in to view your financial health score.
        </p>
      )}
    </div>
  )
}
