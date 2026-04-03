import { LifeBuoy } from 'lucide-react'
import { pageSubtitle } from '../ui'

export default function Support() {
  return (
    <div>
      <h1 className="mb-2 flex items-center gap-2 text-2xl font-bold text-white">
        <LifeBuoy className="h-8 w-8 text-blue-400" aria-hidden />
        Support
      </h1>
      <p className={pageSubtitle}>Help center and contact — coming soon.</p>
      <div className="mt-8 glass max-w-lg p-6">
        <p className="text-sm text-slate-400">
          For urgent issues, your group treasurer or system admin can log tickets from the admin
          dashboard (wireframe: Issue Tickets).
        </p>
      </div>
    </div>
  )
}
