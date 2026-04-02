import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

const isTreasurer = true

export default function MeetingDetails() {
  const { id } = useParams()

  return (
    <div className="max-w-2xl text-black">
      <Link
        to="/meetings"
        className="mb-8 inline-flex items-center gap-2 text-sm text-gray-600 hover:text-black"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to Meetings
      </Link>

      <h1 className="mb-10 border-b border-black pb-4 text-3xl font-semibold tracking-tight">
        Q1 Planning
      </h1>

      <div className="space-y-8 border border-black bg-white p-6">
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-600">
            Group
          </h2>
          <p className="text-lg">Avoille Stokvel</p>
        </section>

        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-600">
            Date & Time
          </h2>
          <p>Saturday, 12 April 2026 — 10:00</p>
        </section>

        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-600">
            Location / Link
          </h2>
          <p className="break-all">
            https://meet.example.com/room/{id ?? 'unknown'}
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-600">
            Agenda / Notes
          </h2>
          <p className="text-gray-800">
            Opening, review contributions, confirm payout order, AOB. (Meeting ID:{' '}
            {id})
          </p>
        </section>
      </div>

      {isTreasurer ? (
        <button
          type="button"
          className="mt-4 bg-black px-4 py-2 text-white hover:bg-gray-900"
        >
          Edit Meeting
        </button>
      ) : null}
    </div>
  )
}
