import { useCallback, useEffect, useState } from 'react'
import { useSession } from '../../context/SessionContext'
import { apiUrl } from '../../utils/api'

function parseApiError(text) {
  try {
    const j = JSON.parse(text)
    return j.error || text || 'Request failed'
  } catch {
    return text || 'Request failed'
  }
}

export function useMemberHealthScore(userId, groupId) {
  const { session } = useSession()
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [payload, setPayload] = useState(null)

  const canFetch =
    Boolean(session?.access_token) &&
    typeof userId === 'string' &&
    userId.trim().length > 0 &&
    typeof groupId === 'string' &&
    groupId.trim().length > 0

  const load = useCallback(async () => {
    if (!canFetch) return
    setLoading(true)
    setError('')
    try {
      const uid = encodeURIComponent(userId.trim())
      const q = `?groupId=${encodeURIComponent(groupId.trim())}`
      const res = await fetch(apiUrl(`/api/members/${uid}/health-score${q}`), {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const text = await res.text()
      if (!res.ok) throw new Error(parseApiError(text))
      setPayload(JSON.parse(text))
    } catch (e) {
      setPayload(null)
      setError(e.message ?? String(e))
    } finally {
      setLoading(false)
    }
  }, [canFetch, groupId, session?.access_token, userId])

  useEffect(() => {
    load()
  }, [load])

  const refresh = useCallback(async () => {
    if (!canFetch) return
    setRefreshing(true)
    setError('')
    try {
      const uid = encodeURIComponent(userId.trim())
      const q = `?groupId=${encodeURIComponent(groupId.trim())}`
      const res = await fetch(
        apiUrl(`/api/members/${uid}/health-score/refresh${q}`),
        { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` } },
      )
      const text = await res.text()
      if (!res.ok) throw new Error(parseApiError(text))
      setPayload(JSON.parse(text))
    } catch (e) {
      setError(e.message ?? String(e))
    } finally {
      setRefreshing(false)
    }
  }, [canFetch, groupId, session?.access_token, userId])

  return {
    session,
    loading,
    refreshing,
    error,
    payload,
    canFetch,
    refresh,
  }
}
