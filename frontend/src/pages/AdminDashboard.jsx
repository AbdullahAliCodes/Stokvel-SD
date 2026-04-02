export default function AdminDashboard() {
  const rows = [
    { group: 'Group Fish', treasurer: 'Mark Fish' },
    { group: 'Avoille Stokvel', treasurer: 'Thandi N.' },
    { group: 'Rosebank Savers', treasurer: 'Sipho K.' },
  ]

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold tracking-wide">GROUP VERIFICATIONS</h1>
      <p className="mb-6 text-sm text-gray-600">
        Pending review — placeholder data
      </p>
      <ul className="divide-y divide-black border border-black">
        {rows.map((r) => (
          <li key={r.group} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="font-medium">{r.group}</span>
            <span className="text-sm text-gray-700">
              Treasurer: {r.treasurer}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
