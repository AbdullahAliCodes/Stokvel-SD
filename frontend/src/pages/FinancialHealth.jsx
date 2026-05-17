import { useParams } from 'react-router-dom'
import { useSession } from '../context/SessionContext'
import { pageSubtitle } from '../ui'
import MemberHealthScore from '../components/HealthScore/MemberHealthScore'

export default function FinancialHealth() {
  const { stokvel_id } = useParams()
  const { session } = useSession()

  if (!stokvel_id) return null

  return (
    <>
      <header className="mb-8 rounded-xl border-t-4 border-emerald-700 pt-4">
        <h1 className="text-2xl font-bold tracking-tight text-emerald-800 sm:text-3xl">
          Financial Health
        </h1>
        <p className={`mt-1 ${pageSubtitle}`}>
          Your ML reliability score, contribution patterns, and model insights for this group.
        </p>
      </header>

      {session?.user?.id ? (
        <MemberHealthScore userId={session.user.id} groupId={stokvel_id} />
      ) : (
        <p className={pageSubtitle}>Sign in to view your financial health score.</p>
      )}
    </>
  )
}
