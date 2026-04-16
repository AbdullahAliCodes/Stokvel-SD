import { Link, useParams } from 'react-router-dom'
import { pageSubtitle, tableHead, tableWrap } from '../ui'

const meetings = [
  {
    id: '123',
    name: 'Q1 planning',
    group: 'Avoille',
    role: 'Treasurer',
    notes: 'Agenda TBC',
    date: '2026-04-12',
  },
  {
    id: '456',
    name: 'Treasurer report',
    group: 'Midrand Builders',
    role: 'Member',
    notes: 'Bring statements',
    date: '2026-04-19',
  },
  {
    id: '789',
    name: 'Payout draw',
    group: 'Avoille',
    role: 'Treasurer',
    notes: 'Members only',
    date: '2026-05-03',
  },
]

export default function Meetings() {
  const { stokvel_id } = useParams()
  const meetingBase = stokvel_id ? `/group/${stokvel_id}/meetings` : '/dashboard'

  return (
    <div>
      <h1 className="mb-2 flex items-center gap-2 text-2xl font-bold tracking-wide text-emerald-800">
        <i className="fa-solid fa-calendar-days text-emerald-700" aria-hidden />
        Upcoming meetings
      </h1>
      <p className={`mb-6 ${pageSubtitle}`}>Tap a row for details.</p>

      <div className={tableWrap}>
        <table className="w-full min-w-[640px] text-left text-sm text-stone-800">
          <thead>
            <tr className={tableHead}>
              <th className="p-3">Meeting</th>
              <th className="p-3">Group</th>
              <th className="p-3">My Role</th>
              <th className="p-3">Notes</th>
              <th className="p-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {meetings.map((m) => (
              <tr key={m.id} className="group border-b border-stone-100">
                <td className="p-0">
                  <Link
                    to={`${meetingBase}/${m.id}`}
                    className="block cursor-pointer p-3 font-medium text-stone-800 group-hover:bg-stone-50"
                  >
                    {m.name}
                  </Link>
                </td>
                <td className="p-0">
                  <Link
                    to={`${meetingBase}/${m.id}`}
                    className="block cursor-pointer p-3 text-stone-600 group-hover:bg-stone-50"
                  >
                    {m.group}
                  </Link>
                </td>
                <td className="p-0">
                  <Link
                    to={`${meetingBase}/${m.id}`}
                    className="block cursor-pointer p-3 font-medium text-emerald-800 group-hover:bg-stone-50"
                  >
                    {m.role}
                  </Link>
                </td>
                <td className="p-0">
                  <Link
                    to={`${meetingBase}/${m.id}`}
                    className="block cursor-pointer p-3 text-stone-500 group-hover:bg-stone-50"
                  >
                    {m.notes}
                  </Link>
                </td>
                <td className="p-0">
                  <Link
                    to={`${meetingBase}/${m.id}`}
                    className="block cursor-pointer p-3 text-stone-600 group-hover:bg-stone-50"
                  >
                    {m.date}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
