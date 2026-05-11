import { LifeBuoy } from 'lucide-react'
import { cardLight, pageSubtitle } from '../ui'

export default function Support() {
  return (
    <div>
      <h1 className="mb-2 flex items-center gap-2 text-2xl font-bold text-emerald-800 dark:text-emerald-200">
        <LifeBuoy className="h-8 w-8 text-emerald-700 dark:text-emerald-400" aria-hidden />
        Support
      </h1>
      <p className={pageSubtitle}>Help center and contact — coming soon.</p>
      <div className={`${cardLight} mt-8 max-w-lg p-6`}>
        <p className="text-sm text-stone-600 dark:text-stone-300">
          For urgent issues, your group treasurer or system admin can log tickets from the admin
          dashboard (wireframe: Issue Tickets).
        </p>
      </div>
    </div>
  )
}
