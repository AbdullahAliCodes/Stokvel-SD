import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { btnPrimary, cardLight } from '../ui'

const isTreasurer = true

export default function MeetingDetails() {
  const { meeting_id, id: legacyMeetingId, stokvel_id } = useParams()
  const meetingKey = meeting_id ?? legacyMeetingId
  const meetingsListPath = stokvel_id ? `/group/${stokvel_id}/meetings` : '/dashboard'

  return (
    <div className="max-w-2xl text-stone-800 dark:text-stone-100">
      <Link
        to={meetingsListPath}
        className="mb-8 inline-flex items-center gap-2 text-sm text-stone-500 transition hover:text-emerald-800 dark:text-stone-400 dark:hover:text-emerald-300"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to meetings
      </Link>

      <h1 className="mb-8 border-b border-stone-200 pb-4 text-3xl font-bold tracking-tight text-emerald-800 dark:border-slate-700 dark:text-emerald-300">
        Q1 planning
      </h1>

      <div className={`${cardLight} space-y-8 p-6`}>
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
            Group
          </h2>
          <p className="text-lg text-stone-800 dark:text-stone-100">Avoille Stokvel</p>
        </section>

        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
            Date &amp; time
          </h2>
          <p className="text-stone-700 dark:text-stone-300">Saturday, 12 April 2026 — 10:00</p>
        </section>

        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
            Location / link
          </h2>
          <a
            href={`https://meet.example.com/room/${meetingKey ?? 'unknown'}`}
            className="break-all text-emerald-700 underline-offset-2 hover:text-emerald-800 hover:underline dark:text-emerald-300 dark:hover:text-emerald-200"
            target="_blank"
            rel="noreferrer"
          >
            https://meet.example.com/room/{meetingKey ?? 'unknown'}
          </a>
        </section>

        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
            Agenda / notes
          </h2>
          <p className="text-stone-600 dark:text-stone-300">
            Opening, review contributions, confirm payout order, AOB. (Meeting ID:{' '}
            {meetingKey ?? '—'})
          </p>
        </section>
      </div>

      {isTreasurer ? (
        <button type="button" className={`${btnPrimary} mt-6`}>
          Edit meeting
        </button>
      ) : null}
    </div>
  )
}
