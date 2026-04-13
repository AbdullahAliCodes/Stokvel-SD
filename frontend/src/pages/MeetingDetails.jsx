import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { btnPrimary } from '../ui'

const isTreasurer = true

export default function MeetingDetails() {
  const { id } = useParams()

  return (
    <div className="max-w-2xl text-white">
      <Link
        to="/meetings"
        className="mb-8 inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-cyan-400"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to meetings
      </Link>

      <h1 className="mb-8 border-b border-white/10 pb-4 text-3xl font-bold tracking-tight text-cyan-400">
        Q1 planning
      </h1>

      <div className="glass space-y-8 p-6">
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Group
          </h2>
          <p className="text-lg text-white">Avoille Stokvel</p>
        </section>

        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Date &amp; time
          </h2>
          <p className="text-slate-200">Saturday, 12 April 2026 — 10:00</p>
        </section>

        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Location / link
          </h2>
          <p className="break-all text-blue-300/90">
            https://meet.example.com/room/{id ?? 'unknown'}
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Agenda / notes
          </h2>
          <p className="text-slate-300">
            Opening, review contributions, confirm payout order, AOB. (Meeting ID: {id})
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
