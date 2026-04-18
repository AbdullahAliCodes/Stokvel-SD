import { Link } from 'react-router-dom'
import { UserPlus, Home } from 'lucide-react'

export default function Onboarding() {
  return (
    <div className="flex h-dvh flex-col items-center justify-center overflow-hidden bg-[#F4F5F0] p-6 text-stone-800">
      <div className="max-w-md rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm">
        <h1 className="mb-3 text-xl font-bold tracking-tight text-emerald-800">
          Welcome!
        </h1>
        <p className="mb-8 text-sm leading-relaxed text-stone-500">
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
            to="/home"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-5 py-2.5 text-sm font-medium text-stone-700 transition hover:bg-stone-100"
          >
            <Home className="h-4 w-4 shrink-0" aria-hidden />
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  )
}
