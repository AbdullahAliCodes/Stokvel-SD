import { Link } from 'react-router-dom'
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
  return (
    <div>
      <h1 className="mb-2 flex items-center gap-2 text-2xl font-bold tracking-wide text-white">
        <i className="fa-solid fa-calendar-days text-cyan-400" aria-hidden />
        Upcoming meetings
      </h1>
      <p className={`mb-6 ${pageSubtitle}`}>Tap a row for details.</p>

      <div className={tableWrap}>
        <table className="w-full min-w-[640px] text-left text-sm text-slate-200">
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
              <tr key={m.id} className="group border-b border-white/5">
                <td className="p-0">
                  <Link
                    to={`/meetings/${m.id}`}
                    className="block cursor-pointer p-3 text-white group-hover:bg-white/[0.06]"
                  >
                    {m.name}
                  </Link>
                </td>
                <td className="p-0">
                  <Link
                    to={`/meetings/${m.id}`}
                    className="block cursor-pointer p-3 text-slate-300 group-hover:bg-white/[0.06]"
                  >
                    {m.group}
                  </Link>
                </td>
                <td className="p-0">
                  <Link
                    to={`/meetings/${m.id}`}
                    className="block cursor-pointer p-3 text-emerald-300/90 group-hover:bg-white/[0.06]"
                  >
                    {m.role}
                  </Link>
                </td>
                <td className="p-0">
                  <Link
                    to={`/meetings/${m.id}`}
                    className="block cursor-pointer p-3 text-slate-400 group-hover:bg-white/[0.06]"
                  >
                    {m.notes}
                  </Link>
                </td>
                <td className="p-0">
                  <Link
                    to={`/meetings/${m.id}`}
                    className="block cursor-pointer p-3 text-slate-300 group-hover:bg-white/[0.06]"
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
