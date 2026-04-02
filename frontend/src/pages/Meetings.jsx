import { Link } from 'react-router-dom'

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
      <h1 className="mb-6 text-2xl font-semibold">Upcoming meetings</h1>

      <div className="overflow-x-auto border border-black">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-black bg-gray-100">
              <th className="p-3 font-semibold">Meeting</th>
              <th className="p-3 font-semibold">Group</th>
              <th className="p-3 font-semibold">My Role</th>
              <th className="p-3 font-semibold">Notes</th>
              <th className="p-3 font-semibold">Date</th>
            </tr>
          </thead>
          <tbody>
            {meetings.map((m) => (
              <tr
                key={m.id}
                className="group border-b border-gray-300"
              >
                <td className="p-0">
                  <Link
                    to={`/meetings/${m.id}`}
                    className="block cursor-pointer p-3 text-black group-hover:bg-gray-50"
                  >
                    {m.name}
                  </Link>
                </td>
                <td className="p-0">
                  <Link
                    to={`/meetings/${m.id}`}
                    className="block cursor-pointer p-3 text-black group-hover:bg-gray-50"
                  >
                    {m.group}
                  </Link>
                </td>
                <td className="p-0">
                  <Link
                    to={`/meetings/${m.id}`}
                    className="block cursor-pointer p-3 text-black group-hover:bg-gray-50"
                  >
                    {m.role}
                  </Link>
                </td>
                <td className="p-0">
                  <Link
                    to={`/meetings/${m.id}`}
                    className="block cursor-pointer p-3 text-gray-700 group-hover:bg-gray-50"
                  >
                    {m.notes}
                  </Link>
                </td>
                <td className="p-0">
                  <Link
                    to={`/meetings/${m.id}`}
                    className="block cursor-pointer p-3 text-black group-hover:bg-gray-50"
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
