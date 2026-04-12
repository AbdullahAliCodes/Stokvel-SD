import { Link } from 'react-router-dom'
import { PlusCircle, Users } from 'lucide-react'
import { pageSubtitle, btnPrimary, btnSecondary } from '../ui'

export default function AdminDashboard() {
  const rows = []
  const activeGroups = 0
  const totalUsers = 0
  const openIssues = 0

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Link
          to="/admin/create-group"
          className={`${btnPrimary} inline-flex items-center justify-center gap-2 px-5 py-3`}
        >
          <PlusCircle className="h-4 w-4 shrink-0" aria-hidden />
          Create new stokvel
        </Link>
        <Link
          to="/admin/groups"
          className={`${btnSecondary} inline-flex items-center justify-center gap-2 px-5 py-3`}
        >
          <Users className="h-4 w-4 shrink-0" aria-hidden />
          Edit groups
        </Link>
      </div>

      <h1 className="mb-2 flex items-center gap-2 text-2xl font-bold tracking-wide text-cyan-400 uppercase">
        <i className="fa-solid fa-shield-halved text-cyan-400" aria-hidden />
        User verifications
      </h1>
      <p className={`mb-6 ${pageSubtitle}`}>Pending review</p>

      <div className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="glass p-4 text-center">
          <p className="text-2xl font-bold text-white">{activeGroups}</p>
          <p className="text-xs text-slate-400">Active groups</p>
        </div>
        <div className="glass p-4 text-center">
          <p className="text-2xl font-bold text-white">{totalUsers}</p>
          <p className="text-xs text-slate-400">Total users</p>
        </div>
        <div className="glass p-4 text-center">
          <p className="text-2xl font-bold text-red-400">{openIssues}</p>
          <p className="text-xs text-slate-400">Open issues</p>
        </div>
        <div className="glass p-4 text-center">
          <p className="text-2xl font-bold text-slate-400">—</p>
          <p className="text-xs text-slate-400">API status</p>
        </div>
      </div>

      <div className="glass overflow-hidden">
        <ul className="divide-y divide-white/10">
          {rows.length === 0 ? (
            <li className="list-none">
              <div className="py-8 text-center text-gray-500 italic">No information available</div>
            </li>
          ) : (
            rows.map((r) => (
              <li
                key={r.group}
                className="flex flex-col gap-1 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="font-semibold text-white">{r.group}</span>
                <span className="text-sm text-slate-400">Treasurer: {r.treasurer}</span>
              </li>
            ))
          )}
        </ul>
      </div>

      <div className="mt-8 glass p-4">
        <h3 className="mb-3 text-sm font-bold text-white">Recent issues (backlog)</h3>
        <div className="py-8 text-center text-gray-500 italic">No information available</div>
      </div>
    </div>
  )
}
