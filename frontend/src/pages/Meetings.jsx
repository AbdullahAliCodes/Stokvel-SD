const meetings = [
  { name: 'Q1 planning', notes: 'Agenda TBC', date: '2026-04-12' },
  { name: 'Treasurer report', notes: 'Bring statements', date: '2026-04-19' },
  { name: 'Payout draw', notes: 'Members only', date: '2026-05-03' },
]

export default function Meetings() {
  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">Upcoming meetings</h1>
        <button
          type="button"
          className="self-start border border-dashed border-gray-500 bg-gray-100 px-3 py-2 text-sm text-gray-700 hover:bg-gray-200"
        >
          Create Meeting (Treasurer Only)
        </button>
      </div>

      <div className="overflow-x-auto border border-black">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead>
            <tr className="border-b border-black bg-gray-100">
              <th className="p-3 font-semibold">Meeting</th>
              <th className="p-3 font-semibold">Notes</th>
              <th className="p-3 font-semibold">Date</th>
            </tr>
          </thead>
          <tbody>
            {meetings.map((m) => (
              <tr key={m.date + m.name} className="border-b border-gray-300">
                <td className="p-3">{m.name}</td>
                <td className="p-3 text-gray-700">{m.notes}</td>
                <td className="p-3">{m.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
