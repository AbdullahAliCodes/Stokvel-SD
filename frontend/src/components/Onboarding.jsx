import { Link, Navigate } from 'react-router-dom'
import { UserPlus, Home } from 'lucide-react'
import { useSession } from '../context/SessionContext'
import Spinner from './ui/Spinner'

export default function Onboarding() {
  const { userRole } = useSession()
  const roleResolved = userRole !== null && userRole !== undefined && userRole !== 'loading'
  const isAdmin = String(userRole || '').toLowerCase() === 'admin'

  if (!roleResolved) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 overflow-hidden bg-[#F4F5F0] text-stone-600 dark:bg-slate-950 dark:text-stone-300">
        <Spinner size="lg" label="Preparing your workspace" />
        <p className="text-sm tracking-wide text-stone-500 dark:text-stone-400">
          Preparing your workspace…
        </p>
      </div>
    )
  }

  if (isAdmin) {
    return <Navigate to="/admin/groups" replace />
  }

  return (
    <div className="flex h-dvh flex-col items-center justify-center overflow-hidden bg-[#F4F5F0] p-6 text-stone-800 dark:bg-slate-950 dark:text-stone-100">
      <div className="max-w-md rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h1 className="mb-3 text-xl font-bold tracking-tight text-emerald-800 dark:text-emerald-300">
          Welcome!
        </h1>
        <p className="mb-8 text-sm leading-relaxed text-stone-500 dark:text-stone-400">
          Please apply or create a Stokvel to get started.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            to="/apply"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-800 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-900"
          >
            <UserPlus className="h-4 w-4 shrink-0" aria-hidden />
            Apply to a stokvel
          </Link>
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-5 py-2.5 text-sm font-medium text-stone-700 transition hover:bg-stone-100 dark:border-slate-600 dark:bg-slate-800 dark:text-stone-200 dark:hover:bg-slate-700"
          >
            <Home className="h-4 w-4 shrink-0" aria-hidden />
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  )
}
