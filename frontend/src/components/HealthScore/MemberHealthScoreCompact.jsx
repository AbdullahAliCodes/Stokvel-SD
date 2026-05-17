import { Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { cardLight, errorBox, pageSubtitle } from '../../ui'
import ScoreGauge from './ScoreGauge'
import { useMemberHealthScore } from './useMemberHealthScore'

export default function MemberHealthScoreCompact({ userId, groupId }) {
  const { session, loading, error, payload } = useMemberHealthScore(userId, groupId)
  const financialHealthPath = `/group/${groupId}/financial-health`
  const showNoteOnly = Boolean(payload?.note)

  if (!userId || !groupId) return null

  if (!session?.access_token) {
    return (
      <section className={`${cardLight} p-4`}>
        <p className={`${pageSubtitle} text-sm`}>Sign in to see your ML health score.</p>
      </section>
    )
  }

  return (
    <Link
      to={financialHealthPath}
      className={`${cardLight} block w-fit max-w-full p-4 transition hover:border-emerald-200 hover:shadow-md dark:hover:border-emerald-800`}
      aria-label="View full financial health report"
    >
      <div className="flex flex-col items-center">
        {loading ? (
          <div className="flex h-28 w-32 items-center justify-center">
            <Loader2 className="h-7 w-7 animate-spin text-emerald-600" aria-label="Loading" />
          </div>
        ) : showNoteOnly ? (
          <div className="flex h-28 w-full max-w-[8.5rem] flex-col items-center justify-center rounded-xl border border-dashed border-stone-200 bg-stone-50/90 px-3 py-2 text-center dark:border-slate-600 dark:bg-slate-800/50">
            <p className="text-lg font-bold tabular-nums text-stone-400 dark:text-stone-500">—</p>
            <p className={`${pageSubtitle} mt-1 text-[11px]`}>ML health score</p>
          </div>
        ) : (
          <ScoreGauge
            score={payload?.score ?? 50}
            grade={payload?.grade ?? 'Fair'}
            size="compact"
          />
        )}
      </div>
      {error ? (
        <p className={`${errorBox} mt-3 text-xs`} role="alert" onClick={(e) => e.preventDefault()}>
          {error}
        </p>
      ) : null}
    </Link>
  )
}
