export default function StokvelDashboard() {
  return (
    <div>
      <h1 className="mb-8 text-2xl font-bold tracking-widest">DASHBOARD</h1>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Total contribution', value: 'R 4 200' },
          { label: 'Expected payout', value: 'R 250' },
          { label: 'Live interest rate', value: '4.5%' },
          { label: 'Savings projection', value: 'R 12 600' },
        ].map((card) => (
          <div
            key={card.label}
            className="border border-black bg-white p-4 shadow-none"
          >
            <p className="mb-1 text-xs font-semibold uppercase text-gray-600">
              {card.label}
            </p>
            <p className="text-xl font-semibold">{card.value}</p>
          </div>
        ))}
      </div>

      <button
        type="button"
        className="w-full max-w-md border-2 border-black bg-black py-4 text-lg font-semibold text-white hover:bg-gray-900 sm:w-auto sm:px-12"
      >
        Quick Pay
      </button>
    </div>
  )
}
